import type { PixelImage } from "@/web/stash-prices/cell-classifier";
import type { Grid } from "@/web/stash-prices/stash-grid";

type Rgb = readonly [number, number, number];

// The colors of docs/reference-images/DumpSortCurrency.jpg
export const NAVY: Rgb = [4, 4, 42];
export const RED: Rgb = [60, 4, 5];
const EMPTY_CELL: Rgb = [8, 8, 8];
const CLOVER: Rgb = [22, 22, 22];
const GRID_LINE: Rgb = [89, 83, 69];
const ART: Rgb = [88, 88, 96];

/** Returns the same numbers from 0 to 1 for the same seed (mulberry32), so each test draws the same frame. */
export function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let mixed = Math.imul(state ^ (state >>> 15), 1 | state);
    mixed = (mixed + Math.imul(mixed ^ (mixed >>> 7), 61 | mixed)) ^ mixed;
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
  };
}

/** An item in the tab, by its cells, with a red background when the character cannot use it. */
export interface SyntheticItem {
  x: number;
  y: number;
  w: number;
  h: number;
  unusable?: boolean;
}

/** A frame of the game window drawn from the parts of a real stash tab, with noise on every pixel. */
export class SyntheticFrame implements PixelImage {
  readonly data: Uint8ClampedArray;
  private readonly next: () => number;

  constructor(
    readonly width: number,
    readonly height: number,
    seed = 1,
  ) {
    this.data = new Uint8ClampedArray(width * height * 4);
    this.next = seededRandom(seed);
  }

  /** Fills the frame with random colors, as a game scene, or with dark gray ones, as a night scene. */
  gameWorld(dark = false): this {
    for (let at = 0; at < this.data.length; at += 4) {
      const gray = this.next() * 30;
      const color: Rgb = dark
        ? [gray, gray, gray]
        : [this.next() * 255, this.next() * 255, this.next() * 255];
      this.setAt(at, color, 0);
    }
    return this;
  }

  /** Draws a stash grid with `side` cells on a side: the items, the clover of the other cells and the grid lines. */
  stash(grid: Grid, side: number, items: readonly SyntheticItem[]): this {
    for (let row = 0; row < side; row++) {
      for (let column = 0; column < side; column++) {
        const left = grid.left + column * grid.cell;
        const top = grid.top + row * grid.cell;
        this.rect(left, top, grid.cell, grid.cell, EMPTY_CELL);
        const middle = grid.cell / 2;
        this.ellipse(
          left + middle,
          top + middle,
          middle * 0.6,
          middle * 0.6,
          CLOVER,
        );
      }
    }
    for (const item of items) {
      const left = grid.left + item.x * grid.cell;
      const top = grid.top + item.y * grid.cell;
      const width = item.w * grid.cell;
      const height = item.h * grid.cell;
      this.rect(left, top, width, height, item.unusable ? RED : NAVY);
      this.ellipse(
        left + width / 2,
        top + height / 2,
        width * 0.35,
        height * 0.35,
        ART,
      );
    }
    for (let line = 0; line <= side; line++) {
      const across = grid.left + line * grid.cell;
      const down = grid.top + line * grid.cell;
      this.rect(across, grid.top, 1, side * grid.cell, GRID_LINE);
      this.rect(grid.left, down, side * grid.cell, 1, GRID_LINE);
    }
    return this;
  }

  private rect(
    left: number,
    top: number,
    width: number,
    height: number,
    color: Rgb,
  ) {
    for (
      let y = Math.max(0, Math.floor(top));
      y < Math.min(this.height, top + height);
      y++
    ) {
      for (
        let x = Math.max(0, Math.floor(left));
        x < Math.min(this.width, left + width);
        x++
      ) {
        this.setAt((y * this.width + x) * 4, color, 3);
      }
    }
  }

  private ellipse(cx: number, cy: number, rx: number, ry: number, color: Rgb) {
    for (
      let y = Math.max(0, Math.floor(cy - ry));
      y < Math.min(this.height, cy + ry);
      y++
    ) {
      for (
        let x = Math.max(0, Math.floor(cx - rx));
        x < Math.min(this.width, cx + rx);
        x++
      ) {
        if (((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1) {
          this.setAt((y * this.width + x) * 4, color, 3);
        }
      }
    }
  }

  // Video compression changes each pixel a little: the reference navy came out of a capture as (3, 6, 40)
  private setAt(at: number, color: Rgb, noise: number) {
    for (let channel = 0; channel < 3; channel++) {
      this.data[at + channel] = color[channel] + (this.next() * 2 - 1) * noise;
    }
    this.data[at + 3] = 255;
  }
}
