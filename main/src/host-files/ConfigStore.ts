import type { ServerEvents } from "../server";
import type { Logger } from "../RemoteLogger";
import type { ConfigProblem } from "../../../ipc/config-problem";
import { app } from "electron";
import fs from "fs/promises";
import path from "path";

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

async function renameWithRetry(files: ConfigFiles, from: string, to: string) {
  for (const delay of RENAME_RETRY_DELAYS_MS) {
    try {
      await files.rename(from, to);
      return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, delay));
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

export class ConfigStore {
  private isTmpFile = false;
  private cfgPath = path.join(
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
  ) {
    server.onEventAnyClient("CLIENT->MAIN::save-config", (cfg) => {
      this.enqueue(async () => {
        await this.save(cfg.contents, cfg.isTemporary);
      });
      server.sendEventTo("broadcast", {
        name: "MAIN->CLIENT::config-changed",
        payload: { contents: cfg.contents },
      });
    });
  }

  async load(): Promise<LoadedConfig> {
    return await this.enqueue(async () => {
      try {
        const contents = await this.files.readFile(this.cfgPath);
        this.readFailed = false;
        return { contents, problem: null };
      } catch (err) {
        if (isMissingFile(err)) {
          this.readFailed = false;
          return { contents: null, problem: null };
        }
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
    });
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

  private async save(contents: string, tmp: boolean) {
    if (process.env.VITE_DEV_SERVER_URL) return;
    if (this.readFailed) {
      this.logger.write(
        `warn [ConfigStore] Did not save the config, because the last read of ${this.cfgPath} failed`,
      );
      return;
    }

    if (tmp && !this.isTmpFile) {
      this.cfgPath += ".tmp";
      this.isTmpFile = true;
    }
    // A crash before the rename leaves the previous config.json whole
    const newFile = `${this.cfgPath}.new`;
    try {
      await fs.mkdir(path.dirname(this.cfgPath), { recursive: true });
      await this.files.writeFile(newFile, contents);
      await renameWithRetry(this.files, newFile, this.cfgPath);
    } catch (err) {
      this.logger.write(
        `error [ConfigStore] Failed to save the config: ${errorMessage(err)}`,
      );
    }
  }
}
