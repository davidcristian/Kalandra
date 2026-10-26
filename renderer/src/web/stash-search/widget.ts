import type { Widget, Anchor } from "../overlay/widgets.js";
import { entrySearchText, type StashSearchEntry } from "./presets.js";

export interface StashSearchWidget extends Widget {
  anchor: Anchor;
  enableHotkeys: boolean;
  entries: StashSearchEntry[];
}

/** Returns the searches of a widget added from the menu: the Currency rarity in the game language. */
export function newWidgetEntries(): StashSearchWidget["entries"] {
  const entry: StashSearchEntry = {
    id: 1,
    name: "",
    text: "",
    hotkey: null,
    preset: "currency",
  };
  return [{ ...entry, text: entrySearchText(entry) }];
}
