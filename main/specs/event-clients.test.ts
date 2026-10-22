import { app } from "electron";
import * as fs from "fs";
import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import type { IpcEvent, UpdateInfo } from "../../ipc/types";
import { Logger } from "../src/RemoteLogger";
import {
  onEventAnyClient,
  sendEventTo,
  server,
  startServer,
} from "../src/server";
import { FakeServer } from "./fake-server";
import { EventClient } from "./request";

vi.mock("electron", async () => {
  const fs = await import("node:fs");
  const os = await import("node:os");
  const path = await import("node:path");
  const userData = fs.mkdtempSync(path.join(os.tmpdir(), "kalandra-events-"));
  return { app: { getPath: () => userData, getVersion: () => "1.2.3" } };
});

const logger = new Logger(new FakeServer());
const opened: EventClient[] = [];
let usedRecentlyWaiters: Array<{
  isOverlay: boolean;
  resolve: () => void;
}> = [];
let port = 0;

beforeAll(async () => {
  logger.write("info [test] an entry written before the page connects");
  const updater: { info: UpdateInfo } = {
    info: { state: "update-not-available", checkedAt: 1 },
  };
  port = await startServer(updater, logger);
  onEventAnyClient("CLIENT->MAIN::used-recently", (e) => {
    const matching = usedRecentlyWaiters.filter(
      (w) => w.isOverlay === e.isOverlay,
    );
    usedRecentlyWaiters = usedRecentlyWaiters.filter(
      (w) => w.isOverlay !== e.isOverlay,
    );
    for (const waiter of matching) waiter.resolve();
  });
});

// A test that closes a client waits until main has handled that close, but the others close theirs here
afterEach(() => {
  for (const client of opened.splice(0)) client.close();
});

afterAll(() => {
  server.close();
  fs.rmSync(app.getPath("userData"), { recursive: true, force: true });
});

// Opens a client and reads the two events main sends to each new client
async function connect(): Promise<EventClient> {
  const client = await EventClient.open(port);
  opened.push(client);
  await client.next();
  await client.next();
  return client;
}

// Resolves when a handler in main receives a used-recently event with this payload
async function usedRecentlyHandled(isOverlay: boolean): Promise<void> {
  await new Promise<void>((resolve) => {
    usedRecentlyWaiters.push({ isOverlay, resolve });
  });
}

const action = (target: string): IpcEvent => ({
  name: "MAIN->CLIENT::widget-action",
  payload: { target },
});

describe("a new /events client", () => {
  it("receives main's log history and then the updater state", async () => {
    const client = await EventClient.open(port);
    opened.push(client);

    expect(await client.next()).toEqual({
      name: "MAIN->CLIENT::log-entry",
      payload: { message: logger.history },
    });
    expect(logger.history).toContain(
      "info [test] an entry written before the page connects",
    );
    expect(await client.next()).toEqual({
      name: "MAIN->CLIENT::updater-state",
      payload: { state: "update-not-available", checkedAt: 1 },
    });
  });
});

describe("the last active client", () => {
  it("is the client that connected last, and a broadcast reaches every client", async () => {
    const first = await connect();
    const second = await connect();

    sendEventTo("last-active", action("last active"));
    sendEventTo("broadcast", action("everyone"));

    expect(await second.next()).toEqual(action("last active"));
    expect(await second.next()).toEqual(action("everyone"));
    expect(await first.next()).toEqual(action("everyone"));
  });

  it("is the client that sent used-recently last", async () => {
    const first = await connect();
    const second = await connect();
    const handled = usedRecentlyHandled(false);
    first.send({
      name: "CLIENT->MAIN::used-recently",
      payload: { isOverlay: false },
    });
    await handled;

    sendEventTo("last-active", action("last active"));
    sendEventTo("broadcast", action("everyone"));

    expect(await first.next()).toEqual(action("last active"));
    expect(await second.next()).toEqual(action("everyone"));
  });

  // The other tests' clients may still be closing, so main sees one client left only once all of them are gone
  it("is the one client left after the others close, which main reports as the overlay window", async () => {
    const remaining = await connect();
    const closing = await connect();
    const handled = usedRecentlyHandled(true);
    closing.close();
    await handled;

    sendEventTo("last-active", action("last active"));

    expect(await remaining.next()).toEqual(action("last active"));
  });
});
