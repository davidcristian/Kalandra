import { app } from "electron";
import * as fs from "fs";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { UpdateInfo } from "../../ipc/types";
import { Logger } from "../src/RemoteLogger";
import { server, startServer } from "../src/server";
import { FakeServer } from "./fake-server";
import { firstMessages, get } from "./request";

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
let port = 0;

beforeAll(async () => {
  port = await startServer(updater, new Logger(new FakeServer()));
});

afterAll(() => {
  server.close();
  fs.rmSync(app.getPath("userData"), { recursive: true, force: true });
});

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
