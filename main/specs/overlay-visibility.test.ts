import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Logger } from "../src/RemoteLogger";
import { GameWindow } from "../src/windowing/GameWindow";
import { OverlayVisibility } from "../src/windowing/OverlayVisibility";
import { OverlayWindow } from "../src/windowing/OverlayWindow";
import { hook, Key } from "./fake-hook";
import { FakeServer } from "./fake-server";

// OverlayWindow uses none of Electron with --no-overlay
vi.mock("electron", () => ({}));

vi.mock("uiohook-napi", async () => {
  const { hook, Key } = await import("./fake-hook");
  return { uIOhook: hook, UiohookKey: Key };
});

vi.mock("electron-overlay-window", async () => {
  const { EventEmitter } = await import("node:events");
  return {
    OVERLAY_WINDOW_OPTS: {},
    OverlayController: { events: new EventEmitter() },
  };
});

let server: FakeServer;
let overlay: OverlayWindow;

// The delays are timers, which the fake clock runs without waiting
beforeEach(() => {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
  server = new FakeServer();
  // The overlay window object then creates no BrowserWindow
  process.argv.push("--no-overlay");
  overlay = new OverlayWindow(server, new Logger(server), new GameWindow());
  process.argv.pop();
  // eslint-disable-next-line no-new -- the instance listens to the global hook from its constructor
  new OverlayVisibility(server, overlay);
});

afterEach(() => {
  hook.reset();
  vi.useRealTimers();
});

const visibility = () =>
  server.sent.flatMap((event) =>
    event.name === "MAIN->OVERLAY::visibility" ? [event.payload.isVisible] : [],
  );

const pressAlt = () => {
  hook.press(Key.Alt, { altKey: true });
};

describe("OverlayVisibility", () => {
  it("hides the overlay's UI 275 ms after Alt is pressed alone", () => {
    pressAlt();
    vi.advanceTimersByTime(274);
    expect(visibility()).toEqual([]);
    vi.advanceTimersByTime(1);
    expect(visibility()).toEqual([false]);
  });

  it("hides it 85 ms after the press while the overlay is interactable", () => {
    overlay.isInteractable = true;
    pressAlt();
    vi.advanceTimersByTime(84);
    expect(visibility()).toEqual([]);
    vi.advanceTimersByTime(1);
    expect(visibility()).toEqual([false]);
  });

  it("shows it again on a key release, a mouse move or another key without Alt", () => {
    pressAlt();
    vi.advanceTimersByTime(275);
    hook.release(Key.Alt);
    pressAlt();
    vi.advanceTimersByTime(275);
    hook.move(10, 10);
    pressAlt();
    vi.advanceTimersByTime(275);
    hook.press(Key.D);

    expect(visibility()).toEqual([false, true, false, true, false, true]);
  });

  it("keeps it while Alt is held with the mouse moving", () => {
    pressAlt();
    vi.advanceTimersByTime(275);
    hook.move(10, 10, { altKey: true });
    hook.release(Key.D, { altKey: true });

    expect(visibility()).toEqual([false]);
  });

  it("keeps it when Alt is released before the delay ends", () => {
    pressAlt();
    vi.advanceTimersByTime(200);
    hook.release(Key.Alt);
    vi.advanceTimersByTime(1000);

    expect(visibility()).toEqual([]);
  });

  it.each([
    ["Alt with Ctrl", Key.Alt, { altKey: true, ctrlKey: true }],
    ["Alt with Shift", Key.Alt, { altKey: true, shiftKey: true }],
    ["another key with Alt", Key.D, { altKey: true }],
  ])("keeps it for %s", (_keys, keycode, modifiers) => {
    hook.press(keycode, modifiers);
    vi.advanceTimersByTime(1000);

    expect(visibility()).toEqual([]);
  });
});
