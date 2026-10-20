import fnv1a from "@sindresorhus/fnv1a";
import type { Stat } from "@/assets/data";
import { statsByMatcherText } from "@/assets/data/stats-by-matcher";
import { describe, expect, it } from "vitest";

function stat(ref: string, matchers: Stat["matchers"]): Stat {
  return { ref, better: 1, matchers, trade: { ids: {} } };
}

const STATS = [
  stat("Other", [{ string: "Other" }]),
  stat("#(Keystone)", [
    { string: "Iron Reflexes", advanced: "Iron Reflexes(A-Z)", value: 21 },
  ]),
  stat("Iron Reflexes", [{ string: "Iron Reflexes" }]),
  stat("Allocates #", [
    { string: "Allocates X", value: 1 },
    { string: "Allocates X", value: 2 },
  ]),
];
const NDJSON = STATS.map((s) => `${JSON.stringify(s)}\n`).join("");

function hash(text: string) {
  return Number(fnv1a(text, { size: 32 }));
}

// One row of [hash, line start] per matcher text, sorted by hash, as make-index-files writes them
function indexOf(extraRows: Array<[string, number]> = []) {
  const rows: Array<[number, number]> = [];
  let start = 0;
  for (const s of STATS) {
    for (const matcher of s.matchers) {
      rows.push([hash(matcher.string), start]);
      if (matcher.advanced) rows.push([hash(matcher.advanced), start]);
    }
    start += JSON.stringify(s).length + 1;
  }
  for (const [text, line] of extraRows) rows.push([hash(text), line]);
  rows.sort((a, b) => a[0] - b[0]);
  return new Uint32Array(rows.flat());
}

function refsFor(text: string, index = indexOf()) {
  return statsByMatcherText(NDJSON, index, text).map(({ stat }) => stat.ref);
}

describe("statsByMatcherText", () => {
  it("returns every stat with the text, in file order", () => {
    const matches = statsByMatcherText(NDJSON, indexOf(), "Iron Reflexes");

    expect(matches.map(({ stat }) => stat.ref)).toEqual([
      "#(Keystone)",
      "Iron Reflexes",
    ]);
    expect(matches[0].matcher.value).toBe(21);
  });

  it("returns the stat whose advanced text it is", () => {
    expect(refsFor("Iron Reflexes(A-Z)")).toEqual(["#(Keystone)"]);
  });

  it("returns a stat once when two of its matchers have the text", () => {
    const matches = statsByMatcherText(NDJSON, indexOf(), "Allocates X");

    expect(matches).toHaveLength(1);
    expect(matches[0].matcher.value).toBe(1);
  });

  it("skips a row whose line has another text with the same hash", () => {
    const index = indexOf([["Iron Reflexes", 0]]);

    expect(refsFor("Iron Reflexes", index)).toEqual([
      "#(Keystone)",
      "Iron Reflexes",
    ]);
  });

  it("returns nothing for a text that no row has", () => {
    expect(refsFor("Unwavering Stance")).toEqual([]);
    expect(refsFor("Iron Reflexes", new Uint32Array())).toEqual([]);
  });
});
