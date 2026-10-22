import { describe, expect, it } from "vitest";
import {
  findLines,
  groupWeightedPoints,
  hsvToU8,
  type WeightedPoint,
} from "../src/vision/utils";

const point = (x: number, y: number, weight = 1): WeightedPoint => ({
  x,
  y,
  weight,
});

describe("groupWeightedPoints", () => {
  it("keeps the heaviest point of each group of points closer than the radius", () => {
    const points = [
      point(10, 10, 0.8),
      point(12, 11, 0.9),
      point(14, 10, 0.85),
      point(40, 10, 0.76),
    ];

    expect(groupWeightedPoints(points, 5)).toEqual([
      point(12, 11, 0.9),
      point(40, 10, 0.76),
    ]);
  });

  it("starts a new group for a point exactly the radius away", () => {
    expect(groupWeightedPoints([point(0, 0), point(3, 4)], 5)).toEqual([
      point(0, 0),
      point(3, 4),
    ]);
  });
});

describe("findLines", () => {
  it("pairs each point with the nearest point to its right whose height differs by at most the tolerance", () => {
    const points = [
      point(300, 52),
      point(100, 50),
      point(200, 80),
      point(400, 56),
      point(500, 51),
    ];

    expect(findLines(points, 4)).toEqual([
      [point(100, 50), point(300, 52)],
      [point(300, 52), point(400, 56)],
    ]);
  });
});

describe("hsvToU8", () => {
  it("scales a hue of 0 to 360 and a saturation and value of 0 to 100 to 0 to 255", () => {
    expect(hsvToU8(180, 100, 50)).toEqual([128, 255, 128]);
    expect(hsvToU8(360, 0, 100)).toEqual([255, 0, 255]);
  });
});
