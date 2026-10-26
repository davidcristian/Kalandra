import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Logger } from "../src/RemoteLogger";
import { HostClipboard } from "../src/shortcuts/HostClipboard";
import { stashSearch } from "../src/shortcuts/text-box";
import { GameWindow } from "../src/windowing/GameWindow";
import { OverlayWindow } from "../src/windowing/OverlayWindow";
import { FakeServer } from "./fake-server";

// Stands in for the desktop: the window with the focus, the clipboard, each key press with the window it reached
// and the text each paste reached it with. A clipboard write ends on a later tick, as the operating system's does.
const desktop = vi.hoisted(() => {
  const state = {
    focused: "browser",
    clipboard: "",
    presses: [] as string[],
    pasted: [] as string[],
    // The key presses that wait while the game stalls, or null while it handles each one at once
    stalled: null as Array<[string, string[]]> | null,
    keyTap: (key: string, modifiers: string[] = []) => {
      if (state.stalled) {
        state.stalled.push([key, modifiers]);
        return;
      }
      state.presses.push(
        `${state.focused}: ${[...modifiers, key].join(" + ")}`,
      );
      if (key === "V") state.pasted.push(state.clipboard);
    },
    /** Handles the key presses kept while the game stalled in order, each with the clipboard text of now. */
    resume: () => {
      const presses = state.stalled ?? [];
      state.stalled = null;
      for (const [key, modifiers] of presses) state.keyTap(key, modifiers);
    },
  };
  return state;
});

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
  uIOhook: { keyTap: desktop.keyTap },
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
  desktop.stalled = null;
});

afterEach(() => {
  game.removeAllListeners();
});

// A new clipboard for each search, because throttle() skips a search within 120 ms of the last
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

  it("pastes the search from a game that stalls with Restore clipboard on", async () => {
    desktop.focused = "game";
    game.isActive = true;
    desktop.clipboard = "password";
    const clipboard = new HostClipboard(logger);
    clipboard.updateOptions(true);
    desktop.stalled = [];

    await stashSearch("Currency", clipboard, overlay);
    desktop.resume();

    expect(desktop.pasted).toEqual(["Currency"]);
    expect(desktop.clipboard).toBe("Currency");
  });

  it("drops a search that comes before the last one ends", async () => {
    desktop.focused = "game";
    game.isActive = true;
    const clipboard = new HostClipboard(logger);

    const first = stashSearch("Currency", clipboard, overlay);
    await stashSearch("Waystone", clipboard, overlay);
    await first;

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
