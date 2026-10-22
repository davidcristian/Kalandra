import { promises as fs } from "fs";
import * as os from "os";
import * as path from "path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FileWriter } from "../src/host-files/FileWriter";
import { Logger } from "../src/RemoteLogger";
import { FakeServer } from "./fake-server";
import type { LibrarySessionWrite } from "../../ipc/library";

type StartPayload = Extract<LibrarySessionWrite, { start: true }>;

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
  vi.restoreAllMocks();
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

async function sendEntry(ts: number) {
  await server.emit("CLIENT->MAIN::write-data", {
    action: "client-log-event",
    data: { ts, ms: 0, type: "log" },
    close: false,
  });
}

function entryLines(...stamps: number[]): string {
  return stamps
    .map((ts) => JSON.stringify({ ts, ms: 0, type: "log" }) + "\n")
    .join("");
}

// Sends every entry before main has opened client-log.ndjson, then checks that each one is written
async function writeEntries(dir: string, ...stamps: number[]) {
  await Promise.all(stamps.map(sendEntry));
  expect(await readText(path.join(dir, "client-log.ndjson"))).toBe(
    entryLines(...stamps),
  );
}

async function sendSessionStart(name: string) {
  await server.emit("CLIENT->MAIN::write-data", {
    action: "session",
    start: true,
    name,
    header: "a header",
  });
}

// Delays the first FileHandle write, so a write that main does not wait for ends up last
async function delayFirstWrite() {
  const probe = await fs.open(path.join(folder, "probe"), "w");
  const prototype = Object.getPrototypeOf(probe) as fs.FileHandle;
  await probe.close();
  await fs.rm(path.join(folder, "probe"));
  const write = prototype.write;
  let calls = 0;
  vi.spyOn(prototype, "write").mockImplementation(async function (
    this: fs.FileHandle,
    ...args: Parameters<fs.FileHandle["write"]>
  ) {
    calls += 1;
    if (calls === 1) await new Promise((resolve) => setTimeout(resolve, 50));
    return await write.apply(this, args);
  });
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

    expect(await readText(path.join(first, "client-log.ndjson"))).toBe(
      entryLines(1, 2),
    );
  });

  it("writes an entry to the folder that was set when it was sent", async () => {
    const first = path.join(folder, "first");
    const second = path.join(folder, "second");
    await fs.mkdir(first);
    await fs.mkdir(second);

    await writer.restart(true, first);
    const opening = sendEntry(1);
    await writer.restart(true, second);
    await sendEntry(2);
    await opening;

    expect(await readText(path.join(first, "client-log.ndjson"))).toBe(
      entryLines(1),
    );
    expect(await readText(path.join(second, "client-log.ndjson"))).toBe(
      entryLines(2),
    );
  });

  it("keeps the client log file open when a restart changes nothing", async () => {
    await writer.restart(true, folder);
    await writeEntries(folder, 1, 2);

    await writer.restart(true, folder);
    await sendEntry(3);

    expect(await readText(path.join(folder, "client-log.ndjson"))).toBe(
      entryLines(1, 2, 3),
    );
  });

  it("closes the session and client log files when the feature is turned off", async () => {
    await writer.restart(true, folder);
    await sendSessionStart("session");
    await writeEntries(folder, 1, 2);

    await writer.restart(false, folder);

    expect(logger.history).toContain("Channel item closed.");
    expect(logger.history).toContain("Channel client-log closed.");
  });

  it("keeps the session file in its folder until the session stops", async () => {
    const second = path.join(folder, "second");
    await writer.restart(true, folder);
    await sendSessionStart("session");

    await writer.restart(true, second);
    await server.emit("CLIENT->MAIN::write-data", {
      action: "log-item",
      text: "a row after the folder change",
    });

    expect(await readText(path.join(folder, "session.csv"))).toBe(
      "a header\na row after the folder change\n",
    );
  });

  it("logs a client log file that cannot be opened and handles the next event", async () => {
    const blocker = path.join(folder, "a file");
    await fs.writeFile(blocker, "");
    await writer.restart(true, path.join(blocker, "csv"));
    await sendEntry(1);
    await writer.restart(true, folder);
    await sendEntry(2);

    expect(logger.history).toContain(
      "error [FileWriter] A file operation failed: ",
    );
    expect(await readText(path.join(folder, "client-log.ndjson"))).toBe(
      entryLines(2),
    );
  });

  it("creates the output folder before it opens the client log file", async () => {
    const output = path.join(folder, "apt-data", "csv-data");
    await writer.restart(true, output);

    await writeEntries(output, 1);
  });
});

function sessionReplies() {
  return server.sent.flatMap((event) =>
    event.name === "MAIN->CLIENT::library-session" ? [event.payload] : [],
  );
}

describe("a Library session start", () => {
  it("replies that the session started after it writes the header", async () => {
    await writer.restart(true, folder);
    await sendSessionStart("rolls");

    expect(sessionReplies()).toEqual([
      { sessionName: "rolls", result: "started" },
    ]);
    expect(await readText(path.join(folder, "rolls.csv"))).toBe("a header\n");
  });

  it.each(["a:b", "../outside", "what?", "a|b", "CON", "lpt1", " ", "a\tb"])(
    "replies that %j is not a valid file name and creates no file",
    async (name) => {
      await writer.restart(true, path.join(folder, "csv"));
      await sendSessionStart(name);

      expect(sessionReplies()).toEqual([
        { sessionName: name, result: "invalid-name" },
      ]);
      expect(await fs.readdir(folder)).toEqual([]);
    },
  );

  it("replies that it failed when the output folder cannot be created", async () => {
    const blocker = path.join(folder, "a file");
    await fs.writeFile(blocker, "");
    await writer.restart(true, path.join(blocker, "csv"));
    await sendSessionStart("rolls");

    expect(sessionReplies()).toEqual([
      { sessionName: "rolls", result: "failed" },
    ]);
    expect(logger.history).toContain("Failed to create session file: ");
  });

  it("replies that it failed while Item Data Collection is off", async () => {
    await writer.restart(false, folder);
    await sendSessionStart("rolls");

    expect(sessionReplies()).toEqual([
      { sessionName: "rolls", result: "failed" },
    ]);
    expect(await fs.readdir(folder)).toEqual([]);
  });

  it.each([
    { action: "session", start: true, header: "a header" } as StartPayload,
    { action: "session", start: true, name: "rolls" } as StartPayload,
  ])("replies that it failed to a start without a field: %j", async (e) => {
    await writer.restart(true, folder);
    await server.emit("CLIENT->MAIN::write-data", e);

    expect(sessionReplies()).toEqual([
      { sessionName: e.name, result: "failed" },
    ]);
    expect(logger.history).toContain("Invalid session start event.");
    expect(await fs.readdir(folder)).toEqual([]);
  });
});

describe("FileWriter writes", () => {
  it("writes client log entries in the order they come when a write is slow", async () => {
    await writer.restart(true, folder);
    await delayFirstWrite();

    await writeEntries(folder, 1, 2);
  });

  it("writes a session row after the header when the header write is slow", async () => {
    await writer.restart(true, folder);
    await delayFirstWrite();

    const started = sendSessionStart("rolls");
    await server.emit("CLIENT->MAIN::write-data", {
      action: "log-item",
      text: "a row",
    });
    await started;

    expect(await readText(path.join(folder, "rolls.csv"))).toBe(
      "a header\na row\n",
    );
  });
});
