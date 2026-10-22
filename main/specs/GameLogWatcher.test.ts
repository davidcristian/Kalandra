import { promises as fs } from "fs";
import * as os from "os";
import * as path from "path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  GameLogWatcher,
  type FileWatch,
} from "../src/host-files/GameLogWatcher";
import { MAX_LINE_BYTES } from "../src/host-files/LineSplitter";
import { Logger } from "../src/RemoteLogger";
import { FakeServer } from "./fake-server";

vi.mock("electron", async () => {
  const os = await import("node:os");
  return { app: { getPath: () => os.tmpdir() } };
});

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
  file = path.join(folder, "Client.txt");
  createWatcher();
});

afterEach(async () => {
  await watcher.restart("", false);
  vi.restoreAllMocks();
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

  it.runIf(process.platform === "win32")(
    "reads the file it has open when Windows fails the open of the new log as it deletes it",
    async () => {
      await changeWhileNewLogIsDeleted(epermError());

      expect(server.gameLogLines()).toEqual(["an old line"]);
      expect(logger.history).not.toContain("Failed to read");
    },
  );

  it.skipIf(process.platform === "win32")(
    "logs a failed read when the open of the new log fails with EPERM outside Windows",
    async () => {
      await changeWhileNewLogIsDeleted(epermError());

      expect(logger.history).toContain("Failed to read the log file: EPERM");
    },
  );
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
