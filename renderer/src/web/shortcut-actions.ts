import type { ShortcutAction } from "@ipc/types";
import type { Config } from "./Config";
import type * as widget from "./overlay/widgets";
import type { StashSearchWidget } from "./stash-search/widget";
import { entrySearchText } from "./stash-search/presets";
import type { ItemCheckWidget } from "./item-check/widget";
import type { LibraryWidget } from "./library/widget";
import { offersCraftOfExile } from "./item-check/craft-of-exile";

function widgetOfType<T extends widget.Widget>(config: Config, type: string) {
  return config.widgets.find((w) => w.wmType === type) as T;
}

/** Returns an action for each hotkey that is set in the config, for main to register. */
export function shortcutActions(config: Config): ShortcutAction[] {
  const actions: ShortcutAction[] = [];

  const priceCheck = widgetOfType<widget.PriceCheckWidget>(
    config,
    "price-check",
  );
  if (priceCheck.hotkey) {
    actions.push({
      shortcut: `${priceCheck.hotkeyHold} + ${priceCheck.hotkey}`,
      action: { type: "copy-item", target: "price-check", focusOverlay: false },
      keepModKeys: true,
    });
  }
  if (priceCheck.hotkeyLocked) {
    actions.push({
      shortcut: priceCheck.hotkeyLocked,
      action: { type: "copy-item", target: "price-check", focusOverlay: true },
    });
  }
  actions.push({
    shortcut: config.overlayKey,
    action: { type: "toggle-overlay" },
  });
  const itemCheck = widgetOfType<ItemCheckWidget>(config, "item-check");
  if (itemCheck.wikiKey) {
    actions.push({
      shortcut: itemCheck.wikiKey,
      action: { type: "copy-item", target: "open-wiki" },
    });
  }
  if (itemCheck.craftOfExileKey && offersCraftOfExile(config.language)) {
    actions.push({
      shortcut: itemCheck.craftOfExileKey,
      action: { type: "copy-item", target: "open-craft-of-exile" },
    });
  }
  if (itemCheck.poedbKey) {
    actions.push({
      shortcut: itemCheck.poedbKey,
      action: { type: "copy-item", target: "open-poedb" },
    });
  }
  if (itemCheck.stashSearchKey) {
    actions.push({
      shortcut: itemCheck.stashSearchKey,
      action: { type: "copy-item", target: "search-similar" },
    });
  }
  if (itemCheck.samePricedKey) {
    actions.push({
      shortcut: itemCheck.samePricedKey,
      action: { type: "copy-item", target: "search-same-priced" },
    });
  }
  if (itemCheck.hotkey) {
    actions.push({
      shortcut: itemCheck.hotkey,
      action: { type: "copy-item", target: "item-check", focusOverlay: true },
    });
  }
  const library = widgetOfType<LibraryWidget>(config, "library");
  if (library.logItemKey) {
    actions.push({
      shortcut: library.logItemKey,
      keepModKeys: true,
      action: { type: "copy-item", target: "log-item" },
    });
  }
  for (const command of config.commands) {
    if (command.hotkey) {
      actions.push({
        shortcut: command.hotkey,
        action: {
          type: "paste-in-chat",
          text: command.text,
          send: command.send,
        },
      });
    }
  }
  for (const widget of config.widgets) {
    if (widget.wmType === "stash-search") {
      const stashSearch = widget as StashSearchWidget;
      if (!stashSearch.enableHotkeys) continue;

      for (const entry of stashSearch.entries) {
        if (entry.hotkey) {
          actions.push({
            shortcut: entry.hotkey,
            action: { type: "stash-search", text: entrySearchText(entry) },
          });
        }
      }
    } else if (widget.wmType === "timer") {
      const stopwatch = widget as widget.StopwatchWidget;
      if (stopwatch.toggleKey) {
        actions.push({
          shortcut: stopwatch.toggleKey,
          keepModKeys: true,
          action: {
            type: "trigger-event",
            target: `stopwatch-start-stop:${widget.wmId}`,
          },
        });
      }
      if (stopwatch.resetKey) {
        actions.push({
          shortcut: stopwatch.resetKey,
          keepModKeys: true,
          action: {
            type: "trigger-event",
            target: `stopwatch-reset:${widget.wmId}`,
          },
        });
      }
    }
  }

  return actions;
}
