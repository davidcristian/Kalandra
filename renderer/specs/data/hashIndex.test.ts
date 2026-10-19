import { lineStartsByHash } from "@/assets/data/hash-index";
import { describe, expect, it } from "vitest";

// Rows of [hash, line start], sorted by hash as make-index-files writes them
const index = new Uint32Array([3, 70, 3, 10, 5, 40, 8, 90, 8, 20, 8, 60]);

describe("lineStartsByHash", () => {
  it("returns every line start of a hash, in file order", () => {
    expect(lineStartsByHash(index, 8, 2)).toEqual([20, 60, 90]);
    expect(lineStartsByHash(index, 3, 2)).toEqual([10, 70]);
  });

  it("returns the one line start of a hash that only one row has", () => {
    expect(lineStartsByHash(index, 5, 2)).toEqual([40]);
  });

  it("returns no line start for a hash that no row has", () => {
    expect(lineStartsByHash(index, 1, 2)).toEqual([]);
    expect(lineStartsByHash(index, 4, 2)).toEqual([]);
    expect(lineStartsByHash(index, 9, 2)).toEqual([]);
    expect(lineStartsByHash(new Uint32Array(), 3, 2)).toEqual([]);
  });
});
