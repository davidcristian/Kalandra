import { promises as fs } from "fs";
import * as os from "os";
import * as path from "path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FileWriter } from "../src/host-files/FileWriter";
import { Logger } from "../src/RemoteLogger";
import { FakeServer } from "./fake-server";

vi.mock("electron", async () => {
  const os = await import("node:os");
  return { app: { getPath: () => os.tmpdir() } };
});

let folder = "";
let server: FakeServer;
let logger: Logger;
let writer: FileWriter;

beforeEach(async () => {
  folder = await fs.mkdtemp(path.join(os.tmpdir(), "kalandra-writer-"));
  server = new FakeServer();
  logger = new Logger(server);
  writer = new FileWriter(server, logger);
});

afterEach(async () => {
  await writer.restart(false, null);
  await fs.rm(folder, { recursive: true, force: true });
});

async function readText(file: string): Promise<string> {
  try {
    return await fs.readFile(file, "utf8");
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return "";
    throw err;
  }
}

function sendEntry(ts: number) {
  server.emit("CLIENT->MAIN::write-data", {
    action: "client-log-event",
    data: { ts, ms: 0, type: "log" },
    close: false,
  });
}

// The first entry opens client-log.ndjson without waiting for the open, so it can be lost
async function writeEntries(dir: string, opening: number, written: number) {
  const file = path.join(dir, "client-log.ndjson");
  sendEntry(opening);
  await vi.waitFor(() => fs.access(file));
  sendEntry(written);
  await vi.waitFor(async () =>
    expect(await readText(file)).toContain(`"ts":${written}`),
  );
}

async function startSession(dir: string) {
  server.emit("CLIENT->MAIN::write-data", {
    action: "session",
    start: true,
    name: "session",
    header: "a header",
  });
  await vi.waitFor(async () =>
    expect(await readText(path.join(dir, "session.csv"))).toContain("a header"),
  );
}

describe("FileWriter.restart", () => {
  it("writes client log entries to the new folder after the folder changes", async () => {
    const first = path.join(folder, "first");
    const second = path.join(folder, "second");
    await fs.mkdir(first);
    await fs.mkdir(second);

    await writer.restart(true, first);
    await writeEntries(first, 1, 2);
    await writer.restart(true, second);
    await writeEntries(second, 3, 4);

    const old = await readText(path.join(first, "client-log.ndjson"));
    expect(old).toContain('"ts":2');
    expect(old).not.toContain('"ts":3');
    expect(old).not.toContain('"ts":4');
  });

  it("keeps the client log file open when a restart changes nothing", async () => {
    const file = path.join(folder, "client-log.ndjson");
    await writer.restart(true, folder);
    await writeEntries(folder, 1, 2);

    await writer.restart(true, folder);
    sendEntry(3);

    await vi.waitFor(async () =>
      expect(await readText(file)).toContain('"ts":3'),
    );
    expect(await readText(file)).toContain('"ts":2');
  });

  it("closes the session and client log files when the feature is turned off", async () => {
    await writer.restart(true, folder);
    await startSession(folder);
    await writeEntries(folder, 1, 2);

    await writer.restart(false, folder);

    expect(logger.history).toContain("Channel item closed.");
    expect(logger.history).toContain("Channel client-log closed.");
  });

  it("keeps the session file in its folder until the session stops", async () => {
    const second = path.join(folder, "second");
    await writer.restart(true, folder);
    await startSession(folder);

    await writer.restart(true, second);
    server.emit("CLIENT->MAIN::write-data", {
      action: "log-item",
      text: "a row after the folder change",
    });

    await vi.waitFor(async () =>
      expect(await readText(path.join(folder, "session.csv"))).toContain(
        "a row after the folder change",
      ),
    );
  });
});
