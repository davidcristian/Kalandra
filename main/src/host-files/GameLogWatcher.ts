import { promises as fs, watchFile, unwatchFile } from "fs";
import path from "path";
import { app } from "electron";
import { guessFileLocation } from "./utils";
import { ServerEvents } from "../server";
import { Logger } from "../RemoteLogger";
import { FileWriter } from "./FileWriter";
import { LineSplitter } from "./LineSplitter";

const POSSIBLE_PATH =
  process.platform === "win32"
    ? [
        "C:\\Program Files (x86)\\Grinding Gear Games\\Path of Exile 2\\logs\\Client.txt",
        "C:\\Program Files (x86)\\Steam\\steamapps\\common\\Path of Exile 2\\logs\\Client.txt",
      ]
    : process.platform === "linux"
      ? [
          path.join(
            app.getPath("home"),
            ".wine/drive_c/Program Files (x86)/Grinding Gear Games/Path of Exile 2/logs/Client.txt",
          ),
          path.join(
            app.getPath("home"),
            ".local/share/Steam/steamapps/common/Path of Exile 2/logs/Client.txt",
          ),
        ]
      : process.platform === "darwin"
        ? [
            path.join(
              app.getPath("home"),
              "Library/Caches/com.GGG.PathOfExile/Logs/Client.txt",
            ),
          ]
        : [];

// The path holds no file between a delete and the game writing the file again. Windows fails an
// open with EPERM while the delete runs (measured on Node 24).
async function ifExists<T>(operation: Promise<T>): Promise<T | null> {
  try {
    return await operation;
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === "ENOENT") return null;
    if (code === "EPERM" && process.platform === "win32") return null;
    throw err;
  }
}

interface WatchState {
  offset: number;
  path: string;
  file: fs.FileHandle;
  isReading: boolean;
  readBuff: Buffer;
  lines: LineSplitter;
}

export class GameLogWatcher {
  // The logFile whose file is open or opening; null makes the next restart open it again
  private _wantedPath: string | null = null;
  get actualPath() {
    return this._state?.path ?? null;
  }

  private _state: WatchState | null = null;

  constructor(
    private server: ServerEvents,
    private logger: Logger,
    private fileWriter: FileWriter,
    private possiblePaths: readonly string[] = POSSIBLE_PATH,
  ) {
    this.server.onEventAnyClient("CLIENT->MAIN::re-parse-log", async () => {
      if (this._state) {
        // so have file and user set allow client-log to true
        if (!this._state.isReading) {
          this.fileWriter.flushClientLogFile();
          this._state.offset = 0;
          this._state.lines.reset();
          this._state.isReading = true;
          await this.readToEOF(this._state);
        } else {
          this.logger.write(
            "warn [GameLogWatcher] Asked to re-parse log but currently reading, skipping",
          );
        }
      }
    });
  }

  async restart(logFile: string, readLog: boolean) {
    if (!readLog) {
      this.logger.write("info [GameLogWatcher] disabled");
      this._wantedPath = null;
      await this.closeFile();
      return;
    }

    if (this._wantedPath !== logFile) {
      this._wantedPath = logFile;
      await this.closeFile();
    } else {
      return;
    }

    if (!logFile.length) {
      const guessedPath = await guessFileLocation(this.possiblePaths);
      if (guessedPath) {
        logFile = guessedPath;
      } else {
        this._wantedPath = null;
        if (guessedPath === null) {
          this.logger.write(
            "error [GameLogWatcher] Found 2 log files, please enter one into settings:",
          );
          for (const path of this.possiblePaths) {
            this.logger.write(`\n ${path}`);
          }
        } else {
          this.logger.write("error [GameLogWatcher] No log file found");
        }
        return;
      }
    }

    try {
      const file = await fs.open(logFile, "r");
      const stats = await file.stat();
      watchFile(logFile, { interval: 450 }, this.handleFileChange.bind(this));
      this._state = {
        path: logFile,
        file,
        offset: stats.size,
        isReading: false,
        readBuff: Buffer.allocUnsafe(64 * 1024),
        lines: new LineSplitter(this.logger),
      };
    } catch (err) {
      this._wantedPath = null;
      this.logger.write(
        `error [GameLogWatcher] Failed to watch file: ${(err as Error).message}`,
      );
    }
  }

  private async closeFile() {
    const state = this._state;
    if (!state) return;
    // Cleared before the close so that a read still running stops after its current chunk
    this._state = null;
    unwatchFile(state.path);
    await state.file.close();
  }

  // The user can empty or delete the log while it is open, and the game then writes a new one
  private async followFile(state: WatchState) {
    const open = await state.file.stat({ bigint: true });
    const onDisk = await ifExists(fs.stat(state.path, { bigint: true }));
    const isReplaced =
      onDisk !== null && (onDisk.ino !== open.ino || onDisk.dev !== open.dev);
    // A delete between the stat and the open leaves the open file in use
    const file = isReplaced ? await ifExists(fs.open(state.path, "r")) : null;
    if (file) {
      if (this._state !== state) {
        await file.close();
        return;
      }
      const replaced = state.file;
      state.file = file;
      await replaced.close();
      this.logger.write(
        "info [GameLogWatcher] The log file was replaced, reading the new file from the start",
      );
    } else if (open.size < BigInt(state.offset)) {
      this.logger.write(
        "info [GameLogWatcher] The log file got shorter, reading it again from the start",
      );
    } else {
      return;
    }
    state.offset = 0;
    state.lines.reset();
  }

  private handleFileChange() {
    if (this._state && !this._state.isReading) {
      this._state.isReading = true;
      void this.readToEOF(this._state);
    }
  }

  private async readToEOF(state: WatchState) {
    try {
      await this.followFile(state);
      while (this._state === state) {
        const { file, readBuff, offset } = state;
        const { bytesRead } = await file.read(
          readBuff,
          0,
          readBuff.length,
          offset,
        );
        if (!bytesRead) break;

        state.offset += bytesRead;
        const lines = state.lines.push(readBuff.subarray(0, bytesRead));
        if (lines.length) {
          this.server.sendEventTo("broadcast", {
            name: "MAIN->CLIENT::game-log",
            payload: { lines },
          });
        }
      }
    } catch (err) {
      this.logger.write(
        `error [GameLogWatcher] Failed to read the log file: ${(err as Error).message}`,
      );
    } finally {
      state.isReading = false;
    }
  }
}
