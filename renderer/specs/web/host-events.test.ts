import { present } from "@specs/present";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import type { ConfigProblem } from "@ipc/config-problem";
import type { HostState, IpcEvent } from "@ipc/types";
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
    const first = present(FakeWebSocket.created.at(-1));
    first.receive(logEntry("[12:00:00] info before\n"));

    first.onclose({ code: 1006 });
    vi.runOnlyPendingTimers();
    const second = present(FakeWebSocket.created.at(-1));
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

// Each test after the reconnect test reads the socket that test opened
const socket = () => present(FakeWebSocket.created.at(-1));

describe("Host.unregisteredHotkeys", () => {
  it("keeps the last list of hotkeys main did not register", () => {
    socket().receive({
      name: "MAIN->CLIENT::unregistered-hotkeys",
      payload: { hotkeys: [{ shortcut: "Ctrl + F", reason: "game-key" }] },
    });
    expect(Host.unregisteredHotkeys.value).toEqual([
      { shortcut: "Ctrl + F", reason: "game-key" },
    ]);

    socket().receive({
      name: "MAIN->CLIENT::unregistered-hotkeys",
      payload: { hotkeys: [] },
    });
    expect(Host.unregisteredHotkeys.value).toEqual([]);
  });
});

describe("Host.onEvent", () => {
  it("passes each message of main to the listeners of its name until their controller aborts", () => {
    const targets: string[] = [];
    const listener = Host.onEvent("MAIN->CLIENT::widget-action", (e) => {
      targets.push(e.target);
    });

    socket().receive({
      name: "MAIN->CLIENT::widget-action",
      payload: { target: "price-check" },
    });
    socket().receive({
      name: "MAIN->CLIENT::config-changed",
      payload: { contents: "{}" },
    });
    listener.abort();
    socket().receive({
      name: "MAIN->CLIENT::widget-action",
      payload: { target: "after the abort" },
    });

    expect(targets).toEqual(["price-check"]);
  });
});

// Listens for an overlay event in a page with this User-Agent, and returns the payloads it received
function overlayEventsIn(userAgent: string): boolean[] {
  vi.stubGlobal("navigator", { userAgent });
  const received: boolean[] = [];
  const listener = Host.onEvent("MAIN->OVERLAY::visibility", (e) => {
    received.push(e.isVisible);
  });
  socket().receive({
    name: "MAIN->OVERLAY::visibility",
    payload: { isVisible: false },
  });
  listener.abort();
  return received;
}

describe("Host.onEvent for an overlay event", () => {
  it("passes it in the overlay window", () => {
    expect(overlayEventsIn(OVERLAY_USER_AGENT)).toEqual([false]);
  });

  it("passes nothing in a browser tab", () => {
    expect(overlayEventsIn(BROWSER_USER_AGENT)).toEqual([]);
  });
});

describe("Host.updateInfo", () => {
  it("is the updater state that main sent last", () => {
    socket().receive({
      name: "MAIN->CLIENT::updater-state",
      payload: { state: "update-downloaded", version: "1.2.4" },
    });

    expect(Host.updateInfo.value).toEqual({
      state: "update-downloaded",
      version: "1.2.4",
    });
  });
});

describe("Host.getConfig", () => {
  it("returns the saved config and keeps main's version and updater state", async () => {
    const state: HostState = {
      version: "1.2.3",
      updater: { state: "checking-for-update" },
      contents: '{"configVersion":1}',
      configProblem: null,
    };
    vi.stubGlobal("fetch", async (input: RequestInfo | URL) =>
      String(input) === "/config"
        ? new Response(JSON.stringify(state))
        : new Response(null, { status: 404 }),
    );

    expect(await Host.getConfig()).toBe('{"configVersion":1}');
    expect(Host.version.value).toBe("1.2.3");
    expect(Host.updateInfo.value).toEqual({ state: "checking-for-update" });
    expect(Host.configProblem.value).toBeNull();
  });

  it("keeps why main sent no saved config", async () => {
    const problem: ConfigProblem = {
      reason: "unreadable",
      file: "/home/a/.config/kalandra/apt-data/config.json",
      message: "EBUSY: resource busy or locked, open",
    };
    const state: HostState = {
      version: "1.2.3",
      updater: { state: "initial" },
      contents: null,
      configProblem: problem,
    };
    vi.stubGlobal("fetch", async () => new Response(JSON.stringify(state)));

    expect(await Host.getConfig()).toBeNull();
    expect(Host.configProblem.value).toEqual(problem);
  });
});
