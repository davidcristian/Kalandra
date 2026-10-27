import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ShortcutAction } from "../../ipc/types";
import { GameConfig } from "../src/host-files/GameConfig";
import { Logger } from "../src/RemoteLogger";
import { Shortcuts, type ShortcutSettings } from "../src/shortcuts/Shortcuts";
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
    OverlayController: {
      events: new EventEmitter(),
      // A game window 1600 px high, whose sidebar is 987 px wide and whose stash tabs fill y 154 to 1192 of it
      targetBounds: { x: 100, y: 50, width: 2560, height: 1600 },
    },
  };
});

let server: FakeServer;
let logger: Logger;
let game: GameWindow;
let shortcuts: Shortcuts;

beforeEach(async () => {
  server = new FakeServer();
  logger = new Logger(server);
  game = new GameWindow();
  // The overlay window object then creates no BrowserWindow
  process.argv.push("--no-overlay");
  const overlay = new OverlayWindow(server, logger, game);
  process.argv.pop();
  const gameConfig = new GameConfig(logger);
  shortcuts = new Shortcuts(logger, overlay, game, gameConfig, server);
});

afterEach(() => {
  game.removeAllListeners();
  hook.reset();
  globalShortcut.unregisterAll();
  globalShortcut.taken.clear();
});

function trigger(shortcut: string): ShortcutAction {
  return { shortcut, action: { type: "trigger-event", target: shortcut } };
}

function settings(
  actions: ShortcutAction[],
  stashScroll = false,
): ShortcutSettings {
  return {
    shortcuts: actions,
    stashScroll,
    logKeys: false,
    restoreClipboard: false,
  };
}

// Shortcuts registers the hotkeys on the tick after the game window becomes active
async function registerOnFocus(actions: ShortcutAction[]) {
  shortcuts.updateActions(settings(actions));
  game.isActive = true;
  await new Promise((resolve) => setImmediate(resolve));
}

const registered = () => [...globalShortcut.registered.keys()];

async function setGameActive(isActive: boolean) {
  game.isActive = isActive;
  await new Promise((resolve) => setImmediate(resolve));
}

// Each list of hotkeys main sent as not registered, the oldest first
const unregisteredLists = () =>
  server.sent.flatMap((event) =>
    event.name === "MAIN->CLIENT::unregistered-hotkeys"
      ? [event.payload.hotkeys]
      : [],
  );

function pressHotkey(accelerator: string) {
  const callback = globalShortcut.registered.get(accelerator);
  if (!callback) throw new Error(`${accelerator} is not registered`);
  callback();
}

describe("Shortcuts", () => {
  it("registers the hotkeys after one with an unknown key name, and logs that one", async () => {
    await registerOnFocus([
      trigger("Ctrl + Foo"),
      trigger("F5"),
      trigger("Shift + Space"),
    ]);

    expect(registered()).toEqual(["F5", "Shift+Space"]);
    expect(logger.history).toContain(
      'error [Shortcuts] Hotkey "Ctrl + Foo" has an unknown key name and will not be registered.',
    );
  });

  it.each(["Foo + A", "Ctrl + constructor", ""])(
    "leaves out the hotkey %j and registers the rest",
    async (shortcut) => {
      await registerOnFocus([trigger(shortcut), trigger("F5")]);

      expect(registered()).toEqual(["F5"]);
    },
  );

  it("registers no hotkey until the game window is active, and none after it loses the focus", async () => {
    shortcuts.updateActions(settings([trigger("F5")]));
    expect(registered()).toEqual([]);

    await registerOnFocus([trigger("F5")]);
    game.isActive = false;
    await new Promise((resolve) => setImmediate(resolve));

    expect(registered()).toEqual([]);
  });
});

describe("updateActions", () => {
  it("leaves out and logs each hotkey the game uses", async () => {
    await registerOnFocus([
      trigger("Ctrl + F"),
      trigger("ArrowUp"),
      trigger("F5"),
    ]);

    expect(registered()).toEqual(["F5"]);
    for (const shortcut of ["Ctrl + F", "ArrowUp"]) {
      expect(logger.history).toContain(
        `error [Shortcuts] Hotkey "${shortcut}" reserved by the game will not be registered.`,
      );
    }
  });

  it("leaves out the copy keys, which add the game's show mods key, Alt by default", async () => {
    await registerOnFocus([trigger("Ctrl + Alt + C"), trigger("Ctrl + C")]);

    expect(registered()).toEqual([]);
    expect(logger.history).toContain(
      'error [Shortcuts] Hotkey "Ctrl + Alt + C" reserved by the game will not be registered.',
    );
  });

  it("registers nothing for the copy keys and adds no action to the config's hotkeys", async () => {
    const actions = [trigger("F5")];

    await registerOnFocus(actions);

    expect(registered()).toEqual(["F5"]);
    expect(actions).toEqual([trigger("F5")]);
  });

  it("leaves out and logs a hotkey that two actions use", async () => {
    await registerOnFocus([
      trigger("F5"),
      { shortcut: "F5", action: { type: "stash-search", text: "map" } },
      trigger("Shift + F5"),
    ]);

    expect(registered()).toEqual(["Shift+F5"]);
    expect(logger.history).toContain(
      'error [Shortcuts] It is not possible to use the same hotkey "F5" for multiple actions.',
    );
  });

  it("leaves out an overlay key the game uses", async () => {
    await registerOnFocus([
      { shortcut: "Ctrl + F", action: { type: "toggle-overlay" } },
    ]);

    expect(registered()).toEqual([]);
  });

  it("keeps the overlay key when another action uses it too", async () => {
    await registerOnFocus([
      trigger("Shift + Space"),
      { shortcut: "Shift + Space", action: { type: "toggle-overlay" } },
    ]);

    expect(registered()).toEqual(["Shift+Space"]);
  });
});

describe("the hotkeys main sends as not registered", () => {
  it("names each hotkey left out for its keys with the reason, but not one that two actions share", async () => {
    await registerOnFocus([
      trigger("Ctrl + Foo"),
      trigger("Ctrl + F"),
      trigger("Ctrl + Alt + C"),
      trigger("F5"),
      trigger("F5"),
      trigger("F6"),
    ]);

    expect(unregisteredLists()).toEqual([
      [
        { shortcut: "Ctrl + Foo", reason: "unknown-key" },
        { shortcut: "Ctrl + F", reason: "game-key" },
        { shortcut: "Ctrl + Alt + C", reason: "game-key" },
      ],
    ]);
  });

  it("sends an empty list for a config whose hotkeys main all registers", async () => {
    await registerOnFocus([trigger("F5")]);

    expect(unregisteredLists()).toEqual([[]]);
  });

  it("adds a hotkey another program holds when the game window becomes active", async () => {
    globalShortcut.taken.add("Shift+F6");
    await registerOnFocus([trigger("F5"), trigger("Shift + F6")]);

    expect(registered()).toEqual(["F5"]);
    expect(unregisteredLists()).toEqual([
      [],
      [{ shortcut: "Shift + F6", reason: "taken" }],
    ]);
  });

  it("sends no new list when the game window becomes active again with the same hotkeys taken", async () => {
    globalShortcut.taken.add("F6");
    await registerOnFocus([trigger("F6")]);
    await setGameActive(false);
    await setGameActive(true);

    expect(unregisteredLists()).toHaveLength(2);
  });

  it("removes a hotkey once the other program no longer holds it", async () => {
    globalShortcut.taken.add("F6");
    await registerOnFocus([trigger("F6")]);
    await setGameActive(false);
    globalShortcut.taken.clear();
    await setGameActive(true);

    expect(registered()).toEqual(["F6"]);
    expect(unregisteredLists().at(-1)).toEqual([]);
  });

  it("keeps a taken hotkey in the list a page gets when it sends the same config again", async () => {
    globalShortcut.taken.add("F6");
    await registerOnFocus([trigger("F6")]);
    await setGameActive(false);
    shortcuts.updateActions(settings([trigger("F6")]));

    expect(unregisteredLists().at(-1)).toEqual([
      { shortcut: "F6", reason: "taken" },
    ]);
  });

  it("drops a taken hotkey from the list when the config no longer has it", async () => {
    globalShortcut.taken.add("F6");
    await registerOnFocus([trigger("F6")]);
    await setGameActive(false);
    shortcuts.updateActions(settings([trigger("F7")]));

    expect(unregisteredLists().at(-1)).toEqual([]);
  });
});

describe("a hotkey press", () => {
  it("releases the hotkey's keys, the last first, and sends the widget action to every page", async () => {
    await registerOnFocus([trigger("Ctrl + Shift + F5")]);
    pressHotkey("Ctrl+Shift+F5");

    expect(hook.pressed).toEqual(["F5 up", "Shift up", "Ctrl up"]);
    expect(server.sent).toContainEqual({
      name: "MAIN->CLIENT::widget-action",
      payload: { target: "Ctrl + Shift + F5" },
    });
  });

  it("releases only the key that is not a modifier when the action keeps the modifiers held", async () => {
    await registerOnFocus([{ ...trigger("Ctrl + F5"), keepModKeys: true }]);
    pressHotkey("Ctrl+F5");

    expect(hook.pressed).toEqual(["F5 up"]);
  });
});

describe("Ctrl and the mouse wheel with stash scrolling on", () => {
  beforeEach(async () => {
    shortcuts.updateActions(settings([], true));
    game.isActive = true;
    await new Promise((resolve) => setImmediate(resolve));
  });

  it.each([
    ["inside the stash area at its right edge", 1087, 700, []],
    ["right of the stash area", 1088, 700, ["ArrowRight tap"]],
    ["above the stash tabs", 500, 204, ["ArrowRight tap"]],
    ["at the top of the stash tabs", 500, 205, []],
    ["at the bottom of the stash tabs", 500, 1241, []],
    ["below the stash tabs", 500, 1242, ["ArrowRight tap"]],
  ])("%s, at (%i, %i), taps %j", (_place, x, y, taps) => {
    hook.wheel(x, y, 1, { ctrlKey: true });

    expect(hook.pressed).toEqual(taps);
  });

  it("taps ArrowLeft when the wheel turns the other way", () => {
    hook.wheel(1500, 700, -1, { ctrlKey: true });

    expect(hook.pressed).toEqual(["ArrowLeft tap"]);
  });

  it("taps nothing without Ctrl, with stash scrolling off or while the game is not active", async () => {
    hook.wheel(1500, 700, 1);
    shortcuts.updateActions(settings([]));
    hook.wheel(1500, 700, 1, { ctrlKey: true });
    shortcuts.updateActions(settings([], true));
    game.isActive = false;
    hook.wheel(1500, 700, 1, { ctrlKey: true });

    expect(hook.pressed).toEqual([]);
  });
});
