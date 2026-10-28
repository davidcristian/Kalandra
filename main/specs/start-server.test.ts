import { app } from "electron";
import * as fs from "fs";
import type { AddressInfo } from "net";
import * as path from "path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type WebSocket from "ws";
import type { HostState, IpcEvent, UpdateInfo } from "../../ipc/types";
import type { ListenAddress } from "../src/listen-option";
import { Logger } from "../src/RemoteLogger";
import { onEventAnyClient, server, startServer } from "../src/server";
import { FakeServer } from "./fake-server";
import { firstMessages, get, openClient } from "./request";

vi.mock("electron", async () => {
  const fs = await import("node:fs");
  const os = await import("node:os");
  const path = await import("node:path");
  const userData = fs.mkdtempSync(path.join(os.tmpdir(), "kalandra-start-"));
  return { app: { getPath: () => userData, getVersion: () => "1.2.3" } };
});

const updater: { info: UpdateInfo } = {
  info: { state: "checking-for-update" },
};
const OVERLAY_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) kalandra/1.2.3 Chrome/138.0.7204.235 Electron/37.4.0 Safari/537.36";
const BROWSER_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36";
const logger = new Logger(new FakeServer());
const handled: Array<IpcEvent["name"]> = [];
const clientLogEntries: number[] = [];
let lastEventHandled = () => {};
let listened: ListenAddress | undefined;
let port = 0;

beforeAll(async () => {
  listened = await startServer(updater, logger, {
    focus: { game: false, overlay: false },
  });
  port = listened.port;
  onEventAnyClient("OVERLAY->MAIN::focus-game", () => {
    handled.push("OVERLAY->MAIN::focus-game");
  });
  onEventAnyClient("OVERLAY->MAIN::render-state", () => {
    handled.push("OVERLAY->MAIN::render-state");
  });
  onEventAnyClient("CLIENT->MAIN::user-action", () => {
    lastEventHandled();
  });
  onEventAnyClient("CLIENT->MAIN::save-config", () => {
    throw new Error("the handler failed");
  });
  onEventAnyClient("CLIENT->MAIN::write-data", (e) => {
    if (e.action === "client-log-event") clientLogEntries.push(e.data.ms);
  });
});

afterAll(() => {
  server.close();
  fs.rmSync(app.getPath("userData"), { recursive: true, force: true });
});

// Sends these texts and then a client event, and resolves when main has handled that event
async function sendFrom(socket: WebSocket, texts: string[]): Promise<void> {
  const lastEvent = new Promise<void>((resolve) => {
    lastEventHandled = resolve;
  });
  const last: IpcEvent = {
    name: "CLIENT->MAIN::user-action",
    payload: { action: "check-for-update" },
  };
  for (const text of [...texts, JSON.stringify(last)]) {
    socket.send(text);
  }
  await lastEvent;
}

async function sendMessages(
  texts: string[],
  userAgent?: string,
): Promise<void> {
  const socket = await openClient(port, userAgent);
  await sendFrom(socket, texts);
  socket.close();
}

function clientLogEntry(ms: number): string {
  const event: IpcEvent = {
    name: "CLIENT->MAIN::write-data",
    payload: {
      action: "client-log-event",
      data: { ts: 0, ms, type: "game-start" },
    },
  };
  return JSON.stringify(event);
}

// Sends two overlay events, and resolves those main handled
async function sendOverlayEvents(
  userAgent?: string,
): Promise<Array<IpcEvent["name"]>> {
  handled.length = 0;
  const events: IpcEvent[] = [
    { name: "OVERLAY->MAIN::focus-game", payload: undefined },
    { name: "OVERLAY->MAIN::render-state", payload: { shouldShow: true } },
  ];
  await sendMessages(
    events.map((event) => JSON.stringify(event)),
    userAgent,
  );
  return [...handled];
}

// Sends one text, and resolves the log lines main wrote before it handled the client's next event
async function logLinesFor(text: string): Promise<string> {
  const start = logger.history.length;
  await sendMessages([text], OVERLAY_USER_AGENT);
  return logger.history.slice(start);
}

describe("startServer", () => {
  it("resolves the default address it listens on", () => {
    const { address, port: serverPort } = server.address() as AddressInfo;

    expect(listened).toEqual({ host: "127.0.0.1", port: serverPort });
    expect(address).toBe("127.0.0.1");
  });

  it("returns the version and the updater state at GET /config", async () => {
    const reply = await get(port, "/config");

    expect(JSON.parse(reply.body)).toEqual({
      version: "1.2.3",
      updater: { state: "checking-for-update" },
      contents: null,
      configProblem: null,
    });
  });

  it("returns at GET /config the config that a save-config message stored", async () => {
    const contents = JSON.stringify({ configVersion: 1, fontSize: 16 });
    const save: IpcEvent = {
      name: "CLIENT->MAIN::save-config",
      payload: { contents },
    };
    await sendMessages([JSON.stringify(save)]);

    const reply = await get(port, "/config");
    expect((JSON.parse(reply.body) as HostState).contents).toBe(contents);
    const file = path.join(app.getPath("userData"), "apt-data", "config.json");
    expect(fs.readFileSync(file, "utf8")).toBe(contents);
  });

  it("sends a new page the updater state current when it connects", async () => {
    updater.info = { state: "update-not-available", checkedAt: 1 };

    expect(await firstMessages(port, 2)).toContainEqual({
      name: "MAIN->CLIENT::updater-state",
      payload: { state: "update-not-available", checkedAt: 1 },
    });
  });
});

describe("the /events WebSocket", () => {
  it("passes on the overlay events of the overlay window", async () => {
    expect(await sendOverlayEvents(OVERLAY_USER_AGENT)).toEqual([
      "OVERLAY->MAIN::focus-game",
      "OVERLAY->MAIN::render-state",
    ]);
  });

  it("ignores and logs the overlay events of a browser tab", async () => {
    expect(await sendOverlayEvents(BROWSER_USER_AGENT)).toEqual([]);
    expect(logger.history).toContain(
      "warn [server] Ignored OVERLAY->MAIN::render-state from a page outside the overlay window",
    );
  });

  it("ignores the overlay events of a client without a User-Agent", async () => {
    expect(await sendOverlayEvents()).toEqual([]);
  });
});

describe("a message main cannot use", () => {
  it.each([
    ["not json", "warn [server] Ignored a message that is not JSON ("],
    ["null", "warn [server] Ignored a message without an event name"],
    ['{"name":5}', "warn [server] Ignored a message without an event name"],
    [
      '{"name":"error"}',
      "warn [server] Ignored error, which main does not handle",
    ],
    [
      '{"name":"CLIENT->MAIN::unknown"}',
      "warn [server] Ignored CLIENT->MAIN::unknown, which main does not handle",
    ],
  ])("is logged for %s, and the next event is handled", async (text, line) => {
    expect(await logLinesFor(text)).toContain(line);
  });

  it("is logged when its handler throws, and the next event is handled", async () => {
    const event: IpcEvent = {
      name: "CLIENT->MAIN::save-config",
      payload: { contents: "{}" },
    };
    expect(await logLinesFor(JSON.stringify(event))).toContain(
      "error [server] Handling CLIENT->MAIN::save-config failed: the handler failed",
    );
  });
});

describe("client log entries", () => {
  it("are passed on only from the overlay window when a browser tab sends them too", async () => {
    clientLogEntries.length = 0;
    const overlay = await openClient(port, OVERLAY_USER_AGENT);
    // The tab connects last, so it is the last active client
    const tab = await openClient(port, BROWSER_USER_AGENT);
    await sendFrom(tab, [clientLogEntry(1)]);
    await sendFrom(overlay, [clientLogEntry(2)]);
    overlay.close();
    tab.close();
    expect(clientLogEntries).toEqual([2]);
  });
});
