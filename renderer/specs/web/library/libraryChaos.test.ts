import { ModifierInfo, ParsedModifier } from "@/parser/advanced-mod-desc";
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

function mod(
  type: ModifierType,
  generation?: ModifierInfo["generation"],
): ParsedModifier {
  return { info: { type, generation, tags: [] }, stats: [] };
}

const MODS: Record<string, ParsedModifier> = {
  prefix: mod(ModifierType.Explicit, "prefix"),
  suffix: mod(ModifierType.Explicit, "suffix"),
  mutated: mod(ModifierType.Explicit, "mutated"),
  desecrated: mod(ModifierType.Desecrated),
  fractured: mod(ModifierType.Fractured),
  crafted: mod(ModifierType.Crafted),
  implicit: mod(ModifierType.Implicit),
  enchant: mod(ModifierType.Enchant),
  augment: mod(ModifierType.Augment),
};
const EXPLICIT_KINDS = [
  "prefix",
  "suffix",
  "mutated",
  "desecrated",
  "fractured",
  "crafted",
];

function keep(kinds: Partial<ColumnOpts["keep"]>): ColumnOpts["keep"] {
  return {
    explicit: false,
    implicit: false,
    enchant: false,
    augment: false,
    ...kinds,
  };
}

describe("modFilter", () => {
  it.each([
    ["nothing", keep({}), []],
    ["explicit", keep({ explicit: true }), EXPLICIT_KINDS],
    ["implicit", keep({ implicit: true }), ["implicit"]],
    ["enchant", keep({ enchant: true }), ["enchant"]],
    ["augment", keep({ augment: true }), ["augment"]],
    [
      "explicit and enchant",
      keep({ explicit: true, enchant: true }),
      [...EXPLICIT_KINDS, "enchant"],
    ],
    [
      "every kind",
      keep({ explicit: true, implicit: true, enchant: true, augment: true }),
      Object.keys(MODS),
    ],
  ])(
    "keeps only the mods of the kinds a profile keeps: %s",
    (_name, kinds, expected) => {
      const kept = Object.entries(MODS)
        .filter(([, modifier]) => __testExports.modFilter(modifier, kinds))
        .map(([name]) => name);

      expect(kept).toEqual(expected);
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
