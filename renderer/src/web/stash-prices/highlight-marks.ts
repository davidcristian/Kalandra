/** Returns the mark of each item in the stash tab from its price, and places the marks, the progress bar and the cells. */

import type { ListingPrice } from "./price-item";
import type { PriceCounts } from "./pricer-state";
import { type Grid, NORMAL_SIDE, sideOf } from "./stash-grid";
import type { StashListing } from "./stash-listings";

export type ThresholdCurrency = "chaos" | "exalted" | "div";

/** An item is trash when the value of its whole stack is below this amount of the currency. */
export interface TrashThreshold {
  amount: number;
  currency: ThresholdCurrency;
}

export const DEFAULT_THRESHOLD_AMOUNT = 1;

// The price file prices each item in Divine Orbs, so a Divine Orb needs no price of its own
const CURRENCY_NAMES = { chaos: "Chaos Orb", exalted: "Exalted Orb" } as const;

/** The progress bar's height and its gap to the grid, in cells of a normal tab. */
const BAR_HEIGHT = 0.45;
const BAR_GAP = 0.1;

/** `valuable` and `trash` for a priced item, `unpriced` for an item that has no price, `pricing` during its search. */
export type MarkKind = "valuable" | "trash" | "unpriced" | "pricing";

export interface HighlightToggles {
  valuable: boolean;
  trash: boolean;
}

export interface Rect {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface ItemMark extends Rect {
  id: string;
  kind: MarkKind;
  /** The price of a valuable or a trash item: Divine Orbs for the whole stack. */
  price: { value: number; low: number; high: number } | null;
}

export interface ProgressBar extends Rect {
  done: number;
  total: number;
  /** The part of the bar that is filled, from 0 to 1. */
  share: number;
}

/** The area of the tab's grid, with the number and the size of its cells on a side. */
export interface GridCells extends Rect {
  side: number;
  cell: number;
}

export interface HighlightInput {
  open: boolean;
  quad: boolean;
  grid: Grid;
  listings: readonly StashListing[];
  prices: ReadonlyMap<string, ListingPrice>;
  counts: PriceCounts;
  /** The trash threshold in Divine Orbs, or null when the price file has no price for its currency. */
  threshold: number | null;
  toggles: HighlightToggles;
  alignmentView: boolean;
}

export interface HighlightView {
  marks: ItemMark[];
  bar: ProgressBar | null;
  cells: GridCells | null;
}

/** Returns a threshold amount the settings keep: 0 or more, or 1 for a value that is not a number. */
export function clampThresholdAmount(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_THRESHOLD_AMOUNT;
  return Math.max(0, value);
}

/** Returns the threshold in Divine Orbs from the unit prices of the price file, or null when it has no price. */
export function thresholdInDivine(
  threshold: TrashThreshold,
  unitPrice: (name: string) => number | undefined,
): number | null {
  const amount = clampThresholdAmount(threshold.amount);
  if (threshold.currency === "div") return amount;
  const price = unitPrice(CURRENCY_NAMES[threshold.currency]);
  if (price === undefined || !Number.isFinite(price) || price <= 0) return null;
  return amount * price;
}

/**
 * Returns the mark of a listing: valuable or trash for a priced one when that highlight is on, a plain mark for one
 * without a price, a light one while a search prices it, and none while it waits. Without a threshold no item is trash.
 */
export function markKind(
  price: ListingPrice | undefined,
  threshold: number | null,
  toggles: HighlightToggles,
): MarkKind | null {
  switch (price?.status) {
    case "priced":
      if (threshold !== null && price.value < threshold) {
        return toggles.trash ? "trash" : null;
      }
      return toggles.valuable ? "valuable" : null;
    case "pricing":
      return "pricing";
    case "too-few":
    case "cannot-read":
    case "failed":
      return "unpriced";
    default:
      return null;
  }
}

/** Returns where a listing's item is over the game: its cells in the tab's grid. */
export function itemRect(
  listing: Pick<StashListing, "x" | "y" | "w" | "h">,
  grid: Grid,
): Rect {
  return {
    left: grid.left + listing.x * grid.cell,
    top: grid.top + listing.y * grid.cell,
    width: listing.w * grid.cell,
    height: listing.h * grid.cell,
  };
}

/** Returns what the layer over the stash draws: the marks and the progress bar while the tab is open, and the cells. */
export function highlightView(input: HighlightInput): HighlightView {
  const { grid } = input;
  const side = sideOf(input.quad);
  const size = side * grid.cell;
  const cells = input.alignmentView
    ? {
        left: grid.left,
        top: grid.top,
        width: size,
        height: size,
        side,
        cell: grid.cell,
      }
    : null;
  if (!input.open) return { marks: [], bar: null, cells };

  const marks = input.listings.flatMap((listing): ItemMark[] => {
    const price = input.prices.get(listing.id);
    const kind = markKind(price, input.threshold, input.toggles);
    if (kind === null) return [];
    const value =
      price?.status === "priced"
        ? { value: price.value, low: price.low, high: price.high }
        : null;
    return [{ id: listing.id, kind, ...itemRect(listing, grid), price: value }];
  });
  const normalCell = size / NORMAL_SIDE;
  const { done, listings: total } = input.counts;
  const bar = {
    left: grid.left,
    top: grid.top + size + BAR_GAP * normalCell,
    width: size,
    height: BAR_HEIGHT * normalCell,
    done,
    total,
    share: total > 0 ? done / total : 0,
  };
  return { marks, bar, cells };
}
