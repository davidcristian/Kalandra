import { EventEmitter } from "events";
import { promises as fs } from "fs";
import * as os from "os";
import * as path from "path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { IpcEvent, IpcEventPayload } from "../../ipc/types";
import type { ServerEvents } from "../src/server";
import { FileWriter } from "../src/host-files/FileWriter";
import { GameLogWatcher } from "../src/host-files/GameLogWatcher";
import { MAX_LINE_BYTES } from "../src/host-files/LineSplitter";
import { Logger } from "../src/RemoteLogger";

vi.mock("electron", async () => {
  const os = await import("node:os");
  return { app: { getPath: () => os.tmpdir() } };
});

class FakeServer implements ServerEvents {
  readonly sent: IpcEvent[] = [];
  private readonly bus = new EventEmitter();

  onEventAnyClient: ServerEvents["onEventAnyClient"] = (name, cb) => {
    this.bus.on(name, cb);
  };

  sendEventTo: ServerEvents["sendEventTo"] = (_target, event) => {
    this.sent.push(event);
  };

  emit<Name extends IpcEvent["name"]>(
    name: Name,
    payload: IpcEventPayload<Name>,
  ) {
    this.bus.emit(name, payload);
  }

  gameLogLines(): string[] {
    return this.sent.flatMap((event) =>
      event.name === "MAIN->CLIENT::game-log" ? event.payload.lines : [],
    );
  }
}

let folder = "";
let logger: Logger;
let server: FakeServer;
let watcher: GameLogWatcher;

function createWatcher(possiblePaths?: string[]) {
  server = new FakeServer();
  logger = new Logger(server);
  watcher = new GameLogWatcher(
    server,
    logger,
    new FileWriter(server, logger),
    possiblePaths,
  );
}

beforeEach(async () => {
  folder = await fs.mkdtemp(path.join(os.tmpdir(), "kalandra-log-"));
  createWatcher();
});

afterEach(async () => {
  await watcher.restart("", false);
  await fs.rm(folder, { recursive: true, force: true });
});

describe("GameLogWatcher.restart", () => {
  it("follows the file again after reading is turned off and on with the same path", async () => {
    const file = path.join(folder, "Client.txt");
    await fs.writeFile(file, "an old line\n");

    await watcher.restart(file, true);
    expect(watcher.actualPath).toBe(file);
    await watcher.restart(file, false);
    expect(watcher.actualPath).toBeNull();
    await watcher.restart(file, true);
    expect(watcher.actualPath).toBe(file);

    // fs.watchFile misses an append made before its first stat, so each try appends again
    await vi.waitFor(
      async () => {
        await fs.appendFile(file, "a new line\n");
        expect(server.gameLogLines()).toContain("a new line");
      },
      { timeout: 4000, interval: 250 },
    );
    expect(server.gameLogLines()).not.toContain("an old line");
  });

  it("opens the file on the next restart with the same path after the open failed", async () => {
    const file = path.join(folder, "Client.txt");

    await watcher.restart(file, true);
    expect(watcher.actualPath).toBeNull();
    expect(logger.history).toContain("Failed to watch file.");

    await fs.writeFile(file, "");
    await watcher.restart(file, true);
    expect(watcher.actualPath).toBe(file);
  });

  it("looks for the default file again on the next restart after none was found", async () => {
    const standalone = path.join(folder, "standalone", "Client.txt");
    const steam = path.join(folder, "steam", "Client.txt");
    createWatcher([standalone, steam]);

    await watcher.restart("", true);
    expect(watcher.actualPath).toBeNull();
    expect(logger.history).toContain("No log file found");

    await fs.mkdir(path.dirname(steam));
    await fs.writeFile(steam, "");
    await watcher.restart("", true);
    expect(watcher.actualPath).toBe(steam);
  });

  it("stops a read in progress without an error when reading is turned off", async () => {
    const file = path.join(folder, "Client.txt");
    await fs.writeFile(file, "a line\n".repeat(100_000));
    await watcher.restart(file, true);

    server.emit("CLIENT->MAIN::re-parse-log", undefined);
    await watcher.restart(file, false);

    expect(logger.history).not.toContain("Failed to read");
    expect(server.gameLogLines().length).toBeLessThan(100_000);
  });
});

// The watcher reads at most 64 KiB at a time, and a re-parse reads the whole file from the start
describe("GameLogWatcher reads", () => {
  const READ_BYTES = 64 * 1024;

  async function reparse(content: string) {
    const file = path.join(folder, "Client.txt");
    await fs.writeFile(file, content);
    await watcher.restart(file, true);
    server.emit("CLIENT->MAIN::re-parse-log", undefined);
  }

  it("sends a line that the end of a read cuts in two as one line", async () => {
    const first = "a".repeat(READ_BYTES - 20);
    const cut =
      "2026/10/19 05:00:00 1 abc [INFO Client 1] : You have entered Clearfell.";
    await reparse(`${first}\n${cut}\n`);

    await vi.waitFor(() => expect(server.gameLogLines()).toEqual([first, cut]));
  });

  it("decodes a character that the end of a read cuts in two", async () => {
    const first = "a".repeat(READ_BYTES - 2);
    const cut = "€ starts one byte before the end of the first read";
    await reparse(`${first}\n${cut}\n`);

    await vi.waitFor(() => expect(server.gameLogLines()).toEqual([first, cut]));
  });

  it("skips a line longer than the longest line it keeps", async () => {
    await reparse(`${"x".repeat(MAX_LINE_BYTES * 2)}\nthe next line\n`);

    await vi.waitFor(() =>
      expect(server.gameLogLines()).toEqual(["the next line"]),
    );
    expect(logger.history).toContain(
      `Skipped a line longer than ${MAX_LINE_BYTES} bytes`,
    );
  });

  it("drops the partial last line when the log is read again", async () => {
    await reparse("a whole line\nhalf a li");
    await vi.waitFor(() =>
      expect(server.gameLogLines()).toEqual(["a whole line"]),
    );

    // A re-parse sent while the last one still reads is skipped, so the test sends it until one runs
    await vi.waitFor(
      () => {
        server.emit("CLIENT->MAIN::re-parse-log", undefined);
        expect(server.gameLogLines().length).toBeGreaterThan(1);
      },
      { interval: 100 },
    );
    expect(new Set(server.gameLogLines())).toEqual(new Set(["a whole line"]));
  });
});
