import { EventEmitter } from "events";
import { promises as fs } from "fs";
import * as os from "os";
import * as path from "path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { IpcEvent, IpcEventPayload } from "../../ipc/types";
import type { ServerEvents } from "../src/server";
import { FileWriter } from "../src/host-files/FileWriter";
import { GameLogWatcher } from "../src/host-files/GameLogWatcher";
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
