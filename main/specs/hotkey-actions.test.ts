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

// Stands in for the system clipboard and the cursor. A clipboard write ends on a later tick, as the operating
// system's does, and a read fails while another application holds the clipboard.
const desktop = vi.hoisted(() => ({ clipboard: "", held: false }));

vi.mock("electron", async () => {
  const os = await import("node:os");
  const { globalShortcut } = await import("./fake-global-shortcut");
  return {
    app: { getPath: () => os.tmpdir() },
    globalShortcut,
    clipboard: {
      readText: async () => {
        if (desktop.held) throw new Error("The clipboard is in use");
        return desktop.clipboard;
      },
      writeText: async (text: string) => {
        await Promise.resolve();
        desktop.clipboard = text;
      },
    },
    screen: { getCursorScreenPoint: () => ({ x: 640, y: 480 }) },
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
      targetBounds: { x: 0, y: 0, width: 1920, height: 1080 },
      activateOverlay: () => {},
      focusTarget: () => {},
    },
  };
});

const ITEM_TEXT = "Item Class: Rings\nRarity: Rare\nGale Loop\nAmethyst Ring";
const PLATFORM = process.platform;

let server: FakeServer;
let logger: Logger;
let game: GameWindow;
let overlay: OverlayWindow;
let shortcuts: Shortcuts;

function onPlatform(platform: NodeJS.Platform) {
  Object.defineProperty(process, "platform", { value: platform });
}

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
  onPlatform("win32");
  desktop.clipboard = "";
  desktop.held = false;
  // The game copies the item under the cursor when it gets C
  hook.onPress = (pressed) => {
    if (pressed === "C tap") desktop.clipboard = ITEM_TEXT;
  };
  server = new FakeServer();
  logger = new Logger(server);
  game = new GameWindow();
  // The overlay window object then creates no BrowserWindow
  process.argv.push("--no-overlay");
  overlay = new OverlayWindow(server, logger, game);
  process.argv.pop();
  shortcuts = new Shortcuts(
    logger,
    overlay,
    game,
    new GameConfig(logger),
    server,
  );
});

afterEach(() => {
  vi.useRealTimers();
  onPlatform(PLATFORM);
  game.removeAllListeners();
  hook.reset();
  globalShortcut.unregisterAll();
  globalShortcut.taken.clear();
});

// Shortcuts registers the hotkeys on the tick after the game window becomes active
async function registerOnFocus(actions: ShortcutAction[]) {
  shortcuts.updateActions({
    shortcuts: actions,
    stashScroll: false,
    logKeys: false,
    restoreClipboard: false,
  });
  game.isActive = true;
  await new Promise((resolve) => setImmediate(resolve));
}

/** Presses the hotkey and lets the clipboard polls and the key releases run. */
async function pressHotkey(accelerator: string) {
  const callback = globalShortcut.registered.get(accelerator);
  if (!callback) throw new Error(`${accelerator} is not registered`);
  callback();
  await vi.advanceTimersByTimeAsync(1000);
}

function copyItem(
  shortcut: string,
  props: { keepModKeys?: true; focusOverlay?: boolean } = {},
): ShortcutAction {
  return {
    shortcut,
    keepModKeys: props.keepModKeys,
    action: {
      type: "copy-item",
      target: "price-check",
      focusOverlay: props.focusOverlay,
    },
  };
}

function itemTexts() {
  return server.sent.flatMap((event) =>
    event.name === "MAIN->CLIENT::item-text" ? [event.payload] : [],
  );
}

describe("the copy item hotkey", () => {
  it("copies the item with the show mods key and sends its text with the cursor position", async () => {
    await registerOnFocus([copyItem("Ctrl + D")]);

    await pressHotkey("Ctrl+D");

    expect(hook.pressed).toEqual([
      "D up",
      "Ctrl up",
      "Ctrl down",
      "Alt down",
      "C tap",
      "Alt up",
      "Ctrl up",
    ]);
    expect(itemTexts()).toEqual([
      {
        target: "price-check",
        clipboard: ITEM_TEXT,
        position: { x: 640, y: 480 },
        focusOverlay: false,
      },
    ]);
  });

  it.each([
    ["win32", ["D up", "Ctrl down", "C tap", "Ctrl up"]],
    ["darwin", ["D up", "Ctrl down", "Alt down", "C tap", "Alt up", "Ctrl up"]],
  ] as const)(
    "on %s, presses again the held modifier keys of the hotkey %j",
    async (platform, pressed) => {
      onPlatform(platform);
      await registerOnFocus([copyItem("Alt + D", { keepModKeys: true })]);

      await pressHotkey("Alt+D");

      expect(hook.pressed).toEqual(pressed);
    },
  );

  it("activates the overlay after the copy only when the overlay was used last", async () => {
    await registerOnFocus([copyItem("Ctrl + D", { focusOverlay: true })]);

    await server.emit("CLIENT->MAIN::used-recently", { isOverlay: false });
    await pressHotkey("Ctrl+D");
    expect(overlay.isInteractable).toBe(false);

    await server.emit("CLIENT->MAIN::used-recently", { isOverlay: true });
    await pressHotkey("Ctrl+D");
    expect(overlay.isInteractable).toBe(true);
    expect(itemTexts().map((text) => text.focusOverlay)).toEqual([true, true]);
  });

  it("sends nothing when the game copies no item", async () => {
    hook.onPress = () => {};
    await registerOnFocus([copyItem("Ctrl + D")]);

    await pressHotkey("Ctrl+D");

    expect(itemTexts()).toEqual([]);
    expect(logger.history).toContain(
      "warn [ClipboardPoller] No item text found.",
    );
    expect(logger.history).not.toContain("error [Shortcuts]");
  });

  it("logs an error that stops the copy and sends nothing", async () => {
    desktop.held = true;
    await registerOnFocus([copyItem("Ctrl + D")]);

    await pressHotkey("Ctrl+D");

    expect(itemTexts()).toEqual([]);
    expect(logger.history).toContain(
      "error [Shortcuts] Failed to copy the item text: The clipboard is in use",
    );
  });
});

describe("other hotkey actions", () => {
  it("logs a hotkey that another application has registered", async () => {
    globalShortcut.taken.add("F5");

    await registerOnFocus([
      { shortcut: "F5", action: { type: "trigger-event", target: "a" } },
    ]);

    expect(logger.history).toContain(
      'error [Shortcuts] Failed to register a shortcut "F5". It is already registered by another application.',
    );
  });
});
