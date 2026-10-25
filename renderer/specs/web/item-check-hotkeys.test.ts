import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { IpcEvent } from "@ipc/types";
import { setupTests } from "@specs/vitest.setup";
import { UniqueItem } from "@specs/Parser/items";
import { init } from "@/assets/data";
import { Host } from "@/web/background/IPC";
import { registerActions } from "@/web/item-check/hotkeyable-actions";

type ItemText = Extract<IpcEvent, { name: "MAIN->CLIENT::item-text" }>;

let itemTextListeners: Array<(payload: ItemText["payload"]) => void>;
let opened: string[];
let sent: IpcEvent[];

/** Sends item text from main, as a hotkey with this target does. */
function pressHotkey(target: string, clipboard = UniqueItem.rawText) {
  for (const listener of itemTextListeners) {
    listener({
      target,
      clipboard,
      position: { x: 0, y: 0 },
      focusOverlay: false,
    });
  }
}

describe("the item check hotkeys", () => {
  beforeEach(async () => {
    setupTests();
    await init("en");
    itemTextListeners = [];
    opened = [];
    sent = [];
    vi.mocked(Host.onEvent).mockImplementation((name, listener) => {
      if (name === "MAIN->CLIENT::item-text") {
        itemTextListeners.push(listener as (typeof itemTextListeners)[number]);
      }
      return new AbortController();
    });
    vi.mocked(Host.sendEvent).mockImplementation((event) => {
      sent.push(event);
    });
    vi.stubGlobal("window", {
      open: (url?: string | URL) => {
        opened.push(String(url));
      },
    });
    registerActions();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("opens the wiki, poe2db and Craft of Exile pages of the item", () => {
    pressHotkey("open-wiki");
    pressHotkey("open-poedb");
    pressHotkey("open-craft-of-exile");

    expect(opened).toEqual([
      "https://www.poe2wiki.net/wiki/The Eternal Spark",
      "https://poe2db.tw/us/The_Eternal_Spark",
      `https://craftofexile.com/?game=poe2&eimport=${encodeURIComponent(UniqueItem.rawText)}`,
    ]);
  });

  it("searches the stash for the item's name", () => {
    pressHotkey("search-similar");

    expect(sent).toEqual([
      {
        name: "CLIENT->MAIN::user-action",
        payload: { action: "stash-search", text: '"The Eternal Spark"' },
      },
    ]);
  });

  it("does nothing for text that is not an item", () => {
    pressHotkey("open-wiki", "Hello");

    expect(opened).toEqual([]);
    expect(sent).toEqual([]);
  });
});
