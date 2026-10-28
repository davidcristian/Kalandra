import { describe, expect, it } from "vitest";
import {
  clampThresholdAmount,
  type HighlightInput,
  highlightView,
  markKind,
  thresholdInDivine,
} from "@/web/stash-prices/highlight-marks";
import type { ListingPrice } from "@/web/stash-prices/price-item";
import { countPrices } from "@/web/stash-prices/pricer-state";
import { placed } from "./fake-capture";

// Divine Orbs per unit in the price file fixture of priceService/tests
const UNIT_PRICES: Record<string, number> = {
  "Chaos Orb": 0.1173,
  "Exalted Orb": 0.001846,
};

function priced(value: number): ListingPrice {
  return {
    status: "priced",
    value,
    low: value / 2,
    high: value * 2,
    reliability: "high",
    source: "listings",
  };
}

const BOTH = { valuable: true, trash: true };
const GRID = { left: 17, top: 126.5, cell: 52.5 };

/** The input of a normal tab at 1920 x 1080 with the listings and prices given, both highlights on and a threshold of 1 Chaos Orb. */
function input(
  items: Array<[x: number, y: number, w: number, h: number, ListingPrice?]>,
  more: Partial<HighlightInput> = {},
): HighlightInput {
  const listings = items.map(([x, y, w, h]) => placed({ x, y, w, h }));
  const prices = new Map(
    items.flatMap(([x, y, , , price]) =>
      price ? [[`item-${x}-${y}`, price] as const] : [],
    ),
  );
  return {
    open: true,
    quad: false,
    grid: GRID,
    listings,
    prices,
    counts: countPrices(prices),
    threshold: 0.1173,
    toggles: BOTH,
    alignmentView: false,
    ...more,
  };
}

describe("the trash threshold", () => {
  it.each([
    [{ amount: 1, currency: "chaos" }, 0.1173],
    [{ amount: 2, currency: "exalted" }, 0.003692],
    [{ amount: 0.5, currency: "div" }, 0.5],
  ] as const)("converts %o to Divine Orbs", (threshold, divine) => {
    expect(
      thresholdInDivine(threshold, (name) => UNIT_PRICES[name]),
    ).toBeCloseTo(divine, 9);
  });

  it("needs no price for a threshold in Divine Orbs", () => {
    expect(thresholdInDivine({ amount: 3, currency: "div" }, () => 0)).toBe(3);
  });

  it.each([undefined, 0, -1, Number.NaN])(
    "has no threshold when the price file's Chaos Orb price is %s",
    (price) => {
      expect(
        thresholdInDivine({ amount: 1, currency: "chaos" }, () => price),
      ).toBeNull();
    },
  );

  it("keeps the amount at 0 or more, and 1 for a value that is not a number", () => {
    expect(clampThresholdAmount(-2)).toBe(0);
    expect(clampThresholdAmount(Number.NaN)).toBe(1);
    expect(clampThresholdAmount(2.5)).toBe(2.5);
    expect(
      thresholdInDivine(
        { amount: Number.NaN, currency: "chaos" },
        (name) => UNIT_PRICES[name],
      ),
    ).toBe(0.1173);
  });
});

describe("the mark of a listing", () => {
  it.each([
    [priced(0.5), "valuable"],
    [priced(0.1173), "valuable"],
    [priced(0.1), "trash"],
    [{ status: "pricing" }, "pricing"],
    [{ status: "too-few" }, "unpriced"],
    [{ status: "cannot-read", reason: "stash_prices.unreadable" }, "unpriced"],
    [{ status: "failed", message: "Rate limit exceeded" }, "unpriced"],
    [{ status: "queued" }, null],
    [undefined, null],
  ] as const)("marks %o as %s", (price, kind) => {
    expect(markKind(price, 0.1173, BOTH)).toBe(kind);
  });

  it("leaves out the valuable or the trash mark when its highlight is off", () => {
    const valuableOff = { valuable: false, trash: true };
    const trashOff = { valuable: true, trash: false };

    expect(markKind(priced(0.5), 0.1173, valuableOff)).toBeNull();
    expect(markKind(priced(0.1), 0.1173, valuableOff)).toBe("trash");
    expect(markKind(priced(0.1), 0.1173, trashOff)).toBeNull();
    expect(markKind(priced(0.5), 0.1173, trashOff)).toBe("valuable");
  });

  it("marks no item trash without a threshold", () => {
    expect(markKind(priced(0.0001), null, BOTH)).toBe("valuable");
  });
});

describe("the view over the stash", () => {
  it("places each mark on its item's cells, with the price of a priced one", () => {
    const view = highlightView(
      input([
        [0, 0, 1, 1, priced(2)],
        [3, 2, 2, 3, priced(0.05)],
        [11, 11, 1, 1, { status: "too-few" }],
      ]),
    );

    expect(view.marks).toEqual([
      {
        id: "item-0-0",
        kind: "valuable",
        left: 17,
        top: 126.5,
        width: 52.5,
        height: 52.5,
        price: { value: 2, low: 1, high: 4 },
      },
      {
        id: "item-3-2",
        kind: "trash",
        left: 17 + 3 * 52.5,
        top: 126.5 + 2 * 52.5,
        width: 105,
        height: 157.5,
        price: { value: 0.05, low: 0.025, high: 0.1 },
      },
      {
        id: "item-11-11",
        kind: "unpriced",
        left: 17 + 11 * 52.5,
        top: 126.5 + 11 * 52.5,
        width: 52.5,
        height: 52.5,
        price: null,
      },
    ]);
  });

  it("puts the progress bar under the grid, as wide as it, filled by the share of the items done", () => {
    const view = highlightView(
      input([
        [0, 0, 1, 1, priced(2)],
        [1, 0, 1, 1, { status: "too-few" }],
        [2, 0, 1, 1, { status: "failed", message: "Rate limit exceeded" }],
        [3, 0, 1, 1, { status: "queued" }],
      ]),
    );

    expect(view.bar).toEqual({
      left: 17,
      top: 126.5 + 12 * 52.5 + 5.25,
      width: 630,
      height: 52.5 * 0.45,
      done: 2,
      total: 4,
      share: 0.5,
    });
  });

  it("places the marks and the bar of a quad tab on its half size cells", () => {
    const quadGrid = { left: 17, top: 126.5, cell: 26.25 };
    const view = highlightView(
      input([[23, 22, 1, 2, priced(1)]], { quad: true, grid: quadGrid }),
    );

    expect(view.marks[0]).toMatchObject({
      left: 17 + 23 * 26.25,
      top: 126.5 + 22 * 26.25,
      width: 26.25,
      height: 52.5,
    });
    expect(view.bar).toMatchObject({ width: 630, height: 52.5 * 0.45 });
  });

  it("draws nothing over a closed tab", () => {
    const view = highlightView(
      input([[0, 0, 1, 1, priced(2)]], { open: false }),
    );

    expect(view).toEqual({ marks: [], bar: null, cells: null });
  });

  it("draws no mark for a listing the pricer has not queued yet, and an empty bar for no listings", () => {
    expect(highlightView(input([[0, 0, 1, 1]])).marks).toEqual([]);
    expect(highlightView(input([])).bar).toMatchObject({
      done: 0,
      total: 0,
      share: 0,
    });
  });

  it("keeps the plain and the light marks with both highlights off", () => {
    const view = highlightView(
      input(
        [
          [0, 0, 1, 1, priced(2)],
          [1, 0, 1, 1, priced(0.01)],
          [2, 0, 1, 1, { status: "cannot-read", reason: "x" }],
          [3, 0, 1, 1, { status: "pricing" }],
        ],
        { toggles: { valuable: false, trash: false } },
      ),
    );

    expect(view.marks.map((mark) => [mark.id, mark.kind])).toEqual([
      ["item-2-0", "unpriced"],
      ["item-3-0", "pricing"],
    ]);
  });

  it("marks every priced item valuable when the price file has no Chaos Orb price", () => {
    const view = highlightView(
      input(
        [
          [0, 0, 1, 1, priced(2)],
          [1, 0, 1, 1, priced(0.001)],
        ],
        { threshold: null },
      ),
    );

    expect(view.marks.map((mark) => mark.kind)).toEqual([
      "valuable",
      "valuable",
    ]);
  });

  it.each([
    [false, GRID, 12, 630],
    [true, { left: 17, top: 126.5, cell: 26.25 }, 24, 630],
  ])(
    "draws the cells of the grid alignment view, with the tab open or closed (quad: %s)",
    (quad, grid, side, size) => {
      const cells = { left: 17, top: 126.5, width: size, height: size };
      const shown = { ...cells, side, cell: grid.cell };

      for (const open of [true, false]) {
        const view = highlightView(
          input([[0, 0, 1, 1, priced(2)]], {
            open,
            quad,
            grid,
            alignmentView: true,
          }),
        );
        expect(view.cells).toEqual(shown);
      }
    },
  );
});
