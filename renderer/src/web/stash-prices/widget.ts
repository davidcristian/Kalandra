import type { Anchor, Widget } from "../overlay/widgets";
import { disableWidget, enableWidget } from "../settings/utils";
import {
  DEFAULT_INTERVAL_MINUTES,
  DEFAULT_SEARCH_BUDGET,
} from "./reader-settings";
import type { GridCorrection } from "./stash-grid";

export const DEFAULT_TAB_NAME = "kalandra-price-check";

export interface StashPricesWidget extends Widget {
  anchor: Anchor;
  enabled: boolean;
  tabName: string;
  intervalMinutes: number;
  searchBudget: number;
  /** Whether Windows captures the game window to see the open tab. */
  captureEnabled: boolean;
  /** The hotkey that marks the tab open or closed by hand. */
  toggleKey: string | null;
  gridCorrection: GridCorrection;
}

/** The target of the `trigger-event` hotkey that marks the tab open or closed. */
export const TOGGLE_TARGET = "stash-prices-toggle";

/** The largest grid correction, in pixels or in percent. */
export const CORRECTION_LIMIT = 1000;

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
    captureEnabled: true,
    toggleKey: null,
    gridCorrection: { unit: "px", left: 0, top: 0, cell: 0 },
  };
}

/** Returns a grid correction the settings keep: a number from -1000 to 1000, or 0. */
export function clampCorrection(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(-CORRECTION_LIMIT, Math.min(CORRECTION_LIMIT, value));
}

/** Turns the reading on or off; the widget has a button in the main button bar only while it is on. */
export function setStashPricesEnabled(
  widget: StashPricesWidget,
  enabled: boolean,
): void {
  widget.enabled = enabled;
  if (enabled) {
    enableWidget(widget);
  } else {
    disableWidget(widget);
  }
}
