import { promises as fs } from "fs";
import * as os from "os";
import * as path from "path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  GameLogWatcher,
  defaultLogFiles,
  type FileWatch,
} from "../src/host-files/GameLogWatcher";
import { MAX_LINE_BYTES } from "../src/host-files/LineSplitter";
import { Logger } from "../src/RemoteLogger";
import { FakeServer } from "./fake-server";
import { unreadableFiles } from "./unreadable-files";

// The folder that app.getPath() returns, which each test sets to its own temporary folder
const home = vi.hoisted(() => ({ folder: "" }));

vi.mock("electron", () => ({ app: { getPath: () => home.folder } }));

// Stands in for the fs.watchFile polls that the default FileWatch starts and stops
const polls = vi.hoisted(
  () => new Map<string, { interval: number; listener: () => void }>(),
);

vi.mock("fs", async (importOriginal) => {
  const actual = await importOriginal<typeof import("fs")>();
  return {
    ...actual,
    watchFile: (
      file: string,
      options: { interval: number },
      listener: () => void,
    ) => {
      polls.set(file, { interval: options.interval, listener });
    },
    unwatchFile: (file: string) => {
      polls.delete(file);
    },
  };
});

vi.mock("fs/promises", async (importOriginal) => {
  const { withUnreadableFiles } = await import("./unreadable-files");
  return withUnreadableFiles(await importOriginal());
});

/** Stands in for fs.watchFile: a test calls change() where the 450 ms poll would see a change. */
class FakeFileWatch implements FileWatch {
  private listeners = new Map<string, () => Promise<void>>();

  get watched(): string[] {
    return [...this.listeners.keys()];
  }

  watch(file: string, onChange: () => Promise<void>) {
    this.listeners.set(file, onChange);
  }

  unwatch(file: string) {
    this.listeners.delete(file);
  }

  async change(file: string) {
    const onChange = this.listeners.get(file);
    if (!onChange) throw new Error(`${file} is not watched`);
    await onChange();
  }
}

let folder = "";
let file = "";
let logger: Logger;
let server: FakeServer;
let files: FakeFileWatch;
let watcher: GameLogWatcher;

const PLATFORM = process.platform;

function onPlatform(platform: NodeJS.Platform) {
  Object.defineProperty(process, "platform", { value: platform });
}

function createWatcher(possiblePaths?: string[]) {
  server = new FakeServer();
  logger = new Logger(server);
  files = new FakeFileWatch();
  watcher = new GameLogWatcher(server, logger, possiblePaths, files);
}

/** Follows an empty log, then writes `content` to it and reads the change. */
async function followAndWrite(content: string) {
  await fs.writeFile(file, "");
  await watcher.restart(file, true);
  await fs.writeFile(file, content);
  await files.change(file);
}

beforeEach(async () => {
  folder = await fs.mkdtemp(path.join(os.tmpdir(), "kalandra-log-"));
  home.folder = folder;
  file = path.join(folder, "Client.txt");
  createWatcher();
});

afterEach(async () => {
  await watcher.restart("", false);
  onPlatform(PLATFORM);
  vi.restoreAllMocks();
  unreadableFiles.clear();
  await fs.rm(folder, { recursive: true, force: true });
});

describe("GameLogWatcher.restart", () => {
  it("follows the file again after reading is turned off and on with the same path", async () => {
    await fs.writeFile(file, "an old line\n");

    await watcher.restart(file, true);
    expect(files.watched).toEqual([file]);
    await watcher.restart(file, false);
    expect(files.watched).toEqual([]);
    await watcher.restart(file, true);
    expect(files.watched).toEqual([file]);

    await fs.appendFile(file, "a new line\n");
    await files.change(file);
    expect(server.gameLogLines()).toEqual(["a new line"]);
  });

  it("opens the file on the next restart with the same path after the open failed", async () => {
    await watcher.restart(file, true);
    expect(files.watched).toEqual([]);
    expect(logger.history).toContain("Failed to watch file: ENOENT");

    await fs.writeFile(file, "");
    await watcher.restart(file, true);
    expect(files.watched).toEqual([file]);
  });

  it("looks for the default file again on the next restart after none was found", async () => {
    const standalone = path.join(folder, "standalone", "Client.txt");
    const steam = path.join(folder, "steam", "Client.txt");
    createWatcher([standalone, steam]);

    await watcher.restart("", true);
    expect(files.watched).toEqual([]);
    expect(logger.history).toContain("No log file found");

    await fs.mkdir(path.dirname(steam));
    await fs.writeFile(steam, "");
    await watcher.restart("", true);
    expect(files.watched).toEqual([steam]);
  });

  it("logs why a default log file cannot be read, and then that none was found", async () => {
    const standalone = path.join(folder, "standalone", "Client.txt");
    const steam = path.join(folder, "steam", "Client.txt");
    unreadableFiles.add(steam);
    createWatcher([standalone, steam]);

    await watcher.restart("", true);

    expect(files.watched).toEqual([]);
    expect(logger.history).toContain(
      `warn [GameLogWatcher] Cannot read a default log file: EACCES: permission denied, access '${steam}'`,
    );
    expect(logger.history).not.toContain(standalone);
    expect(logger.history).toContain("No log file found");
  });

  it("keeps the open file and its read position on a restart with the same path", async () => {
    await fs.writeFile(file, "an old line\n");
    await watcher.restart(file, true);
    await fs.appendFile(file, "a new line\n");

    await watcher.restart(file, true);
    await files.change(file);

    expect(server.gameLogLines()).toEqual(["a new line"]);
  });

  it("names both default log files and follows neither when both exist", async () => {
    const standalone = path.join(folder, "standalone", "Client.txt");
    const steam = path.join(folder, "steam", "Client.txt");
    for (const log of [standalone, steam]) {
      await fs.mkdir(path.dirname(log));
      await fs.writeFile(log, "");
    }
    createWatcher([standalone, steam]);

    await watcher.restart("", true);

    expect(files.watched).toEqual([]);
    expect(logger.history).toContain(
      "error [GameLogWatcher] Found 2 log files, please enter one into settings:",
    );
    expect(logger.history).toContain(standalone);
    expect(logger.history).toContain(steam);
  });

  it("stops a read in progress without an error when reading is turned off", async () => {
    await fs.writeFile(file, "");
    await watcher.restart(file, true);
    await fs.writeFile(file, "a line\n".repeat(100_000));

    const read = files.change(file);
    await watcher.restart(file, false);
    await read;

    expect(logger.history).not.toContain("Failed to read");
    expect(server.gameLogLines().length).toBeLessThan(100_000);
  });
});

// The watcher reads at most 64 KiB at a time
describe("GameLogWatcher reads", () => {
  const READ_BYTES = 64 * 1024;

  it("sends a line that the end of a read cuts in two as one line", async () => {
    const first = "a".repeat(READ_BYTES - 20);
    const cut =
      "2026/10/19 05:00:00 1 abc [INFO Client 1] : You have entered Clearfell.";
    await followAndWrite(`${first}\n${cut}\n`);

    expect(server.gameLogLines()).toEqual([first, cut]);
  });

  it("decodes a character that the end of a read cuts in two", async () => {
    const first = "a".repeat(READ_BYTES - 2);
    const cut = "€ starts one byte before the end of the first read";
    await followAndWrite(`${first}\n${cut}\n`);

    expect(server.gameLogLines()).toEqual([first, cut]);
  });

  it("skips a line longer than the longest line it keeps", async () => {
    await followAndWrite(`${"x".repeat(MAX_LINE_BYTES * 2)}\nthe next line\n`);

    expect(server.gameLogLines()).toEqual(["the next line"]);
    expect(logger.history).toContain(
      `Skipped a line longer than ${MAX_LINE_BYTES} bytes`,
    );
  });

  it("starts at the end of the file it opens", async () => {
    await fs.writeFile(file, "an old line\n");
    await watcher.restart(file, true);

    await files.change(file);
    expect(server.gameLogLines()).toEqual([]);
  });
});

describe("GameLogWatcher after the log changes on disk", () => {
  it("drops the partial last line and reads from the start after the log gets shorter", async () => {
    const oldLines = Array<string>(20).fill("an old line");
    await followAndWrite(`${oldLines.join("\n")}\nhalf of an old li`);
    expect(server.gameLogLines()).toEqual(oldLines);

    await fs.writeFile(file, "a new line\n");
    await files.change(file);
    expect(server.gameLogLines()).toEqual([...oldLines, "a new line"]);
    expect(logger.history).toContain("The log file got shorter");
  });

  it("reads the new file from the start after the log is deleted and written again", async () => {
    await fs.writeFile(file, "an old line\n");
    await watcher.restart(file, true);

    const line = "a new line that is longer than the whole old file";
    await fs.rm(file);
    await fs.writeFile(file, `${line}\n`);
    await files.change(file);

    expect(server.gameLogLines()).toEqual([line]);
    expect(logger.history).toContain("The log file was replaced");
    expect(logger.history).not.toContain("Failed to read");
  });

  it("reads the file it has open while the log is deleted and not written again", async () => {
    await fs.writeFile(file, "");
    await watcher.restart(file, true);
    await fs.writeFile(file, "an old line\n");

    await fs.rm(file);
    await files.change(file);

    expect(server.gameLogLines()).toEqual(["an old line"]);
    expect(logger.history).not.toContain("Failed to read");
  });

  // Writes a new log, then deletes it as the watcher opens it, and fails that open with openError
  async function changeWhileNewLogIsDeleted(openError?: Error) {
    await fs.writeFile(file, "");
    await watcher.restart(file, true);
    await fs.writeFile(file, "an old line\n");
    await fs.rm(file);
    await fs.writeFile(file, "a new line\n");

    const open = fs.open;
    vi.spyOn(fs, "open").mockImplementationOnce(async (...args) => {
      await fs.rm(file);
      if (openError) throw openError;
      return await open(...args);
    });
    await files.change(file);
  }

  function epermError(): Error {
    const err = new Error("EPERM: operation not permitted, open");
    return Object.assign(err, { code: "EPERM" });
  }

  it("reads the file it has open when the new log is deleted before it opens", async () => {
    await changeWhileNewLogIsDeleted();

    expect(server.gameLogLines()).toEqual(["an old line"]);
    expect(logger.history).not.toContain("Failed to read");
  });

  it("reads the file it has open when Windows fails the open of the new log as it deletes it", async () => {
    onPlatform("win32");
    await changeWhileNewLogIsDeleted(epermError());

    expect(server.gameLogLines()).toEqual(["an old line"]);
    expect(logger.history).not.toContain("Failed to read");
  });

  it("logs a failed read when the open of the new log fails with EPERM outside Windows", async () => {
    onPlatform("linux");
    await changeWhileNewLogIsDeleted(epermError());

    expect(logger.history).toContain("Failed to read the log file: EPERM");
  });
});

describe("GameLogWatcher after a failed open of a new log", () => {
  // Deletes the log and writes it again, so the next change opens the new file with fs.open
  async function replaceLog() {
    await fs.writeFile(file, "");
    await watcher.restart(file, true);
    await fs.rm(file);
    await fs.writeFile(file, "a new line\n");
  }

  it("logs the error and reads the new log at the next change", async () => {
    await replaceLog();
    const err = new Error("EACCES: permission denied, open");
    vi.spyOn(fs, "open").mockRejectedValueOnce(
      Object.assign(err, { code: "EACCES" }),
    );

    await files.change(file);
    expect(logger.history).toContain(
      "error [GameLogWatcher] Failed to read the log file: EACCES",
    );
    expect(server.gameLogLines()).toEqual([]);

    await files.change(file);
    expect(server.gameLogLines()).toEqual(["a new line"]);
  });

  it("closes the new log when reading is turned off while it opens", async () => {
    await replaceLog();
    const opened: fs.FileHandle[] = [];
    const open = fs.open;
    vi.spyOn(fs, "open").mockImplementationOnce(async (...args) => {
      await watcher.restart(file, false);
      const log = await open(...args);
      opened.push(log);
      return log;
    });

    await files.change(file);

    expect(opened.map((log) => log.fd)).toEqual([-1]);
    expect(server.gameLogLines()).toEqual([]);
    expect(logger.history).not.toContain("The log file was replaced");
  });
});

describe("the default FileWatch", () => {
  it("polls the log every 450 ms with fs.watchFile until reading is turned off", async () => {
    watcher = new GameLogWatcher(server, logger);
    await fs.writeFile(file, "");
    await watcher.restart(file, true);
    expect(polls.get(file)?.interval).toBe(450);

    await fs.writeFile(file, "a new line\n");
    polls.get(file)?.listener();
    await vi.waitFor(() => {
      expect(server.gameLogLines()).toEqual(["a new line"]);
    });

    await watcher.restart(file, false);
    expect(polls.has(file)).toBe(false);
  });
});

describe("the default log files", () => {
  it("are the standalone and Steam logs on Windows", () => {
    expect(defaultLogFiles("win32")).toEqual([
      "C:\\Program Files (x86)\\Grinding Gear Games\\Path of Exile 2\\logs\\Client.txt",
      "C:\\Program Files (x86)\\Steam\\steamapps\\common\\Path of Exile 2\\logs\\Client.txt",
    ]);
  });

  it("are the Wine and Steam logs under the home folder on Linux", () => {
    expect(defaultLogFiles("linux")).toEqual([
      path.join(
        folder,
        ".wine/drive_c/Program Files (x86)/Grinding Gear Games/Path of Exile 2/logs/Client.txt",
      ),
      path.join(
        folder,
        ".local/share/Steam/steamapps/common/Path of Exile 2/logs/Client.txt",
      ),
    ]);
  });

  it.each([
    ["log", false],
    ["unreadable log", true],
  ])(
    "are none on macOS, where a restart without a path ignores the %s of the Path of Exile 1 Mac client",
    async (_, unreadable) => {
      const macLog = path.join(
        folder,
        "Library/Caches/com.GGG.PathOfExile/Logs/Client.txt",
      );
      await fs.mkdir(path.dirname(macLog), { recursive: true });
      await fs.writeFile(macLog, "");
      if (unreadable) unreadableFiles.add(macLog);
      createWatcher(defaultLogFiles("darwin"));

      await watcher.restart("", true);

      expect(files.watched).toEqual([]);
      expect(logger.history).not.toContain("warn");
      expect(logger.history).toContain(
        "error [GameLogWatcher] No log file found",
      );
    },
  );
});
