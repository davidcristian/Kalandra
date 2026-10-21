import fnv1a from "@sindresorhus/fnv1a";
import { init, stat, STAT_BY_REF, type Stat } from "@/assets/data";
import { statByRef } from "@/assets/data/stat-by-ref";
import { setupTests } from "@specs/vitest.setup";
import { beforeEach, describe, expect, it, vi } from "vitest";

const SAME_HASH_AS_PARRY_DAMAGE = "Gufereza";
const PARRY_DAMAGE = "#% increased Parry Damage";

function fakeStat(ref: string): Stat {
  return { ref, better: 1, matchers: [{ string: ref }], trade: { ids: {} } };
}

const STATS = [
  fakeStat("Other"),
  fakeStat("Iron Reflexes"),
  fakeStat("#% to Strength"),
];
const NDJSON = STATS.map((s) => `${JSON.stringify(s)}\n`).join("");
const LINE_STARTS = STATS.map((s) => NDJSON.indexOf(JSON.stringify(s)));

function hash(text: string) {
  return Number(fnv1a(text, { size: 32 }));
}

// One row of [hash, line start] per stat ref, sorted by hash, as make-index-files writes them
function indexOf(extraRows: Array<[string, number]> = []) {
  const rows: Array<[number, number]> = STATS.map((s, i) => [
    hash(s.ref),
    LINE_STARTS[i],
  ]);
  for (const [ref, line] of extraRows) rows.push([hash(ref), line]);
  rows.sort((a, b) => a[0] - b[0]);
  return new Uint32Array(rows.flat());
}

describe("statByRef", () => {
  it("returns the stat with the ref", () => {
    expect(statByRef(NDJSON, indexOf(), "Iron Reflexes")).toEqual(STATS[1]);
    expect(statByRef(NDJSON, indexOf(), "#% to Strength")).toEqual(STATS[2]);
  });

  it("skips a row whose line has another ref with the same hash", () => {
    const index = indexOf([["Iron Reflexes", LINE_STARTS[0]]]);

    expect(statByRef(NDJSON, index, "Iron Reflexes")).toEqual(STATS[1]);
  });

  it("returns nothing for a ref whose hash only another stat's ref has", () => {
    const index = indexOf([["Unwavering Stance", LINE_STARTS[2]]]);

    expect(statByRef(NDJSON, index, "Unwavering Stance")).toBeUndefined();
  });

  it("returns nothing for a ref that no row has", () => {
    expect(statByRef(NDJSON, indexOf(), "Unwavering Stance")).toBeUndefined();
    expect(statByRef(NDJSON, new Uint32Array(), "Other")).toBeUndefined();
  });
});

describe("STAT_BY_REF", () => {
  beforeEach(async () => {
    setupTests();
    await init("en");
  });

  it("finds no stat for a ref whose hash only another stat's ref has", () => {
    expect(hash(SAME_HASH_AS_PARRY_DAMAGE)).toBe(hash(PARRY_DAMAGE));

    expect(STAT_BY_REF(SAME_HASH_AS_PARRY_DAMAGE)).toBeUndefined();
    expect(STAT_BY_REF(PARRY_DAMAGE)?.ref).toBe(PARRY_DAMAGE);
  });

  it("logs a recorded ref whose hash only another stat's ref has as missing", async () => {
    const logged: string[] = [];
    vi.spyOn(console, "log").mockImplementation((text: string) => {
      logged.push(text);
    });

    stat(SAME_HASH_AS_PARRY_DAMAGE);
    await init("en");

    expect(logged.join(" ")).toContain(SAME_HASH_AS_PARRY_DAMAGE);
  });

  it("logs the missing refs after a colon, one per line", async () => {
    const logged: string[] = [];
    vi.spyOn(console, "log").mockImplementation((text: string) => {
      logged.push(text);
    });

    stat("No stat has this ref");
    await init("en");
    stat("No stat has this ref");
    stat("Nor this one");
    await init("en");

    expect(logged).toEqual([
      "Cannot find stat: No stat has this ref",
      "Cannot find stats: No stat has this ref\nNor this one",
    ]);
  });
});
