import type { StashListing } from "./stash-listings";

// The grid of a normal tab as fractions of the game window's height: estimates from a 3840 x 2160 screenshot of the
// stash, aligned on the HUD with a 1920 x 1080 screenshot, until the in-game check measures them
export const GRID_LEFT = 17 / 1080;
export const GRID_TOP = 126.5 / 1080;
export const GRID_CELL = 52.5 / 1080;

/** The cells on each side of a normal tab and of a quad tab, which has the same size. */
export const NORMAL_SIDE = 12;
export const QUAD_SIDE = 24;

export type GridUnit = "px" | "%";

/** The user's correction of the grid: pixels of the game window, or percent of its height. */
export interface GridCorrection {
  unit: GridUnit;
  left: number;
  top: number;
  cell: number;
}

/** The top left corner of a stash grid and the size of one of its cells. */
export interface Grid {
  left: number;
  top: number;
  cell: number;
}

export interface Size {
  width: number;
  height: number;
}

/** The overlay window's size in CSS pixels, and its device pixels per CSS pixel. */
export interface Viewport extends Size {
  dpr: number;
}

/** Where the overlay's CSS pixels are in a captured frame: x in the frame is `left + x * scale`. */
export interface FrameMapping {
  left: number;
  top: number;
  scale: number;
}

export function sideOf(quad: boolean): number {
  return quad ? QUAD_SIDE : NORMAL_SIDE;
}

/** Returns whether a listing needs a quad tab: one of its cells is past the 12th column or row. */
export function needsQuad(
  listings: ReadonlyArray<Pick<StashListing, "x" | "y" | "w" | "h">>,
): boolean {
  return listings.some(
    (listing) =>
      listing.x + listing.w > NORMAL_SIDE ||
      listing.y + listing.h > NORMAL_SIDE,
  );
}

/** Returns the tab's grid in CSS pixels of the overlay, which covers the game window's client area. */
export function stashGrid(
  view: Viewport,
  quad: boolean,
  correction: GridCorrection,
): Grid {
  const toCss = (value: number) => {
    const amount = Number.isFinite(value) ? value : 0;
    return correction.unit === "%"
      ? (view.height * amount) / 100
      : amount / view.dpr;
  };
  const cell = Math.max(1, view.height * GRID_CELL + toCss(correction.cell));
  return {
    left: view.height * GRID_LEFT + toCss(correction.left),
    top: view.height * GRID_TOP + toCss(correction.top),
    cell: quad ? cell / 2 : cell,
  };
}

/**
 * Returns where the overlay is in a frame of the game window. The frame of a windowed game also has its title bar
 * and borders, and a frame smaller than the window is scaled down.
 */
export function frameMapping(frame: Size, view: Viewport): FrameMapping {
  const client = {
    width: view.width * view.dpr,
    height: view.height * view.dpr,
  };
  const shrink = Math.min(
    1,
    frame.width / client.width,
    frame.height / client.height,
  );
  const border = Math.max(0, (frame.width - client.width * shrink) / 2);
  return {
    left: border,
    top: Math.max(0, frame.height - client.height * shrink - border),
    scale: view.dpr * shrink,
  };
}

/** Returns a grid of the overlay's CSS pixels in the pixels of a frame. */
export function gridInFrame(grid: Grid, mapping: FrameMapping): Grid {
  return {
    left: mapping.left + grid.left * mapping.scale,
    top: mapping.top + grid.top * mapping.scale,
    cell: grid.cell * mapping.scale,
  };
}

/** Returns a grid in an image that is `scale` times the size of the one it was in. */
export function scaleGrid(grid: Grid, scale: number): Grid {
  return {
    left: grid.left * scale,
    top: grid.top * scale,
    cell: grid.cell * scale,
  };
}

/** The width of a quad tab's cell, in pixels, in the image that the capture reads from a frame. */
export const SAMPLE_CELL = 16;

/**
 * Returns the part of a frame to read, from its top left corner to the far corner of the grid, and the scale to read
 * it at, which keeps a quad tab's cell `SAMPLE_CELL` pixels wide or at its size in the frame.
 */
export function sampleArea(
  frame: Size,
  normal: Grid,
): Size & { scale: number } {
  const span = normal.cell * NORMAL_SIDE;
  const fit = (end: number, limit: number) =>
    Math.max(1, Math.min(limit, Math.ceil(end)));
  return {
    width: fit(normal.left + span, frame.width),
    height: fit(normal.top + span, frame.height),
    scale: Math.min(1, SAMPLE_CELL / (normal.cell / 2)),
  };
}
