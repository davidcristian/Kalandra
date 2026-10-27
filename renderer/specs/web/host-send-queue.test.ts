import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { IpcEvent } from "@ipc/types";
import type * as IPC from "@/web/background/IPC";

/** Stands in for the browser's WebSocket: the test opens and closes it, and send() acts as the browser's in each state. */
class FakeWebSocket {
  static readonly created: FakeWebSocket[] = [];
  /** The text main received, from every socket in order. */
  static readonly received: string[] = [];
  private state: "connecting" | "open" | "closed" = "connecting";
  onopen: (e: Event) => void = () => {};
  onclose: (e: { code: number }) => void = () => {};

  constructor() {
    FakeWebSocket.created.push(this);
  }

  open() {
    this.state = "open";
    this.onopen(new Event("open"));
  }

  close(code: number) {
    this.state = "closed";
    this.onclose({ code });
  }

  send(text: string) {
    if (this.state === "connecting") {
      throw new DOMException("Still in CONNECTING state.", "InvalidStateError");
    }
    if (this.state === "open") {
      FakeWebSocket.received.push(text);
    }
  }
}

const latestSocket = () =>
  FakeWebSocket.created[FakeWebSocket.created.length - 1];

const save = (contents: string): IpcEvent => ({
  name: "CLIENT->MAIN::save-config",
  payload: { contents },
});

function savedContents(): string[] {
  return FakeWebSocket.received.map((text) => {
    const event = JSON.parse(text) as IpcEvent;
    return event.name === "CLIENT->MAIN::save-config"
      ? event.payload.contents
      : event.name;
  });
}

let Host: typeof IPC.Host;
let QUEUED_EVENTS: typeof IPC.QUEUED_EVENTS;

// Each test starts from a page that has not opened its socket yet
beforeEach(async () => {
  vi.resetModules();
  ({ Host, QUEUED_EVENTS } = await vi.importActual<typeof IPC>(
    "@/web/background/IPC",
  ));
  // Vue reads document on import when window exists, so the stubs come after the import
  vi.stubGlobal("window", { location: { host: "localhost:4000" } });
  vi.stubGlobal("WebSocket", FakeWebSocket);
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  FakeWebSocket.created.length = 0;
  FakeWebSocket.received.length = 0;
});

async function openFirstSocket() {
  const init = Host.init();
  latestSocket().open();
  await init;
}

describe("Host.sendEvent while the socket is not open", () => {
  it("sends an event sent before init() once the socket opens", async () => {
    Host.sendEvent(save("before init"));
    expect(savedContents()).toEqual([]);

    await openFirstSocket();

    expect(savedContents()).toEqual(["before init"]);
  });

  it("sends the events sent while the socket is closed or connects again once it opens, in order", async () => {
    await openFirstSocket();
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    Host.sendEvent(save("before the close"));

    latestSocket().close(1006);
    Host.sendEvent(save("while closed"));
    vi.runOnlyPendingTimers();
    Host.sendEvent(save("while connecting"));
    expect(savedContents()).toEqual(["before the close"]);

    latestSocket().open();
    Host.sendEvent(save("after the open"));

    expect(FakeWebSocket.created).toHaveLength(2);
    expect(savedContents()).toEqual([
      "before the close",
      "while closed",
      "while connecting",
      "after the open",
    ]);
  });

  it("drops the oldest event with a log line past the limit", async () => {
    const warnings: string[] = [];
    vi.spyOn(console, "warn").mockImplementation((text: string) => {
      warnings.push(text);
    });
    const sent = Array.from({ length: QUEUED_EVENTS + 2 }, (_, i) => `${i}`);
    for (const contents of sent) {
      Host.sendEvent(save(contents));
    }

    await openFirstSocket();

    expect(savedContents()).toEqual(sent.slice(2));
    expect(warnings).toEqual([
      `Dropped CLIENT->MAIN::save-config: ${QUEUED_EVENTS} newer events wait for the socket to main to open`,
      `Dropped CLIENT->MAIN::save-config: ${QUEUED_EVENTS} newer events wait for the socket to main to open`,
    ]);
  });
});
