import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Logger } from "../src/RemoteLogger";
import { HostClipboard } from "../src/shortcuts/HostClipboard";
import { stashSearch } from "../src/shortcuts/text-box";
import { GameWindow } from "../src/windowing/GameWindow";
import { OverlayWindow } from "../src/windowing/OverlayWindow";
import { FakeServer } from "./fake-server";

// Stands in for the desktop: the window with the focus, the clipboard and each key press with the window it reached
const desktop = vi.hoisted(() => ({
  focused: "browser",
  clipboard: "",
  presses: [] as string[],
}));

vi.mock("electron", () => ({
  clipboard: {
    readText: () => desktop.clipboard,
    writeText: (text: string) => {
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
});

afterEach(() => {
  game.removeAllListeners();
});

// A new clipboard for each search, because restoreShortly() skips a search within 120 ms of the last
function search(text: string) {
  stashSearch(text, new HostClipboard(logger), overlay);
}

describe("stashSearch", () => {
  it("types the search into the game while the game has the focus", () => {
    desktop.focused = "game";
    game.isActive = true;

    search("Currency");

    expect(desktop.presses).toEqual([
      "game: Ctrl + F",
      `game: ${paste}`,
      "game: Enter",
    ]);
    expect(desktop.clipboard).toBe("Currency");
  });

  it("focuses the game first while the overlay has the focus", () => {
    desktop.focused = "overlay";
    overlay.isInteractable = true;

    search("Currency");

    expect(desktop.presses).toEqual([
      "game: Ctrl + F",
      `game: ${paste}`,
      "game: Enter",
    ]);
  });

  it("presses no key and logs while a browser tab has the focus", () => {
    desktop.focused = "browser";

    search("Currency");

    expect(desktop.presses).toEqual([]);
    expect(desktop.clipboard).toBe("");
    expect(logger.history).toContain(
      "warn [Overlay] Skipped a stash search because the game window does not have the focus",
    );
  });
});
