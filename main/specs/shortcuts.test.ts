import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ShortcutAction } from "../../ipc/types";
import { GameConfig } from "../src/host-files/GameConfig";
import { Logger } from "../src/RemoteLogger";
import { Shortcuts } from "../src/shortcuts/Shortcuts";
import { GameWindow } from "../src/windowing/GameWindow";
import { OverlayWindow } from "../src/windowing/OverlayWindow";
import { globalShortcut } from "./fake-global-shortcut";
import { hook } from "./fake-hook";
import { FakeServer } from "./fake-server";

vi.mock("electron", async () => {
  const os = await import("node:os");
  const { globalShortcut } = await import("./fake-global-shortcut");
  return { app: { getPath: () => os.tmpdir() }, globalShortcut };
});

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

// The OCR worker thread runs dist/vision.js, which the tests do not build
vi.mock("../src/vision/link-main", () => ({
  OcrWorker: { create: async () => ({ updateOptions: async () => {} }) },
}));

let logger: Logger;
let game: GameWindow;
let shortcuts: Shortcuts;

beforeEach(async () => {
  const server = new FakeServer();
  logger = new Logger(server);
  game = new GameWindow();
  // The overlay window object then creates no BrowserWindow
  process.argv.push("--no-overlay");
  const overlay = new OverlayWindow(server, logger, game);
  process.argv.pop();
  const gameConfig = new GameConfig(server, logger);
  shortcuts = await Shortcuts.create(logger, overlay, game, gameConfig, server);
});

afterEach(() => {
  game.removeAllListeners();
  hook.removeAllListeners();
  globalShortcut.unregisterAll();
});

function trigger(shortcut: string): ShortcutAction {
  return { shortcut, action: { type: "trigger-event", target: shortcut } };
}

// Shortcuts registers the hotkeys on the tick after the game window becomes active
async function registerOnFocus(actions: ShortcutAction[]) {
  shortcuts.updateActions(actions, false, false, false, "en");
  game.isActive = true;
  await new Promise((resolve) => setImmediate(resolve));
}

describe("Shortcuts", () => {
  it("registers the hotkeys after one with an unknown key name, and logs that one", async () => {
    await registerOnFocus([
      trigger("Ctrl + Foo"),
      trigger("F5"),
      trigger("Shift + Space"),
    ]);

    expect([...globalShortcut.registered.keys()]).toEqual([
      "F5",
      "Shift+Space",
    ]);
    expect(logger.history).toContain(
      'error [Shortcuts] Hotkey "Ctrl + Foo" has an unknown key name and will not be registered.',
    );
  });

  it.each(["Foo + A", "Ctrl + constructor", ""])(
    "leaves out the hotkey %j and registers the rest",
    async (shortcut) => {
      await registerOnFocus([trigger(shortcut), trigger("F5")]);

      expect([...globalShortcut.registered.keys()]).toEqual(["F5"]);
    },
  );
});
