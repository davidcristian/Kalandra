import path from "path";
import { app } from "electron";
import { ServerEvents } from "../server";
import { promises as fs, existsSync } from "fs";
import { Logger } from "../RemoteLogger";
import type { IpcLibrarySession } from "../../../ipc/library";
import type { IpcEventPayload } from "../../../ipc/types";

enum FileChannel {
  Item = "item",
  ClientLog = "client-log",
}

// Windows allows none of these in a file name, and a separator would leave the output folder
const RESERVED_CHARACTERS = '<>:"/\\|?*';
const DEVICE_NAMES = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i;

function isValidFileName(name: string): boolean {
  return (
    name.trim() !== "" &&
    !DEVICE_NAMES.test(name.trim()) &&
    ![...name].some(
      (char) => RESERVED_CHARACTERS.includes(char) || char.charCodeAt(0) < 32,
    )
  );
}

export class FileWriter {
  // NOTE: not just for csv now, but keeping for back combat
  private defaultUploadsPath = path.join(
    app.getPath("userData"),
    "apt-data",
    "csv-data",
  );

  private uploadsPath = this.defaultUploadsPath;

  private _state: {
    itemFile: fs.FileHandle | null;
    clientLogFile: fs.FileHandle | null;
  } = { itemFile: null, clientLogFile: null };

  private _enabled = false;

  private _currentDateTime = 0;

  private queue: Promise<void> = Promise.resolve();

  constructor(
    private server: ServerEvents,
    private logger: Logger,
  ) {
    this.server.onEventAnyClient("CLIENT->MAIN::write-data", async (e) => {
      await this.inOrder(async () => {
        await this.handleWriteData(e);
      });
    });
  }

  async restart(enabled: boolean, outputPath: string | null): Promise<void> {
    await this.inOrder(async () => {
      const uploadsPath = outputPath?.length
        ? outputPath
        : this.defaultUploadsPath;
      const folderChanged = uploadsPath !== this.uploadsPath;
      this._enabled = enabled;
      this.uploadsPath = uploadsPath;

      // The handler ignores a session stop while the feature is off, so nothing else would close it
      if (!enabled && this._state.itemFile) {
        await this.closeChannel(FileChannel.Item);
      }
      // The next entry opens client-log.ndjson again, in the new folder. A session file stays in
      // the folder it started in until the session stops.
      if ((!enabled || folderChanged) && this._state.clientLogFile) {
        await this.closeChannel(FileChannel.ClientLog);
      }
    });
  }

  public async flushClientLogFile(): Promise<void> {
    await this.inOrder(async () => {
      if (this._state.clientLogFile) {
        await this.closeChannel(FileChannel.ClientLog);
      }
    });
  }

  // Each event, restart and flush starts after the one before it ends. Otherwise an entry that
  // comes while client-log.ndjson opens finds no file, and Node does not order parallel writes.
  private async inOrder(task: () => Promise<void>): Promise<void> {
    this.queue = this.queue.then(task).catch((err: unknown) => {
      this.logger.write(
        `error [FileWriter] A file operation failed: ${(err as Error).message}`,
      );
    });
    await this.queue;
  }

  private async handleWriteData(
    e: IpcEventPayload<"CLIENT->MAIN::write-data">,
  ) {
    if (e.action === "session" && e.start) {
      await this.startSession(e.name ?? "", e.header ?? "");
      return;
    }
    if (!this._enabled) return;
    if (
      e.action !== "log-item" &&
      e.action !== "session" &&
      e.action !== "client-log-event"
    )
      return;
    if (e.action === "client-log-event") {
      if (!this._state.clientLogFile) {
        const filePath = path.join(this.uploadsPath, "client-log.ndjson");
        await this.openChannel(filePath, FileChannel.ClientLog, true);
      }
      if (e.data.ts < this._currentDateTime) {
        this.logger.write(
          `warn [FileWriter] time just went backwards: ${e.data.ts} < ${this._currentDateTime}`,
        );
      }
      this._currentDateTime = e.data.ts;
      await this.writeLine(JSON.stringify(e.data), FileChannel.ClientLog);
      if (e.close) {
        await this.closeChannel(FileChannel.ClientLog);
      }
      return;
    }

    if (e.action === "log-item") {
      await this.writeLine(e.text, FileChannel.Item);
      return;
    }
    // e.action === "session", a stop
    await this.closeChannel(FileChannel.Item);
  }

  private async startSession(name: string, header: string) {
    const result = await this.openSessionFile(name, header);
    this.server.sendEventTo("broadcast", {
      name: "MAIN->CLIENT::library-session",
      payload: { sessionName: name, result },
    });
  }

  private async openSessionFile(
    name: string,
    header: string,
  ): Promise<IpcLibrarySession["payload"]["result"]> {
    if (!this._enabled) {
      this.logger.write(
        "error [FileWriter] Item Data Collection is off, so no session starts.",
      );
      return "failed";
    }
    if (!isValidFileName(name)) {
      this.logger.write(
        `error [FileWriter] Session name "${name}" is not a valid file name.`,
      );
      return "invalid-name";
    }
    if (!header) {
      this.logger.write("error [FileWriter] Invalid session start event.");
      return "failed";
    }
    try {
      if (!existsSync(this.uploadsPath)) {
        await fs.mkdir(this.uploadsPath, { recursive: true });
      }
      const filePath = path.join(this.uploadsPath, name + ".csv");
      if (await this.openChannel(filePath, FileChannel.Item)) {
        await this.writeLine(header, FileChannel.Item);
      }
      return "started";
    } catch (err) {
      this.logger.write(
        `error [FileWriter] Failed to create session file: ${(err as Error).message}`,
      );
      return "failed";
    }
  }

  private async closeChannel(channel: FileChannel) {
    let file: fs.FileHandle | null;
    switch (channel) {
      case FileChannel.Item:
        file = this._state.itemFile;
        this._state.itemFile = null;
        break;
      case FileChannel.ClientLog:
        file = this._state.clientLogFile;
        this._state.clientLogFile = null;
        break;

      default:
        this.logger.write("error [FileWriter] Invalid channel.");
        return;
    }
    if (!file) {
      this.logger.write(
        `error [FileWriter] Channel ${channel} already closed.`,
      );
      return;
    }

    this.logger.write(`info [FileWriter] Channel ${channel} closed.`);
    try {
      await file.close();
    } catch (err) {
      this.logger.write(
        `error [FileWriter] Failed to close channel ${channel}: ${(err as Error).message}`,
      );
    }
  }

  private async writeLine(line: string, channel: FileChannel) {
    switch (channel) {
      case FileChannel.Item:
        if (!this._state.itemFile) {
          this.logger.write(
            "error [FileWriter] Unable to write to channel item, channel closed.",
          );
          return;
        }
        await this._state.itemFile.write(line + "\n");
        break;
      case FileChannel.ClientLog:
        if (!this._state.clientLogFile) {
          this.logger.write(
            "error [FileWriter] Unable to write to channel client-log, channel closed.",
          );
          return;
        }
        await this._state.clientLogFile.write(line + "\n");
        break;

      default:
        this.logger.write("error [FileWriter] Invalid channel.");
        break;
    }
  }

  /**
   * Opens a channel, 'w' if file doesn't exist, 'a' if it does
   * @param filePath path to file
   * @param channel Which channel to open
   * @param overwrite if it should open in 'w' always
   * @returns true if a file was created, false if it already existed
   */
  private async openChannel(
    filePath: string,
    channel: FileChannel,
    overwrite: boolean = false,
  ): Promise<boolean> {
    const mode = overwrite || !existsSync(filePath) ? "w" : "a";

    const file = await fs.open(filePath, mode);
    switch (channel) {
      case FileChannel.Item:
        this._state.itemFile = file;
        break;
      case FileChannel.ClientLog:
        this._state.clientLogFile = file;
        break;

      default:
        this.logger.write("error [FileWriter] Invalid channel.");
        return false;
    }
    return mode === "w";
  }
}
