import {
  type CellState,
  classifyCells,
  type PixelImage,
} from "./cell-classifier";
import type { StashListing } from "./stash-listings";
import { type Grid, needsQuad, sideOf } from "./stash-grid";

type Place = Pick<StashListing, "x" | "y" | "w" | "h">;

/** The fewest cells under the listings for which a frame can show the tab. */
export const MIN_ITEM_CELLS = 3;

/** The share of the item cells, and of all cells, that must match the listings. */
export const MIN_AGREEMENT = 0.9;

/** How a layout of cells matches the listings. */
export interface LayoutMatch {
  /** The cells under the listings. */
  itemCells: number;
  /** The share of the item cells that look filled. */
  items: number;
  /** The share of all cells that look as the listings say: filled under a listing, empty elsewhere. */
  cells: number;
}

export interface TabMatch extends LayoutMatch {
  quad: boolean;
  seen: boolean;
}

/** Returns which cells of a grid with `side` cells on a side hold a listing, row by row. */
export function expectedCells(
  listings: readonly Place[],
  side: number,
): boolean[] {
  const filled = new Array<boolean>(side * side).fill(false);
  for (const listing of listings) {
    for (let row = listing.y; row < listing.y + listing.h; row++) {
      for (let column = listing.x; column < listing.x + listing.w; column++) {
        if (row >= 0 && row < side && column >= 0 && column < side) {
          filled[row * side + column] = true;
        }
      }
    }
  }
  return filled;
}

/** Compares the states of the cells with the cells the listings fill. */
export function compareLayout(
  states: readonly CellState[],
  expected: readonly boolean[],
): LayoutMatch {
  let itemCells = 0;
  let itemsSeen = 0;
  let matching = 0;
  expected.forEach((filled, at) => {
    if (filled) itemCells += 1;
    if (filled && states[at] === "filled") itemsSeen += 1;
    if (states[at] === (filled ? "filled" : "empty")) matching += 1;
  });
  return {
    itemCells,
    items: itemCells === 0 ? 0 : itemsSeen / itemCells,
    cells: expected.length === 0 ? 0 : matching / expected.length,
  };
}

/** Returns whether a layout shows the tab: enough item cells, and most item cells and most cells match. */
export function showsTab(match: LayoutMatch): boolean {
  return (
    match.itemCells >= MIN_ITEM_CELLS &&
    match.items >= MIN_AGREEMENT &&
    match.cells >= MIN_AGREEMENT
  );
}

/**
 * Compares an image of the game window with the listings of the tab: as a quad tab, and also as a normal tab when
 * the listings fit one. Returns the layout that shows the tab, or else the one where more cells match.
 */
export function matchTab(
  image: PixelImage,
  gridOf: (quad: boolean) => Grid,
  listings: readonly Place[],
): TabMatch {
  const layouts = needsQuad(listings) ? [true] : [false, true];
  const matches = layouts.map((quad): TabMatch => {
    const side = sideOf(quad);
    const match = compareLayout(
      classifyCells(image, gridOf(quad), side),
      expectedCells(listings, side),
    );
    return { ...match, quad, seen: showsTab(match) };
  });
  return matches.reduce((best, match) =>
    (match.seen && !best.seen) ||
    (match.seen === best.seen && match.cells > best.cells)
      ? match
      : best,
  );
}
