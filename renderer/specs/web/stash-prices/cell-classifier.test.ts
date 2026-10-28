import { describe, expect, it } from "vitest";
import {
  type CellState,
  cellState,
  classifyCells,
  pixelKind,
} from "@/web/stash-prices/cell-classifier";
import { REFERENCE_LAYOUT, REFERENCE_SAMPLES } from "./reference-cells";
import { NAVY, RED, SyntheticFrame } from "./synthetic-stash";

const STATE_LETTER: Record<CellState, string> = {
  filled: "F",
  empty: "E",
  unknown: "?",
};

function rows(states: readonly CellState[], side: number): string[] {
  return Array.from({ length: side }, (_, row) =>
    states
      .slice(row * side, (row + 1) * side)
      .map((state) => STATE_LETTER[state])
      .join(""),
  );
}

function hexKind(hex: string) {
  const value = Number.parseInt(hex, 16);
  return pixelKind(value >> 16, (value >> 8) & 0xff, value & 0xff);
}

describe("pixelKind", () => {
  it("reads the colors of a stash tab", () => {
    expect(pixelKind(...NAVY)).toBe("item");
    // The reference navy after a window capture's video compression
    expect(pixelKind(3, 6, 40)).toBe("item");
    expect(pixelKind(...RED)).toBe("item");
    expect(pixelKind(8, 8, 8)).toBe("empty");
    expect(pixelKind(22, 22, 22)).toBe("empty");
    expect(pixelKind(9, 5, 4)).toBe("empty");
  });

  it("reads grid lines, item art and bright game scenes as neither", () => {
    expect(pixelKind(89, 83, 69)).toBe("other");
    expect(pixelKind(88, 88, 96)).toBe("other");
    expect(pixelKind(41, 41, 41)).toBe("other");
    expect(pixelKind(30, 18, 10)).toBe("other");
    expect(pixelKind(200, 180, 150)).toBe("other");
  });
});

describe("cellState", () => {
  it("fills a cell with two item corners, and empties it with three empty ones and no item", () => {
    expect(cellState(["item", "item", "other", "other"])).toBe("filled");
    expect(cellState(["item", "item", "empty", "empty"])).toBe("filled");
    expect(cellState(["empty", "empty", "empty", "other"])).toBe("empty");
    expect(cellState(["empty", "empty", "empty", "item"])).toBe("unknown");
    expect(cellState(["empty", "empty", "other", "other"])).toBe("unknown");
    expect(cellState(["item", "other", "other", "other"])).toBe("unknown");
  });

  it("reads every cell of the reference screenshot as the tab shows it", () => {
    const states = REFERENCE_SAMPLES.flatMap((row) =>
      row.split(" ").map((cell) => cellState(cell.split("/").map(hexKind))),
    );

    expect(rows(states, 12)).toEqual(REFERENCE_LAYOUT);
  });
});

describe("classifyCells", () => {
  const grid = { left: 17, top: 126.5, cell: 52.5 };

  it("finds the items, the unusable ones too, and the empty cells of a drawn tab", () => {
    const frame = new SyntheticFrame(700, 800).gameWorld().stash(grid, 12, [
      { x: 0, y: 0, w: 2, h: 3 },
      { x: 2, y: 0, w: 1, h: 1, unusable: true },
      { x: 2, y: 1, w: 1, h: 4 },
      { x: 11, y: 11, w: 1, h: 1 },
    ]);

    const found = rows(classifyCells(frame, grid, 12), 12);

    expect(found[0]).toBe("FFFEEEEEEEEE");
    expect(found[2]).toBe("FFFEEEEEEEEE");
    expect(found[4]).toBe("EEFEEEEEEEEE");
    expect(found[5]).toBe("EEEEEEEEEEEE");
    expect(found[11]).toBe("EEEEEEEEEEEF");
  });

  it("reads the cells of a quad tab at half the size", () => {
    const quad = { ...grid, cell: grid.cell / 2 };
    const frame = new SyntheticFrame(700, 800).gameWorld().stash(quad, 24, [
      { x: 0, y: 0, w: 1, h: 1 },
      { x: 23, y: 23, w: 1, h: 1 },
    ]);

    const states = classifyCells(frame, quad, 24);

    expect(states.filter((state) => state === "filled")).toHaveLength(2);
    expect(states[0]).toBe("filled");
    expect(states[24 * 24 - 1]).toBe("filled");
    expect(states.filter((state) => state === "empty")).toHaveLength(574);
  });

  it("knows nothing of the cells outside the image or over the game scene", () => {
    const frame = new SyntheticFrame(300, 300).gameWorld();

    const outside = classifyCells(frame, { left: 280, top: 280, cell: 50 }, 2);
    expect(outside).toEqual(["unknown", "unknown", "unknown", "unknown"]);
    const scene = classifyCells(frame, { left: 0, top: 0, cell: 25 }, 12);
    expect(scene.filter((state) => state === "empty")).toHaveLength(0);
  });
});
