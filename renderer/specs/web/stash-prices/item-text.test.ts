import fs from "fs";
import path from "path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { present } from "@specs/present";
import { setupTests } from "@specs/vitest.setup";
import { init } from "@/assets/data";
import type { ParsedItem } from "@/parser";
import {
  listingItem,
  listingItemText,
  UNREADABLE,
} from "@/web/stash-prices/item-text";
import { SAVED, type SavedResult } from "./fake-trade-site";

type Item = Record<string, unknown>;

// The two listings of specs/docs/fetchResponses2.json, whose modifiers are objects with their own tiers
const NEWER: SavedResult[] = JSON.parse(
  fs.readFileSync(
    path.resolve(__dirname, "../../docs/fetchResponses2.json"),
    "utf8",
  ),
);

function savedItem(idStart: string): Item {
  const saved = [...SAVED, ...NEWER].find((result) =>
    result.id.startsWith(idStart),
  );
  return structuredClone(present(saved).item);
}

function parsed(item: Item): ParsedItem {
  const result = listingItem({ item });
  if (result.isErr()) throw new Error(`Not read: ${result.error}`);
  return result.value;
}

function textOf(item: Item): string {
  return listingItemText(item)._unsafeUnwrap();
}

function mods(item: ParsedItem) {
  return item.newMods.map((mod) => ({
    type: mod.info.type,
    generation: mod.info.generation,
    name: mod.info.name,
    tier: mod.info.tier,
  }));
}

function roll(item: ParsedItem, ref: string) {
  const calc = present(
    item.statsByType.find(
      (calc) => calc.stat.ref === ref && calc.type === "explicit",
    ),
  );
  const { value, min, max } = present(calc.sources[0].stat.roll);
  return { value, min, max };
}

describe("the item text of a stash listing", () => {
  beforeEach(async () => {
    setupTests();
    await init("en");
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
  });

  it("writes a magic helmet as the game copies it, with each modifier's tier and roll range", () => {
    const item = savedItem("65c7c4e8e6");

    expect(textOf(item)).toBe(`Item Class: Helmet
Rarity: Magic
Collector's Corsair Cap of Curvation
--------
Evasion Rating: 158
--------
Requires: Level 45, 64 Dex
--------
Item Level: 50
--------
{ Prefix Modifier "Collector's" (Tier: 2) }
14(12-15)% increased Rarity of Items found
{ Suffix Modifier "of Curvation" (Tier: 3) }
Gain Deflection Rating equal to 17(15-17)% of Evasion Rating`);
    const helmet = parsed(item);
    expect(helmet).toMatchObject({
      rarity: "Magic",
      category: "Helmet",
      itemLevel: 50,
      armourEV: 158,
      requires: { level: 45, str: 0, dex: 64, int: 0 },
      unknownModifiers: [],
    });
    expect(helmet.info.refName).toBe("Corsair Cap");
    expect(roll(helmet, "#% increased Rarity of Items found")).toEqual({
      value: 14,
      min: 12,
      max: 15,
    });
  });

  it("writes the fractured, desecrated, crafted, enchanted and rune modifiers of the newer format", () => {
    const item = savedItem("fba00b0c27");

    expect(textOf(item)).toBe(`Item Class: Crossbow
Rarity: Rare
Vengeance Core
Trarthan Cannon
--------
Quality: +20%
Physical Damage: 95-219
Elemental Damage: 111-169, 56-88
Critical Hit Chance: 5.00%
Attacks per Second: 1.40
--------
Requires: Level 65, 74 Str, 40 Dex
--------
Sockets: S S
--------
Item Level: 82
--------
+6% to Critical Damage Bonus (enchant)
--------
36% increased Physical Damage (rune)
Bonded: 40% increased effect of Fully Broken Armour (rune)
--------
{ Implicit Modifier }
Cannot load or fire Ammunition
--------
{ Fractured Prefix Modifier "Cremating" (Tier: 2) }
Adds 111(102-130) to 169(155-198) Fire Damage
{ Prefix Modifier "Glaciated" (Tier: 4) }
Adds 56(46-57) to 88(70-88) Cold Damage
{ Desecrated Prefix Modifier "Amanamu's" (Tier: 1) }
Grenade Skills have +1 Cooldown Use
{ Suffix Modifier "of Radiance" (Tier: 1) }
+47(41-60) to Accuracy Rating
15% increased Light Radius
{ Suffix Modifier "of the Proficient" (Tier: 1) }
35% reduced Attribute Requirements
{ Crafted Suffix Modifier "of the Essence" }
+3 to Level of all Attack Skills
--------
Corrupted`);
    const crossbow = parsed(item);
    expect(crossbow).toMatchObject({
      quality: 20,
      weaponPHYSICAL: 157,
      weaponELEMENTAL: 212,
      weaponAS: 1.4,
      isCorrupted: true,
      isFractured: true,
      augmentSockets: { current: 2 },
    });
    expect(mods(crossbow).map((mod) => [mod.type, mod.generation])).toEqual([
      ["enchant", undefined],
      ["rune", undefined],
      ["implicit", undefined],
      ["fractured", "prefix"],
      ["explicit", "prefix"],
      ["desecrated", "prefix"],
      ["explicit", "suffix"],
      ["explicit", "suffix"],
      ["crafted", "suffix"],
    ]);
  });

  it("reads a rare weapon's properties, implicit and tiers from the older format", () => {
    const maul = parsed(savedItem("00d17082eb"));

    expect(maul).toMatchObject({
      weaponPHYSICAL: 68.5,
      weaponELEMENTAL: 37.5,
      weaponCRIT: 8,
      weaponAS: 1.1,
      requires: { level: 38, str: 68 },
    });
    expect(mods(maul)).toEqual([
      {
        type: "implicit",
        generation: undefined,
        name: undefined,
        tier: undefined,
      },
      { type: "explicit", generation: "prefix", name: "Freezing", tier: 6 },
      { type: "explicit", generation: "suffix", name: "of Dazing", tier: 5 },
      {
        type: "explicit",
        generation: "suffix",
        name: "of the Parched",
        tier: 4,
      },
      { type: "explicit", generation: "suffix", name: "of the Bear", tier: 6 },
    ]);
    expect(roll(maul, "Leeches #% of Physical Damage as Mana")).toEqual({
      value: 5.01,
      min: 5,
      max: 5.9,
    });
  });

  it("writes a line two modifiers make once, with the sum of their ranges, and keeps both modifiers", () => {
    const staff = parsed(savedItem("2fa2f1ee71"));

    expect(mods(staff).filter((mod) => mod.type === "explicit")).toEqual([
      { type: "explicit", generation: "prefix", name: "Honed", tier: 6 },
      { type: "explicit", generation: "prefix", name: "Tyrannical", tier: 2 },
      { type: "explicit", generation: "prefix", name: "Mercenary's", tier: 5 },
      {
        type: "explicit",
        generation: "suffix",
        name: "of Vanquishing",
        tier: 4,
      },
      { type: "explicit", generation: "suffix", name: "of the Boxer", tier: 4 },
      { type: "explicit", generation: "suffix", name: "of Stunning", tier: 4 },
    ]);
    expect(roll(staff, "#% increased Physical Damage")).toEqual({
      value: 199,
      min: 190,
      max: 213,
    });
  });

  it("writes an unrevealed modifier in its slot, and the range of a reduced roll", () => {
    const coat = parsed(savedItem("95bcbe83f9"));

    expect(coat.isVeiled).toBe(true);
    expect(
      mods(coat).filter((mod) => mod.generation === "prefix"),
    ).toHaveLength(2);
    expect(roll(coat, "#% increased Duration of Bleeding on You")).toEqual({
      value: -54,
      min: -55,
      max: -51,
    });
  });

  it("writes an unrevealed suffix in a suffix slot", () => {
    const item = { ...savedItem("95bcbe83f9"), veiledMods: ["Suffix02"] };

    expect(textOf(item)).toContain("{ Suffix Modifier }\nDesecrated Suffix");
    expect(
      mods(parsed(item)).filter((mod) => mod.generation === "suffix"),
    ).toHaveLength(4);
  });

  it("leaves the tier out of a header whose language writes the tier with another word", async () => {
    await init("ru");

    expect(textOf(savedItem("65c7c4e8e6"))).toContain(
      `{ Префикс "Collector's" }`,
    );
  });

  it("reads a unique by its name, with the ranges of its modifiers", () => {
    const amulet = parsed(savedItem("4ac2e3ccfc"));

    expect(amulet.rarity).toBe("Unique");
    expect(amulet.info.refName).toBe("Revered Resin");
    expect(amulet.info.unique?.base).toBe("Amber Amulet");
    expect(roll(amulet, "# to maximum Life")).toEqual({
      value: 53,
      min: 40,
      max: 60,
    });
  });

  it("reads the tiers of a relic, whose modifiers the site lists as sanctum modifiers", () => {
    const relic = parsed(savedItem("42a9dd4276"));

    expect(mods(relic)).toEqual([
      { type: "sanctum", generation: "prefix", name: "Fortified", tier: 2 },
      { type: "sanctum", generation: "suffix", name: "of Dignity", tier: 4 },
    ]);
  });

  it("reads a waystone's properties under the names the game writes", () => {
    const waystone = parsed(savedItem("0c8eb03c18"));

    expect(waystone).toMatchObject({
      category: "Map",
      mapTier: 16,
      mapRevives: 0,
      mapPackSize: 19,
      mapRareMonsters: 22,
      mapItemRarity: 53,
      mapDropChance: 95,
      isCorrupted: true,
    });
  });

  it("reads a currency stack, which has no rarity, with its stack size", () => {
    // The rune socketed in a saved listing is the fetch result of a currency item
    const rune = savedItem("2fa2f1ee71").socketedItems as Item[];
    const text = textOf(rune[0]);

    expect(text).not.toContain("{");
    expect(parsed(rune[0])).toMatchObject({
      category: "Currency",
      stackSize: { value: 1, max: 10 },
      info: { refName: "Greater Iron Rune" },
    });
  });

  it("reads the trials of a barya and an ultimatum", () => {
    expect(parsed(savedItem("11de0eee2f")).trials).toEqual({
      numberOfTrials: 4,
    });
    expect(parsed(savedItem("91c9f13dae")).trials).toEqual({
      numberOfTrials: 10,
      ultimatumHint: "Cowardly",
    });
  });

  it("reads every other saved listing as the base type and item level it lists", () => {
    const logbook = "ae5ce7896b";
    for (const saved of [...SAVED, ...NEWER]) {
      if (saved.id.startsWith(logbook)) continue;
      const item = parsed(saved.item);
      const { name, baseType, rarity, ilvl } = saved.item;
      expect([saved.id, item.info.refName, item.itemLevel]).toEqual([
        saved.id,
        rarity === "Unique" ? name : baseType,
        ilvl,
      ]);
    }
  });

  it("reads an unidentified item with its tier", () => {
    const item = savedItem("00d17082eb");
    Object.assign(item, { name: "", identified: false, unidentifiedTier: 3 });
    delete item.implicitMods;
    delete item.explicitMods;

    expect(parsed(item)).toMatchObject({
      isUnidentified: true,
      unidentifiedTier: 3,
      info: { refName: "Crumbling Maul" },
    });
  });

  it("marks what it cannot write as unreadable, and never throws", () => {
    const logbook = present(
      SAVED.find((saved) => saved.item.baseType === "Expedition Logbook"),
    ).item;
    const noRarity = { ...savedItem("65c7c4e8e6"), rarity: undefined };
    const throwing = {
      get typeLine(): string {
        throw new Error("The getter fails");
      },
    };

    for (const item of [logbook, noRarity, null, { typeLine: "" }, throwing]) {
      expect(listingItem({ item })._unsafeUnwrapErr()).toBe(UNREADABLE);
    }
  });

  it("passes on the parser's reason for an item the game data does not have", () => {
    const item = { ...savedItem("65c7c4e8e6"), typeLine: "Corsair Hat" };

    expect(listingItem({ item })._unsafeUnwrapErr()).toBe("item.unknown");
  });
});
