import { CLIENT_STRINGS as _$ } from "@/assets/data";
import type { Widget, Anchor } from "../overlay/widgets.js";

export interface StashSearchWidget extends Widget {
  anchor: Anchor;
  enableHotkeys: boolean;
  entries: Array<{
    id: number;
    name: string;
    text: string;
    hotkey: string | null;
  }>;
}

/** Returns the searches of a widget added from the menu: the Currency rarity in the game language. */
export function newWidgetEntries(): StashSearchWidget["entries"] {
  return [{ id: 1, name: "", text: _$.RARITY_CURRENCY, hotkey: null }];
}
