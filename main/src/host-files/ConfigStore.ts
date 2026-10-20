import type { ServerEvents } from "../server";
import type { Logger } from "../RemoteLogger";
import { app } from "electron";
import fs from "fs/promises";
import path from "path";

export interface ConfigFiles {
  writeFile: (file: string, contents: string) => Promise<void>;
  rename: (from: string, to: string) => Promise<void>;
}

const diskFiles: ConfigFiles = {
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

export class ConfigStore {
  private isTmpFile = false;
  private cfgPath = path.join(
    app.getPath("userData"),
    "apt-data",
    "config.json",
  );

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

  async load(): Promise<string | null> {
    return await this.enqueue(async () => {
      let contents: string | null = null;
      try {
        contents = await fs.readFile(this.cfgPath, "utf8");
      } catch {}
      return contents;
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
        `error [ConfigStore] Failed to save the config: ${(err as Error).message}`,
      );
    }
  }
}
