import type { ServerEvents } from "../server";
import type { Logger } from "../RemoteLogger";
import type { ConfigProblem } from "../../../ipc/config-problem";
import { app } from "electron";
import fs from "fs/promises";
import path from "path";
import { setTimeout as sleep } from "timers/promises";

export interface ConfigFiles {
  readFile: (file: string) => Promise<string>;
  writeFile: (file: string, contents: string) => Promise<void>;
  rename: (from: string, to: string) => Promise<void>;
}

/** What `load()` returns: the text of config.json, or null and the reason when the file exists but is not used. */
export interface LoadedConfig {
  contents: string | null;
  problem: ConfigProblem | null;
}

const diskFiles: ConfigFiles = {
  readFile: async (file) => await fs.readFile(file, "utf8"),
  writeFile: async (file, contents) => {
    const handle = await fs.open(file, "w");
    try {
      await handle.writeFile(contents);
      // Without the flush, a power loss soon after the rename can leave an empty file
      await handle.sync();
    } finally {
      await handle.close();
    }
  },
  rename: fs.rename,
};

// Windows fails a rename over a file that any program has open, such as a backup tool reading
// config.json, with EPERM (measured on Node 24); the retries give it 750 ms to close the file
const RENAME_RETRY_DELAYS_MS = [50, 100, 200, 400];

/** Waits the given number of milliseconds. */
type Wait = (ms: number) => Promise<void>;

async function renameWithRetry(
  files: ConfigFiles,
  wait: Wait,
  from: string,
  to: string,
) {
  for (const delay of RENAME_RETRY_DELAYS_MS) {
    try {
      await files.rename(from, to);
      return;
    } catch {
      await wait(delay);
    }
  }
  await files.rename(from, to);
}

function isMissingFile(err: unknown): boolean {
  return err instanceof Error && "code" in err && err.code === "ENOENT";
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

function isJsonObject(text: string): boolean {
  try {
    const value: unknown = JSON.parse(text);
    return typeof value === "object" && value !== null && !Array.isArray(value);
  } catch {
    return false;
  }
}

/** Returns the name next to `file` that a config.json that is not JSON moves to, with the time in it. */
function backupPath(file: string): string {
  const time = new Date().toISOString().replace(/[:.]/g, "-");
  return path.join(path.dirname(file), `config-broken-${time}.json`);
}

export class ConfigStore {
  private readonly cfgPath = path.join(
    app.getPath("userData"),
    "apt-data",
    "config.json",
  );

  // Set while the last read of the file failed, so the page has the defaults and a save would replace the file
  private readFailed = false;

  // Each read and write of the file starts after the previous one ends
  private queue: Promise<void> = Promise.resolve();

  constructor(
    server: ServerEvents,
    private readonly logger: Logger,
    private readonly files: ConfigFiles = diskFiles,
    private readonly wait: Wait = sleep,
  ) {
    server.onEventAnyClient("CLIENT->MAIN::save-config", (cfg) => {
      this.enqueue(async () => {
        await this.save(cfg.contents);
      });
      server.sendEventTo("broadcast", {
        name: "MAIN->CLIENT::config-changed",
        payload: { contents: cfg.contents },
      });
    });
  }

  async load(): Promise<LoadedConfig> {
    return await this.enqueue(async () => {
      let contents: string;
      try {
        contents = await this.files.readFile(this.cfgPath);
      } catch (err) {
        if (isMissingFile(err)) {
          this.readFailed = false;
          return { contents: null, problem: null };
        }
        return this.readFailure(err);
      }
      if (isJsonObject(contents)) {
        this.readFailed = false;
        return { contents, problem: null };
      }
      return await this.moveAside();
    });
  }

  private readFailure(err: unknown): LoadedConfig {
    this.readFailed = true;
    const message = errorMessage(err);
    this.logger.write(
      `error [ConfigStore] Failed to read ${this.cfgPath}: ${message}. The page uses the default settings, and no save replaces the file until a read of it succeeds`,
    );
    return {
      contents: null,
      problem: { reason: "unreadable", file: this.cfgPath, message },
    };
  }

  // The page then starts from the defaults, and its first save writes a new config.json
  private async moveAside(): Promise<LoadedConfig> {
    const backup = backupPath(this.cfgPath);
    try {
      await renameWithRetry(this.files, this.wait, this.cfgPath, backup);
    } catch (err) {
      return this.readFailure(
        new Error(`it is not JSON, and moving it failed: ${errorMessage(err)}`),
      );
    }
    this.readFailed = false;
    this.logger.write(
      `warn [ConfigStore] ${this.cfgPath} is not JSON, so it was moved to ${backup} and the page uses the default settings`,
    );
    return {
      contents: null,
      problem: { reason: "not-json", file: this.cfgPath, backup },
    };
  }

  private async enqueue<T>(task: () => Promise<T>): Promise<T> {
    const result = this.queue.then(task);
    // A failed task still lets the next one run; its caller gets the error from result
    this.queue = result.then(
      () => undefined,
      () => undefined,
    );
    return await result;
  }

  private async save(contents: string) {
    if (process.env.VITE_DEV_SERVER_URL) return;
    if (this.readFailed) {
      this.logger.write(
        `warn [ConfigStore] Did not save the config, because the last read of ${this.cfgPath} failed`,
      );
      return;
    }

    // A crash before the rename leaves the previous config.json whole
    const newFile = `${this.cfgPath}.new`;
    try {
      await fs.mkdir(path.dirname(this.cfgPath), { recursive: true });
      await this.files.writeFile(newFile, contents);
      await renameWithRetry(this.files, this.wait, newFile, this.cfgPath);
    } catch (err) {
      this.logger.write(
        `error [ConfigStore] Failed to save the config: ${errorMessage(err)}`,
      );
    }
  }
}
