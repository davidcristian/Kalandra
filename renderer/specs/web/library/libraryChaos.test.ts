import { ParsedModifier } from "@/parser/advanced-mod-desc";
import { ModifierType } from "@/parser/modifiers";
import { ItemRarity, ParsedItem } from "@/parser/ParsedItem";
import {
  __testExports,
  buildCsvString,
  ColumnOpts,
  getHeader,
} from "@/web/library/widget";
import { createTestItem } from "@specs/helper";
import { describe, expect, it } from "vitest";

describe("modFilter", () => {
  it.each([
    [{ explicit: true, implicit: false, enchant: false, augment: false }, [0]],
    [
      { explicit: true, implicit: false, enchant: true, augment: false },
      [0, 2],
    ],
    [
      { explicit: true, implicit: false, enchant: false, augment: true },
      [0, 3],
    ],
    [
      { explicit: true, implicit: false, enchant: true, augment: true },
      [0, 2, 3],
    ],
    [
      { explicit: true, implicit: true, enchant: false, augment: false },
      [0, 1],
    ],
  ])(
    "Returns correct mods",
    (filter: Record<string, boolean>, expected: number[]) => {
      const mods = [
        { info: { generation: "suffix" }, stats: [] },
        { info: { type: ModifierType.Implicit }, stats: [] },
        { info: { type: ModifierType.Enchant }, stats: [] },
        { info: { type: ModifierType.Augment }, stats: [] },
      ];
      const set = new Set(expected);
      for (let i = 0; i < expected.length; i++) {
        expect(
          __testExports.modFilter(
            mods[i] as unknown as ParsedModifier,
            filter as unknown as ColumnOpts["keep"],
          ),
        ).toBe(set.has(i));
      }
    },
  );
});

const COLLECTORS: ParsedModifier = {
  info: {
    type: ModifierType.Explicit,
    generation: "prefix",
    name: "Collector's",
    tier: 1,
    tags: [],
  },
  stats: [],
};
const ESSENCE: ParsedModifier = {
  info: {
    type: ModifierType.Explicit,
    generation: "suffix",
    name: "of the Essence",
    tier: 2,
    tags: [],
  },
  stats: [],
};
const COLLECTORS_CELL =
  "{'name':'Collector\\'s','tier':1,'roll':[],'ref':[],'type':'explicit','generation':'prefix'}";
const ESSENCE_CELL =
  "{'name':'of the Essence','tier':2,'roll':[],'ref':[],'type':'explicit','generation':'suffix'}";

const TABLET: ParsedItem = {
  ...createTestItem(),
  info: { ...createTestItem().info, refName: "Precursor Tablet" },
  itemLevel: 80,
  rarity: ItemRarity.Rare,
  newMods: [ESSENCE],
};

function profile(addedMods: boolean, removedMods: boolean): ColumnOpts {
  return {
    refName: true,
    itemLevel: true,
    rarity: true,
    sockets: true,
    mods: true,
    addedMods,
    removedMods,
    keep: { explicit: true, implicit: false, enchant: false, augment: false },
    modOpts: {
      name: true,
      tier: true,
      roll: true,
      ref: true,
      type: true,
      generation: true,
    },
  };
}

function csvFile(columnOpts: ColumnOpts) {
  return {
    header: getHeader("chaos", columnOpts)._unsafeUnwrap(),
    row: buildCsvString(TABLET, "chaos", [ESSENCE], [COLLECTORS], {
      columnOpts,
    })._unsafeUnwrap(),
  };
}

/** Returns the cells of a CSV line, where a cell in double quotes can hold commas. */
function csvCells(line: string): string[] {
  const cells = [""];
  let quoted = false;
  for (const char of line) {
    if (char === '"') quoted = !quoted;
    if (char === "," && !quoted) {
      cells.push("");
    } else {
      cells[cells.length - 1] += char;
    }
  }
  return cells;
}

describe("the CSV file of a chaos session", () => {
  it("writes every column of the default profile", () => {
    expect(csvFile(profile(true, true))).toEqual({
      header: "base,ilvl,rarity,sockets,mods,addedMods,removedMods",
      row: `Precursor Tablet,80,Rare,0,"[${ESSENCE_CELL}]","[${ESSENCE_CELL}]","[${COLLECTORS_CELL}]"`,
    });
  });

  it("leaves the columns a profile turns off out of the header and the rows", () => {
    expect(csvFile(profile(false, false))).toEqual({
      header: "base,ilvl,rarity,sockets,mods",
      row: `Precursor Tablet,80,Rare,0,"[${ESSENCE_CELL}]"`,
    });
  });

  it.each([
    [true, true],
    [true, false],
    [false, true],
    [false, false],
  ])(
    "names each cell of a row in the header, with added mods %s and removed mods %s",
    (addedMods, removedMods) => {
      const { header, row } = csvFile(profile(addedMods, removedMods));

      expect(csvCells(row)).toHaveLength(header.split(",").length);
    },
  );

  it("writes no header and no row for a session type it does not support", () => {
    const columnOpts = profile(true, true);

    expect(getHeader("essence", columnOpts).isErr()).toBe(true);
    expect(
      buildCsvString(TABLET, "essence", [], [], { columnOpts }).isErr(),
    ).toBe(true);
  });
});
