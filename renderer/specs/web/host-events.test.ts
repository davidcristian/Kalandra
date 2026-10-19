import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import type { IpcEvent } from "@ipc/types";
import type * as IPC from "@/web/background/IPC";

const OVERLAY_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) kalandra/1.2.3 Chrome/138.0.7204.235 Electron/37.4.0 Safari/537.36";
const BROWSER_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36";

/** Stands in for the browser's WebSocket: opens at once and keeps the text the page sends. */
class FakeWebSocket {
  static readonly sent: string[] = [];
  onopen: (e: Event) => void = () => {};

  constructor() {
    queueMicrotask(() => {
      this.onopen(new Event("open"));
    });
  }

  send(text: string) {
    FakeWebSocket.sent.push(text);
  }
}

let Host: typeof IPC.Host;

// Vue reads document on import when window exists, so the stubs come after the import
beforeAll(async () => {
  ({ Host } = await vi.importActual<typeof IPC>("@/web/background/IPC"));
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
