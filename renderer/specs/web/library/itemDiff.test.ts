import { beforeEach, describe, expect, it } from "vitest";
import { setupTests } from "@specs/vitest.setup";
import { RareMap, TwoLineOneImplicitItem } from "@specs/Parser/items";
import { init } from "@/assets/data";
import { parseClipboard } from "@/parser";
import type { ParsedModifier } from "@/parser/advanced-mod-desc";
import { buildCsvString, ColumnOpts, diffItem } from "@/web/library/widget";

const SPLITTING = `{ Suffix Modifier "of Splitting" (Tier: 2) }
Monsters fire 2 additional Projectiles`;
// The suffix of RareMapFakeAllProps, as a Chaos Orb would put it in place of another
const SHATTERING = `{ Suffix Modifier "of Shattering" (Tier: 1) }
Monsters Break Armour equal to 36(30-45)% of Physical Damage dealt`;

const RAW_REROLLED = RareMap.rawText.replace(SPLITTING, SHATTERING);
const RAW_NEW_ROLL = RareMap.rawText.replace(
  "28(26-30)% increased Monster Damage",
  "30(26-30)% increased Monster Damage",
);

function parsed(rawText: string) {
  return parseClipboard(rawText)._unsafeUnwrap();
}

function names(mods: ParsedModifier[]) {
  return mods.map((mod) => mod.info.name);
}

function diffNames(curr: string, prev: string | null) {
  const { added, removed } = diffItem(
    parsed(curr),
    prev == null ? null : parsed(prev),
  );
  return { added: names(added), removed: names(removed) };
}

beforeEach(async () => {
  setupTests();
  await init("en");
});

describe("the modifiers an item gained and lost since the last logged item", () => {
  it("are every prefix and suffix of the first item of a session", () => {
    expect(diffNames(RareMap.rawText, null)).toEqual({
      added: ["Shocking", "Painful", "of Splitting", "of Destruction"],
      removed: [],
    });
  });

  it("leave out an implicit modifier, also when it changes", () => {
    const fewerUses = TwoLineOneImplicitItem.rawText.replace(
      "17 uses remaining",
      "16 uses remaining",
    );

    expect(diffNames(TwoLineOneImplicitItem.rawText, null).added).toEqual([
      "Breeding",
      "Teeming",
      "of the Simulacrum",
      "of Phobia",
    ]);
    expect(diffNames(fewerUses, TwoLineOneImplicitItem.rawText)).toEqual({
      added: [],
      removed: [],
    });
  });

  it("are the new suffix and the one it replaced", () => {
    expect(diffNames(RAW_REROLLED, RareMap.rawText)).toEqual({
      added: ["of Shattering"],
      removed: ["of Splitting"],
    });
  });

  it("are the same modifier twice when only its roll changed", () => {
    const { added, removed } = diffItem(
      parsed(RAW_NEW_ROLL),
      parsed(RareMap.rawText),
    );

    expect(names(added)).toEqual(["Painful"]);
    expect(added[0].stats[0].roll?.value).toBe(30);
    expect(names(removed)).toEqual(["Painful"]);
    expect(removed[0].stats[0].roll?.value).toBe(28);
  });

  it("are none between two copies of the same item", () => {
    expect(diffNames(RareMap.rawText, RareMap.rawText)).toEqual({
      added: [],
      removed: [],
    });
  });
});

const PROFILE: ColumnOpts = {
  refName: true,
  itemLevel: true,
  rarity: true,
  sockets: true,
  mods: true,
  addedMods: true,
  removedMods: true,
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

describe("the CSV row of a rerolled Waystone", () => {
  const SHOCKING_CELL =
    "{'name':'Shocking','tier':1,'roll':[-999],'ref':['Area has patches of Shocked Ground'],'type':'explicit','generation':'prefix'}";
  const PAINFUL_CELL =
    "{'name':'Painful','tier':1,'roll':[28],'ref':['#% increased Monster Damage'],'type':'explicit','generation':'prefix'}";
  const SHATTERING_CELL =
    "{'name':'of Shattering','tier':1,'roll':[36],'ref':['Monsters Break Armour equal to #% of Physical Damage dealt'],'type':'explicit','generation':'suffix'}";
  const DESTRUCTION_CELL =
    "{'name':'of Destruction','tier':1,'roll':[293,26],'ref':['Monsters have #% increased Critical Hit Chance','#% to Monster Critical Damage Bonus'],'type':'explicit','generation':'suffix'}";
  const SPLITTING_CELL =
    "{'name':'of Splitting','tier':2,'roll':[2],'ref':['Monsters fire # additional Projectiles'],'type':'explicit','generation':'suffix'}";

  it("writes each modifier with one roll per stat, and -999 for a stat without a value", () => {
    const item = parsed(RAW_REROLLED);
    const { added, removed } = diffItem(item, parsed(RareMap.rawText));

    const row = buildCsvString(item, "chaos", added, removed, {
      columnOpts: PROFILE,
    });

    expect(row._unsafeUnwrap()).toBe(
      [
        "Waystone (Tier 14)",
        "80",
        "Rare",
        "0",
        `"[${SHOCKING_CELL},${PAINFUL_CELL},${SHATTERING_CELL},${DESTRUCTION_CELL}]"`,
        `"[${SHATTERING_CELL}]"`,
        `"[${SPLITTING_CELL}]"`,
      ].join(","),
    );
  });
});
