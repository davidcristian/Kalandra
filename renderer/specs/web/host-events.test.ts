import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import type { IpcEvent } from "@ipc/types";
import type * as IPC from "@/web/background/IPC";

const OVERLAY_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) kalandra/1.2.3 Chrome/138.0.7204.235 Electron/37.4.0 Safari/537.36";
const BROWSER_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36";

/** Stands in for the browser's WebSocket: opens at once, keeps the text the page sends and passes on main's messages. */
class FakeWebSocket {
  static readonly sent: string[] = [];
  static readonly created: FakeWebSocket[] = [];
  onopen: (e: Event) => void = () => {};
  onmessage: (e: { data: string }) => void = () => {};
  onclose: (e: { code: number }) => void = () => {};
  readonly isOpen: Promise<void>;

  constructor() {
    FakeWebSocket.created.push(this);
    this.isOpen = new Promise((resolve) => {
      queueMicrotask(() => {
        this.onopen(new Event("open"));
        resolve();
      });
    });
  }

  send(text: string) {
    FakeWebSocket.sent.push(text);
  }

  receive(event: IpcEvent) {
    this.onmessage({ data: JSON.stringify(event) });
  }
}

let Host: typeof IPC.Host;
let LOG_LINES: typeof IPC.LOG_LINES;

// Vue reads document on import when window exists, so the stubs come after the import
beforeAll(async () => {
  ({ Host, LOG_LINES } = await vi.importActual<typeof IPC>(
    "@/web/background/IPC",
  ));
  vi.stubGlobal("window", { location: { host: "localhost:4000" } });
  vi.stubGlobal("WebSocket", FakeWebSocket);
  await Host.init();
});

afterEach(() => {
  vi.unstubAllGlobals();
  FakeWebSocket.sent.length = 0;
});

// Sends an overlay event and a client event from a page with this User-Agent, and returns the names sent to main
function namesSentFrom(userAgent: string): string[] {
  vi.stubGlobal("navigator", { userAgent });
  Host.sendEvent({ name: "OVERLAY->MAIN::focus-game", payload: undefined });
  Host.sendEvent({
    name: "CLIENT->MAIN::used-recently",
    payload: { isOverlay: false },
  });
  return FakeWebSocket.sent.map((text) => (JSON.parse(text) as IpcEvent).name);
}

describe("Host.sendEvent", () => {
  it("sends overlay events from the overlay window", () => {
    expect(namesSentFrom(OVERLAY_USER_AGENT)).toEqual([
      "OVERLAY->MAIN::focus-game",
      "CLIENT->MAIN::used-recently",
    ]);
  });

  it("sends no overlay event from a browser tab", () => {
    expect(namesSentFrom(BROWSER_USER_AGENT)).toEqual([
      "CLIENT->MAIN::used-recently",
    ]);
  });
});

// main sends its history in one message when the page connects, then one message per entry
function receiveLog(...messages: string[]): string[] {
  Host.logs.value = "";
  for (const message of messages) {
    Host.selfDispatch({
      name: "MAIN->CLIENT::log-entry",
      payload: { message },
    });
  }
  return Host.logs.value.split("\n").filter((line) => line !== "");
}

const entries = (count: number) =>
  Array.from({ length: count }, (_, i) => `[12:00:00] info entry ${i}\n`);

describe("Host.logs", () => {
  it("keeps every line of main's log up to the limit", () => {
    const lines = receiveLog(
      entries(LOG_LINES - 1).join(""),
      "[12:00:01] info last\n",
    );

    expect(lines).toHaveLength(LOG_LINES);
    expect(lines[0]).toBe("[12:00:00] info entry 0");
    expect(lines.at(-1)).toBe("[12:00:01] info last");
  });

  it("drops the oldest lines past the limit", () => {
    const lines = receiveLog(
      entries(LOG_LINES).join(""),
      "[12:00:01] info first new\n",
      "[12:00:02] info second new\n",
    );

    expect(lines).toHaveLength(LOG_LINES);
    expect(lines[0]).toBe("[12:00:00] info entry 2");
    expect(lines.at(-1)).toBe("[12:00:02] info second new");
  });
});

const logEntry = (message: string): IpcEvent => ({
  name: "MAIN->CLIENT::log-entry",
  payload: { message },
});

describe("Host.logs after a reconnect", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("replaces the page's copy with the history main sends to the new socket", async () => {
    vi.stubGlobal("WebSocket", FakeWebSocket);
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    const first = FakeWebSocket.created.at(-1)!;
    first.receive(logEntry("[12:00:00] info before\n"));

    first.onclose({ code: 1006 });
    vi.runOnlyPendingTimers();
    const second = FakeWebSocket.created.at(-1)!;
    await second.isOpen;
    second.receive(
      logEntry("[12:00:00] info before\n[12:00:01] info while closed\n"),
    );

    expect(second).not.toBe(first);
    expect(Host.logs.value).toBe(
      "[12:00:00] info before\n[12:00:01] info while closed\n",
    );
  });
});
