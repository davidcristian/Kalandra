import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Logger } from "../src/RemoteLogger";
import { HostClipboard } from "../src/shortcuts/HostClipboard";
import { stashSearch } from "../src/shortcuts/text-box";
import { GameWindow } from "../src/windowing/GameWindow";
import { OverlayWindow } from "../src/windowing/OverlayWindow";
import { FakeServer } from "./fake-server";

// Stands in for the desktop: the window with the focus, the clipboard, each key press with the window it reached
// and the text each paste reached it with. A clipboard write ends on a later tick, as the operating system's does.
const desktop = vi.hoisted(() => ({
  focused: "browser",
  clipboard: "",
  presses: [] as string[],
  pasted: [] as string[],
}));

vi.mock("electron", () => ({
  clipboard: {
    readText: async () => desktop.clipboard,
    writeText: async (text: string) => {
      await Promise.resolve();
      desktop.clipboard = text;
    },
  },
}));

vi.mock("uiohook-napi", () => ({
  UiohookKey: { Ctrl: "Ctrl", Enter: "Enter", F: "F", Meta: "Meta", V: "V" },
  uIOhook: {
    keyTap: (key: string, modifiers: string[] = []) => {
      desktop.presses.push(
        `${desktop.focused}: ${[...modifiers, key].join(" + ")}`,
      );
      if (key === "V") desktop.pasted.push(desktop.clipboard);
    },
  },
}));

vi.mock("electron-overlay-window", async () => {
  const { EventEmitter } = await import("node:events");
  return {
    OVERLAY_WINDOW_OPTS: {},
    OverlayController: {
      events: new EventEmitter(),
      focusTarget: () => {
        desktop.focused = "game";
      },
    },
  };
});

const paste = process.platform === "darwin" ? "Meta + V" : "Ctrl + V";
let logger: Logger;
let game: GameWindow;
let overlay: OverlayWindow;

beforeEach(() => {
  logger = new Logger(new FakeServer());
  game = new GameWindow();
  // The overlay window object then creates no BrowserWindow
  process.argv.push("--no-overlay");
  overlay = new OverlayWindow(new FakeServer(), logger, game);
  process.argv.pop();
  desktop.clipboard = "";
  desktop.presses = [];
  desktop.pasted = [];
});

afterEach(() => {
  game.removeAllListeners();
});

// A new clipboard for each search, because restoreShortly() skips a search within 120 ms of the last
async function search(text: string) {
  await stashSearch(text, new HostClipboard(logger), overlay);
}

describe("stashSearch", () => {
  it("types the search into the game while the game has the focus", async () => {
    desktop.focused = "game";
    game.isActive = true;

    await search("Currency");

    expect(desktop.presses).toEqual([
      "game: Ctrl + F",
      `game: ${paste}`,
      "game: Enter",
    ]);
    expect(desktop.pasted).toEqual(["Currency"]);
  });

  it("focuses the game first while the overlay has the focus", async () => {
    desktop.focused = "overlay";
    overlay.isInteractable = true;

    await search("Currency");

    expect(desktop.presses).toEqual([
      "game: Ctrl + F",
      `game: ${paste}`,
      "game: Enter",
    ]);
  });

  it("presses no key and logs while a browser tab has the focus", async () => {
    desktop.focused = "browser";

    await search("Currency");

    expect(desktop.presses).toEqual([]);
    expect(desktop.clipboard).toBe("");
    expect(logger.history).toContain(
      "warn [Overlay] Skipped a stash search because the game window does not have the focus",
    );
  });
});
