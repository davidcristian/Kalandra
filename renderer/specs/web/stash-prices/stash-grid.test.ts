import { describe, expect, it } from "vitest";
import {
  frameMapping,
  type GridCorrection,
  gridInFrame,
  needsQuad,
  sampleArea,
  scaleGrid,
  stashGrid,
  type Viewport,
} from "@/web/stash-prices/stash-grid";

const NONE: GridCorrection = { unit: "px", left: 0, top: 0, cell: 0 };

const FULL_HD: Viewport = { width: 1920, height: 1080, dpr: 1 };

describe("stashGrid", () => {
  it("places a normal tab's grid by the window height alone", () => {
    expect(stashGrid(FULL_HD, false, NONE)).toEqual({
      left: 17,
      top: 161,
      cell: 52.5,
    });
    expect(
      stashGrid({ width: 2560, height: 1080, dpr: 1 }, false, NONE),
    ).toEqual({ left: 17, top: 161, cell: 52.5 });
    const at720 = stashGrid({ width: 1280, height: 720, dpr: 1 }, false, NONE);
    expect(at720.left).toBeCloseTo(17 * (2 / 3));
    expect(at720.top).toBeCloseTo(161 * (2 / 3));
    expect(at720.cell).toBe(35);
  });

  it("gives a quad tab the same corner and cells half as wide", () => {
    expect(stashGrid(FULL_HD, true, NONE)).toEqual({
      left: 17,
      top: 161,
      cell: 26.25,
    });
  });

  it("adds a correction in pixels of the game window, which are CSS pixels times the scale", () => {
    const corrected = stashGrid(
      { width: 1920, height: 1080, dpr: 1.5 },
      false,
      {
        unit: "px",
        left: 3,
        top: -6,
        cell: 1.5,
      },
    );

    expect(corrected.left).toBeCloseTo(17 + 2);
    expect(corrected.top).toBeCloseTo(161 - 4);
    expect(corrected.cell).toBeCloseTo(52.5 + 1);
  });

  it("adds a correction in percent of the window height, the same at every resolution", () => {
    const correction: GridCorrection = {
      unit: "%",
      left: 0.5,
      top: -1,
      cell: 0.1,
    };

    expect(stashGrid(FULL_HD, false, correction)).toEqual({
      left: 17 + 5.4,
      top: 161 - 10.8,
      cell: 52.5 + 1.08,
    });
    const at1440 = stashGrid(
      { width: 2560, height: 1440, dpr: 1 },
      false,
      correction,
    );
    expect(at1440.top / 1440).toBeCloseTo((161 - 10.8) / 1080);
  });

  it("reads a correction that is not a number as 0, and keeps a cell at least 1 pixel wide", () => {
    expect(
      stashGrid(FULL_HD, false, {
        unit: "px",
        left: Number.NaN,
        top: Number.POSITIVE_INFINITY,
        cell: -1000,
      }),
    ).toEqual({ left: 17, top: 161, cell: 1 });
  });
});

describe("needsQuad", () => {
  it("needs a quad tab for an item that reaches past the 12th column or row", () => {
    expect(needsQuad([])).toBe(false);
    expect(needsQuad([{ x: 11, y: 11, w: 1, h: 1 }])).toBe(false);
    expect(needsQuad([{ x: 10, y: 9, w: 2, h: 3 }])).toBe(false);
    expect(needsQuad([{ x: 11, y: 0, w: 2, h: 1 }])).toBe(true);
    expect(needsQuad([{ x: 0, y: 10, w: 1, h: 3 }])).toBe(true);
    expect(needsQuad([{ x: 23, y: 23, w: 1, h: 1 }])).toBe(true);
  });
});

describe("frameMapping", () => {
  it("maps a borderless game's frame one to one, or by the display scale", () => {
    expect(frameMapping({ width: 1920, height: 1080 }, FULL_HD)).toEqual({
      left: 0,
      top: 0,
      scale: 1,
    });
    expect(
      frameMapping(
        { width: 3840, height: 2160 },
        { width: 1920, height: 1080, dpr: 2 },
      ),
    ).toEqual({ left: 0, top: 0, scale: 2 });
  });

  it("finds the client area under the title bar of a windowed game", () => {
    // Window capture on Windows 11 keeps a 1 pixel border and a 31 pixel title bar
    expect(
      frameMapping(
        { width: 1602, height: 933 },
        { width: 1600, height: 900, dpr: 1 },
      ),
    ).toEqual({ left: 1, top: 32, scale: 1 });
  });

  it("scales the overlay down to a frame smaller than the window", () => {
    expect(frameMapping({ width: 960, height: 540 }, FULL_HD)).toEqual({
      left: 0,
      top: 0,
      scale: 0.5,
    });
  });
});

describe("the grid in a frame", () => {
  it("matches the cells of the 3840 x 2160 reference screenshot", () => {
    const view: Viewport = { width: 1920, height: 1080, dpr: 2 };
    const frame = { width: 3840, height: 2160 };

    // docs/reference-images/DumpSortCurrency.jpg, cropped 22 pixels from the left and 313 from the top
    expect(
      gridInFrame(stashGrid(view, false, NONE), frameMapping(frame, view)),
    ).toEqual({ left: 22 + 12, top: 313 + 9, cell: 105 });
  });

  it("scales a grid with the image it is in", () => {
    expect(scaleGrid({ left: 34, top: 322, cell: 105 }, 0.5)).toEqual({
      left: 17,
      top: 161,
      cell: 52.5,
    });
  });
});

describe("sampleArea", () => {
  it("reads the frame up to the grid's far corner, at the scale of a 32 pixel quad cell", () => {
    expect(
      sampleArea(
        { width: 3840, height: 2160 },
        { left: 34, top: 322, cell: 105 },
      ),
    ).toEqual({ width: 34 + 1260, height: 322 + 1260, scale: 32 / 52.5 });
  });

  it("keeps a small frame at its size and inside its edges", () => {
    expect(
      sampleArea({ width: 800, height: 600 }, { left: 10, top: 70, cell: 30 }),
    ).toEqual({ width: 370, height: 430, scale: 1 });
    expect(
      sampleArea({ width: 300, height: 200 }, { left: 10, top: 70, cell: 30 }),
    ).toEqual({ width: 300, height: 200, scale: 1 });
    expect(
      sampleArea(
        { width: 300, height: 200 },
        { left: -900, top: -900, cell: 30 },
      ),
    ).toEqual({ width: 1, height: 1, scale: 1 });
  });
});
