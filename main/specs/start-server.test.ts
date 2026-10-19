import { app } from "electron";
import * as fs from "fs";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { IpcEvent, UpdateInfo } from "../../ipc/types";
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
const handled: IpcEvent["name"][] = [];
let lastEventHandled = () => {};
let port = 0;

beforeAll(async () => {
  port = await startServer(updater, logger);
  onEventAnyClient("OVERLAY->MAIN::focus-game", () => {
    handled.push("OVERLAY->MAIN::focus-game");
  });
  onEventAnyClient("OVERLAY->MAIN::render-state", () => {
    handled.push("OVERLAY->MAIN::render-state");
  });
  onEventAnyClient("CLIENT->MAIN::user-action", () => {
    lastEventHandled();
  });
});

afterAll(() => {
  server.close();
  fs.rmSync(app.getPath("userData"), { recursive: true, force: true });
});

// Sends two overlay events and then a client event, and resolves the overlay events main handled before it
async function sendOverlayEvents(
  userAgent?: string,
): Promise<IpcEvent["name"][]> {
  handled.length = 0;
  const socket = await openClient(port, userAgent);
  const lastEvent = new Promise<void>((resolve) => {
    lastEventHandled = resolve;
  });
  const events: IpcEvent[] = [
    { name: "OVERLAY->MAIN::focus-game", payload: undefined },
    { name: "OVERLAY->MAIN::render-state", payload: { shouldShow: true } },
    {
      name: "CLIENT->MAIN::user-action",
      payload: { action: "check-for-update" },
    },
  ];
  for (const event of events) {
    socket.send(JSON.stringify(event));
  }
  await lastEvent;
  socket.close();
  return [...handled];
}

describe("startServer", () => {
  it("returns the version and the updater state at GET /config", async () => {
    const reply = await get(port, "/config");

    expect(JSON.parse(reply.body)).toEqual({
      version: "1.2.3",
      updater: { state: "checking-for-update" },
      contents: null,
    });
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
