import type { Anchor, Widget } from "../overlay/widgets";
import {
  DEFAULT_INTERVAL_MINUTES,
  DEFAULT_SEARCH_BUDGET,
} from "./reader-settings";

export const DEFAULT_TAB_NAME = "kalandra-price-check";

export interface StashPricesWidget extends Widget {
  anchor: Anchor;
  enabled: boolean;
  tabName: string;
  intervalMinutes: number;
  searchBudget: number;
}

/** Returns the widget's config in a new config: off, and left out of the main button bar until it is turned on. */
export function stashPricesDefault(): StashPricesWidget {
  return {
    wmId: 0,
    wmType: "stash-prices",
    wmTitle: "{icon=fa-tags}",
    wmWants: "hide",
    wmZorder: null,
    wmFlags: ["invisible-on-blur", "menu::skip"],
    anchor: { pos: "tl", x: 5, y: 12 },
    enabled: false,
    tabName: DEFAULT_TAB_NAME,
    intervalMinutes: DEFAULT_INTERVAL_MINUTES,
    searchBudget: DEFAULT_SEARCH_BUDGET,
  };
}
