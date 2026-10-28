import type { Grid } from "./stash-grid";

/** RGBA pixels row by row, as `ImageData` holds them. */
export interface PixelImage {
  width: number;
  height: number;
  data: ArrayLike<number>;
}

export type PixelKind = "item" | "empty" | "other";

export type CellState = "filled" | "empty" | "unknown";

/** How far into a cell its four samples are, as a fraction of the cell: item art covers the middle of a cell. */
export const CORNER_INSET = 0.1;

// The thresholds hold for the colors of docs/reference-images/DumpSortCurrency.jpg: an item's navy is about
// (4, 4, 42), the red of an item the character cannot use about (60, 4, 5), and an empty cell's corner about (8, 8, 8)
const ITEM_HUE = 18;
const UNUSABLE_HUE = 25;
const EMPTY_BRIGHTNESS = 40;
const EMPTY_SPREAD = 10;

/** Returns whether a pixel looks like an item's background, an empty cell, or anything else. */
export function pixelKind(red: number, green: number, blue: number): PixelKind {
  if (
    blue - Math.max(red, green) >= ITEM_HUE ||
    red - Math.max(green, blue) >= UNUSABLE_HUE
  ) {
    return "item";
  }
  const brightest = Math.max(red, green, blue);
  if (
    brightest <= EMPTY_BRIGHTNESS &&
    brightest - Math.min(red, green, blue) <= EMPTY_SPREAD
  ) {
    return "empty";
  }
  return "other";
}

/** Returns a cell's state from the kinds of its four samples: two item samples fill it, art can cover the others. */
export function cellState(kinds: readonly PixelKind[]): CellState {
  const items = kinds.filter((kind) => kind === "item").length;
  if (items >= 2) return "filled";
  const empties = kinds.filter((kind) => kind === "empty").length;
  return items === 0 && empties >= 3 ? "empty" : "unknown";
}

function kindAt(image: PixelImage, x: number, y: number): PixelKind {
  const column = Math.floor(x);
  const row = Math.floor(y);
  if (column < 0 || row < 0 || column >= image.width || row >= image.height) {
    return "other";
  }
  const at = (row * image.width + column) * 4;
  return pixelKind(image.data[at], image.data[at + 1], image.data[at + 2]);
}

/** Returns the state of each cell of a grid with `side` cells on a side, row by row. */
export function classifyCells(
  image: PixelImage,
  grid: Grid,
  side: number,
): CellState[] {
  const near = CORNER_INSET;
  const far = 1 - CORNER_INSET;
  const states: CellState[] = [];
  for (let row = 0; row < side; row++) {
    for (let column = 0; column < side; column++) {
      const x = (fraction: number) =>
        grid.left + (column + fraction) * grid.cell;
      const y = (fraction: number) => grid.top + (row + fraction) * grid.cell;
      states.push(
        cellState([
          kindAt(image, x(near), y(near)),
          kindAt(image, x(far), y(near)),
          kindAt(image, x(near), y(far)),
          kindAt(image, x(far), y(far)),
        ]),
      );
    }
  }
  return states;
}
