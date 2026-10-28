import { present } from "@specs/present";
import { describe, expect, it } from "vitest";
import { shortcutActions } from "@/web/shortcut-actions";
import { findWidget } from "@/web/settings/utils";
import type { ItemCheckWidget } from "@/web/item-check/widget";
import type { LibraryWidget } from "@/web/library/widget";
import { hotkeyConfig, widgetEntry } from "./hotkey-config";

describe("the hotkeys the renderer sends to main", () => {
  it("joins the price check key to its hold key and always adds the overlay key", () => {
    expect(shortcutActions(hotkeyConfig())).toEqual([
      {
        shortcut: "Ctrl + D",
        action: {
          type: "copy-item",
          target: "price-check",
          focusOverlay: false,
        },
        keepModKeys: true,
      },
      {
        shortcut: "Ctrl + Alt + D",
        action: {
          type: "copy-item",
          target: "price-check",
          focusOverlay: true,
        },
      },
      { shortcut: "Shift + Space", action: { type: "toggle-overlay" } },
    ]);
  });

  it("adds each item check and library hotkey that is set", () => {
    const config = hotkeyConfig();
    const itemCheck = present(
      findWidget<ItemCheckWidget>("item-check", config),
    );
    itemCheck.wikiKey = "Alt + W";
    itemCheck.craftOfExileKey = "Alt + E";
    itemCheck.poedbKey = "Alt + Q";
    itemCheck.stashSearchKey = "Alt + S";
    itemCheck.samePricedKey = "Alt + P";
    itemCheck.hotkey = "Alt + M";
    present(findWidget<LibraryWidget>("library", config)).logItemKey =
      "Alt + L";

    expect(shortcutActions(config).slice(3)).toEqual([
      {
        shortcut: "Alt + W",
        action: { type: "copy-item", target: "open-wiki" },
      },
      {
        shortcut: "Alt + E",
        action: { type: "copy-item", target: "open-craft-of-exile" },
      },
      {
        shortcut: "Alt + Q",
        action: { type: "copy-item", target: "open-poedb" },
      },
      {
        shortcut: "Alt + S",
        action: { type: "copy-item", target: "search-similar" },
      },
      {
        shortcut: "Alt + P",
        action: { type: "copy-item", target: "search-same-priced" },
      },
      {
        shortcut: "Alt + M",
        action: { type: "copy-item", target: "item-check", focusOverlay: true },
      },
      {
        shortcut: "Alt + L",
        keepModKeys: true,
        action: { type: "copy-item", target: "log-item" },
      },
    ]);
  });

  it("leaves out the Craft of Exile key for a language other than English", () => {
    const config = hotkeyConfig();
    config.language = "de";
    present(findWidget<ItemCheckWidget>("item-check", config)).craftOfExileKey =
      "Alt + E";

    expect(shortcutActions(config).slice(3)).toEqual([]);
  });

  it("adds the chat commands that have a hotkey", () => {
    const config = hotkeyConfig();
    config.commands = [
      { text: "/hideout", hotkey: "F5", send: true },
      { text: "/exit", hotkey: null, send: true },
      { text: "@last ty", hotkey: "F6", send: false },
    ];

    expect(shortcutActions(config).slice(3)).toEqual([
      {
        shortcut: "F5",
        action: { type: "paste-in-chat", text: "/hideout", send: true },
      },
      {
        shortcut: "F6",
        action: { type: "paste-in-chat", text: "@last ty", send: false },
      },
    ]);
  });

  it("adds the stash search entries only while the widget's hotkeys are on", () => {
    const config = hotkeyConfig();
    const entries = [
      { id: 1, name: "", text: "waystone", hotkey: "Alt + 1" },
      { id: 2, name: "", text: "rune", hotkey: null },
    ];
    config.widgets.push(
      widgetEntry(5, "stash-search", { enableHotkeys: true, entries }),
      widgetEntry(6, "stash-search", { enableHotkeys: false, entries }),
    );

    expect(shortcutActions(config).slice(3)).toEqual([
      {
        shortcut: "Alt + 1",
        action: { type: "stash-search", text: "waystone" },
      },
    ]);
  });

  it("targets each stopwatch by its widget id and adds no key for the saved item search OCR key", () => {
    const config = hotkeyConfig();
    config.widgets.push(
      widgetEntry(7, "timer", { toggleKey: "Alt + T", resetKey: null }),
      widgetEntry(8, "timer", { toggleKey: null, resetKey: "Alt + R" }),
      widgetEntry(9, "item-search", { ocrGemsKey: "Alt + O" }),
    );

    expect(shortcutActions(config).slice(3)).toEqual([
      {
        shortcut: "Alt + T",
        keepModKeys: true,
        action: { type: "trigger-event", target: "stopwatch-start-stop:7" },
      },
      {
        shortcut: "Alt + R",
        keepModKeys: true,
        action: { type: "trigger-event", target: "stopwatch-reset:8" },
      },
    ]);
  });

  it("adds the stash prices toggle key only while stash prices is on", () => {
    const config = hotkeyConfig();
    config.widgets.push(
      widgetEntry(10, "stash-prices", { enabled: true, toggleKey: "Alt + S" }),
      widgetEntry(11, "stash-prices", { enabled: false, toggleKey: "Alt + X" }),
      widgetEntry(12, "stash-prices", { enabled: true, toggleKey: null }),
    );

    expect(shortcutActions(config).slice(3)).toEqual([
      {
        shortcut: "Alt + S",
        keepModKeys: true,
        action: { type: "trigger-event", target: "stash-prices-toggle" },
      },
    ]);
  });
});
