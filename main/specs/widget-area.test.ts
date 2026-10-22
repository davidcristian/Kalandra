import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { IpcEventPayload } from "../../ipc/types";
import { Logger } from "../src/RemoteLogger";
import { GameWindow } from "../src/windowing/GameWindow";
import { OverlayWindow } from "../src/windowing/OverlayWindow";
import { WidgetAreaTracker } from "../src/windowing/WidgetAreaTracker";
import { hook } from "./fake-hook";
import { FakeServer } from "./fake-server";

// A display at 150% scale: Electron's screen methods multiply page coordinates by 1.5
vi.mock("electron", () => {
  const scale = (value: number) => value * 1.5;
  return {
    screen: {
      dipToScreenPoint: (p: { x: number; y: number }) => ({
        x: scale(p.x),
        y: scale(p.y),
      }),
      dipToScreenRect: (
        _window: null,
        r: { x: number; y: number; width: number; height: number },
      ) => ({
        x: scale(r.x),
        y: scale(r.y),
        width: scale(r.width),
        height: scale(r.height),
      }),
      getDisplayNearestPoint: () => ({
        bounds: { x: 0, y: 0 },
        nativeOrigin: { x: 0, y: 0 },
        scaleFactor: 1.5,
      }),
    },
  };
});

vi.mock("uiohook-napi", async () => {
  const { hook, Key } = await import("./fake-hook");
  return { uIOhook: hook, UiohookKey: Key };
});

vi.mock("electron-overlay-window", async () => {
  const { EventEmitter } = await import("node:events");
  return {
    OVERLAY_WINDOW_OPTS: {},
    OverlayController: {
      events: new EventEmitter(),
      activateOverlay: () => {},
      focusTarget: () => {},
    },
  };
});

type TrackArea = IpcEventPayload<"OVERLAY->MAIN::track-area">;

const PLATFORM = process.platform;
let server: FakeServer;
let game: GameWindow;
let overlay: OverlayWindow;

function onPlatform(platform: NodeJS.Platform) {
  Object.defineProperty(process, "platform", { value: platform });
}

beforeEach(() => {
  server = new FakeServer();
  game = new GameWindow();
  // The overlay window object then creates no BrowserWindow
  process.argv.push("--no-overlay");
  overlay = new OverlayWindow(server, new Logger(server), game);
  process.argv.pop();
  // eslint-disable-next-line no-new -- the tracker listens to the server from its constructor
  new WidgetAreaTracker(server, overlay);
  onPlatform("darwin");
});

afterEach(() => {
  hook.reset();
  onPlatform(PLATFORM);
});

// A widget opened by a press at (300, 300), over the area from (200, 200) to (600, 500)
async function trackArea(opts: Partial<TrackArea> = {}) {
  await server.emit("OVERLAY->MAIN::track-area", {
    holdKey: "Ctrl",
    closeThreshold: 40,
    from: { x: 300, y: 300 },
    area: { x: 200, y: 200, width: 400, height: 300 },
    dpr: 1.5,
    ...opts,
  });
}

const hideCount = () =>
  server.sent.filter(
    (event) => event.name === "MAIN->OVERLAY::hide-exclusive-widget",
  ).length;

describe("WidgetAreaTracker", () => {
  it("hides the widget once the mouse moves further than the close threshold from the press", async () => {
    await trackArea();

    hook.move(300, 340);
    expect(hideCount()).toBe(0);
    hook.move(300, 341);
    hook.move(300, 400);
    expect(hideCount()).toBe(1);
  });

  it("keeps the widget while the hold key is held, and makes the overlay active when the mouse enters the area", async () => {
    await trackArea();

    hook.move(700, 700, { ctrlKey: true });
    expect([hideCount(), overlay.isInteractable]).toEqual([0, false]);
    hook.move(400, 300, { ctrlKey: true });
    expect(overlay.isInteractable).toBe(true);
  });

  it("makes the overlay active on a press inside the area, and then stops following the mouse", async () => {
    await trackArea();

    hook.down(200, 300);
    expect(overlay.isInteractable).toBe(false);
    hook.down(201, 300);
    expect(overlay.isInteractable).toBe(true);
    hook.move(900, 900);
    expect([overlay.isInteractable, game.isActive]).toEqual([true, false]);
  });

  it("returns to the game when the mouse leaves the area while the overlay is active", async () => {
    overlay.assertOverlayActive();
    await trackArea();

    hook.move(599, 499);
    expect(overlay.isInteractable).toBe(true);
    hook.move(600, 300);
    expect([overlay.isInteractable, game.isActive]).toEqual([false, true]);
  });

  it("converts the press and the threshold to screen pixels on Windows", async () => {
    onPlatform("win32");
    await trackArea({ closeThreshold: 10, from: { x: 100, y: 100 } });

    hook.move(165, 150);
    expect(hideCount()).toBe(0);
    hook.move(166, 150);
    expect(hideCount()).toBe(1);
  });

  // The area rounds to (10, 21) with size 101 x 50, which is (15, 31.5) to (166.5, 106.5) in screen pixels
  it("converts the rounded area to screen pixels on Windows", async () => {
    onPlatform("win32");
    await trackArea({ area: { x: 10.4, y: 20.6, width: 100.5, height: 50.2 } });

    for (const [x, y] of [
      [15, 50],
      [166.5, 50],
      [50, 31.5],
      [50, 106.5],
    ]) {
      hook.down(x, y);
    }
    expect(overlay.isInteractable).toBe(false);
    hook.down(166, 106);
    expect(overlay.isInteractable).toBe(true);
  });

  // The press is (150, 150), the threshold 15 and the area (15, 30) to (165, 105) in screen pixels
  it("scales the press, the threshold and the area by the display's scale on Linux", async () => {
    onPlatform("linux");
    await trackArea({
      closeThreshold: 10,
      from: { x: 100, y: 100 },
      area: { x: 10, y: 20, width: 100, height: 50 },
    });

    hook.down(15, 50);
    hook.down(50, 30);
    hook.move(165, 150);
    expect([hideCount(), overlay.isInteractable]).toEqual([0, false]);
    hook.down(164, 104);
    expect(overlay.isInteractable).toBe(true);
  });
});
