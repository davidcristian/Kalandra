import { describe, expect, it } from "vitest";
import type { CellState } from "@/web/stash-prices/cell-classifier";
import type { Grid } from "@/web/stash-prices/stash-grid";
import {
  compareLayout,
  expectedCells,
  matchTab,
  showsTab,
} from "@/web/stash-prices/tab-match";
import { type SyntheticItem, SyntheticFrame } from "./synthetic-stash";

const NORMAL: Grid = { left: 17, top: 126.5, cell: 52.5 };
const QUAD: Grid = { ...NORMAL, cell: NORMAL.cell / 2 };
const gridOf = (quad: boolean) => (quad ? QUAD : NORMAL);

// A dump tab filled from the top left, a column at a time, as the game places items
const TAB: SyntheticItem[] = [
  { x: 0, y: 0, w: 2, h: 3 },
  { x: 0, y: 3, w: 2, h: 2 },
  { x: 0, y: 5, w: 1, h: 4 },
  { x: 1, y: 5, w: 1, h: 1, unusable: true },
  { x: 1, y: 6, w: 1, h: 1 },
  { x: 2, y: 0, w: 1, h: 1 },
  { x: 2, y: 1, w: 1, h: 1 },
  { x: 2, y: 2, w: 2, h: 2 },
  { x: 3, y: 0, w: 1, h: 2 },
];

function frameOf(grid: Grid, side: number, items: SyntheticItem[], seed = 1) {
  return new SyntheticFrame(700, 800, seed)
    .gameWorld()
    .stash(grid, side, items);
}

/** Returns `count` 1 x 1 items in the free cells after the tab's, a column at a time. */
function moreItems(count: number): SyntheticItem[] {
  const taken = expectedCells(TAB, 12);
  const items: SyntheticItem[] = [];
  for (let at = 0; at < 144 && items.length < count; at++) {
    const x = Math.floor(at / 12);
    const y = at % 12;
    if (!taken[y * 12 + x]) items.push({ x, y, w: 1, h: 1 });
  }
  return items;
}

describe("expectedCells", () => {
  it("fills every cell under each listing and leaves out cells past the side", () => {
    const cells = expectedCells(
      [
        { x: 0, y: 0, w: 2, h: 1 },
        { x: 11, y: 10, w: 2, h: 3 },
      ],
      12,
    );

    expect(cells.filter(Boolean)).toHaveLength(4);
    expect(cells[0] && cells[1]).toBe(true);
    expect(cells[10 * 12 + 11] && cells[11 * 12 + 11]).toBe(true);
  });
});

describe("compareLayout", () => {
  it("counts the item cells that look filled and all cells that look as the listings say", () => {
    const states: CellState[] = ["filled", "unknown", "empty", "filled"];

    expect(compareLayout(states, [true, true, false, false])).toEqual({
      itemCells: 2,
      items: 0.5,
      cells: 0.5,
    });
    expect(compareLayout([], [])).toEqual({ itemCells: 0, items: 0, cells: 0 });
  });
});

describe("showsTab", () => {
  it("shows the tab only with 3 item cells and 90% of the item cells and of all cells", () => {
    expect(showsTab({ itemCells: 3, items: 0.9, cells: 0.9 })).toBe(true);
    expect(showsTab({ itemCells: 2, items: 1, cells: 1 })).toBe(false);
    expect(showsTab({ itemCells: 40, items: 0.89, cells: 1 })).toBe(false);
    expect(showsTab({ itemCells: 40, items: 1, cells: 0.89 })).toBe(false);
  });
});

describe("matchTab", () => {
  it("sees the tab when its listings match the drawn cells", () => {
    const match = matchTab(frameOf(NORMAL, 12, TAB), gridOf, TAB);

    expect(match).toMatchObject({ quad: false, seen: true, itemCells: 24 });
    expect(match.items).toBeGreaterThanOrEqual(0.9);
    expect(match.cells).toBeGreaterThanOrEqual(0.9);
  });

  it("still sees the tab with 10 new items the listings do not have yet, and not with 20", () => {
    const fewMore = frameOf(NORMAL, 12, [...TAB, ...moreItems(10)]);
    const manyMore = frameOf(NORMAL, 12, [...TAB, ...moreItems(20)]);

    expect(matchTab(fewMore, gridOf, TAB).seen).toBe(true);
    expect(matchTab(manyMore, gridOf, TAB).seen).toBe(false);
  });

  it("does not see the tab in the game scene, a dark scene, an empty tab or another tab", () => {
    const scene = new SyntheticFrame(700, 800).gameWorld();
    const night = new SyntheticFrame(700, 800).gameWorld(true);
    const emptyTab = frameOf(NORMAL, 12, []);
    const otherTab = frameOf(NORMAL, 12, [
      { x: 0, y: 0, w: 2, h: 4 },
      { x: 4, y: 4, w: 2, h: 2 },
      { x: 8, y: 0, w: 4, h: 4 },
    ]);

    for (const frame of [scene, night, emptyTab, otherTab]) {
      expect(matchTab(frame, gridOf, TAB).seen).toBe(false);
    }
    expect(matchTab(night, gridOf, TAB).items).toBe(0);
  });

  it("does not see an empty tab for a few items, although most of its cells match", () => {
    const few = [{ x: 0, y: 0, w: 2, h: 2 }];

    const match = matchTab(frameOf(NORMAL, 12, []), gridOf, few);

    expect(match).toMatchObject({ seen: false, items: 0 });
    expect(match.cells).toBeGreaterThan(0.9);
  });

  it("does not see the tab when the grid is off by half a cell", () => {
    const frame = frameOf(NORMAL, 12, TAB);
    const shifted = { ...NORMAL, left: NORMAL.left + NORMAL.cell / 2 };

    expect(matchTab(frame, () => shifted, TAB).seen).toBe(false);
  });

  it("sees a quad tab whose listings fit in a normal tab's cells", () => {
    const frame = frameOf(QUAD, 24, TAB);

    expect(matchTab(frame, gridOf, TAB)).toMatchObject({
      quad: true,
      seen: true,
    });
    expect(matchTab(frameOf(NORMAL, 12, TAB), gridOf, TAB).quad).toBe(false);
  });

  it("reads only a quad layout for listings past the 12th column", () => {
    const listings = [...TAB, { x: 20, y: 22, w: 2, h: 2 }];

    expect(
      matchTab(frameOf(QUAD, 24, listings), gridOf, listings),
    ).toMatchObject({ quad: true, seen: true, itemCells: 28 });
    expect(matchTab(frameOf(NORMAL, 12, TAB), gridOf, listings)).toMatchObject({
      quad: true,
      seen: false,
    });
  });

  it("never sees a tab whose listings fill fewer than 3 cells", () => {
    const listings = [{ x: 0, y: 0, w: 1, h: 2 }];

    expect(
      matchTab(frameOf(NORMAL, 12, listings), gridOf, listings),
    ).toMatchObject({ seen: false, itemCells: 2, items: 1, cells: 1 });
  });
});
