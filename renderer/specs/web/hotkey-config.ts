import { defaultConfigMock } from "@specs/vitest.setup";
import { AppConfig, Config } from "@/web/Config";
import type { Widget } from "@/web/overlay/interfaces";

/** Returns a widget entry with the frame fields set and the widget's own fields from `fields`. */
export function widgetEntry(
  wmId: number,
  wmType: string,
  fields: object,
): Widget {
  return {
    wmId,
    wmType,
    wmTitle: "",
    wmWants: "hide",
    wmZorder: null,
    wmFlags: [],
    ...fields,
  };
}

/** Returns a config with every single widget that has a hotkey, and only the price check and overlay keys set. */
export function hotkeyConfig(): Config {
  defaultConfigMock({
    overlayKey: "Shift + Space",
    widgets: [
      widgetEntry(1, "price-check", {
        hotkey: "D",
        hotkeyHold: "Ctrl",
        hotkeyLocked: "Ctrl + Alt + D",
      }),
      widgetEntry(2, "item-check", {
        hotkey: null,
        wikiKey: null,
        poedbKey: null,
        craftOfExileKey: null,
        stashSearchKey: null,
        samePricedKey: null,
      }),
      widgetEntry(3, "library", { logItemKey: null }),
      widgetEntry(4, "delve-grid", { toggleKey: null }),
    ],
  });
  return JSON.parse(JSON.stringify(AppConfig()));
}
