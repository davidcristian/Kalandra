import type { ServerEvents } from "../server";
import { app } from "electron";
import fs from "fs/promises";
import path from "path";

export interface ConfigFiles {
  writeFile: (file: string, contents: string) => Promise<void>;
}

const diskFiles: ConfigFiles = {
  writeFile: async (file, contents) => {
    await fs.writeFile(file, contents);
  },
};

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
    try {
      await fs.mkdir(path.dirname(this.cfgPath), { recursive: true });
      await this.files.writeFile(this.cfgPath, contents);
    } catch {
      app.exit(1);
    }
  }
}
