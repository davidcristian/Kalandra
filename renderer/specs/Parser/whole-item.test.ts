import { beforeEach, describe, expect, it } from "vitest";
import { init } from "@/assets/data";
import { parseClipboard, type ParsedItem } from "@/parser";
import { ModifierType } from "@/parser/modifiers";
import { setupTests } from "@specs/vitest.setup";
import {
  BowThreeAugments,
  FracturedItem,
  ItemAllTheModifierTypes,
  NewExplicitTypeDefinitions,
  NormalShield,
  UnidentifiedBase,
  UnidentifiedTier,
  type TestItem,
} from "./items";

function fields(item: ParsedItem) {
  return {
    category: item.category,
    rarity: item.rarity,
    refName: item.info.refName,
    itemLevel: item.itemLevel,
    quality: item.quality,
    requires: item.requires,
    weaponPHYSICAL: item.weaponPHYSICAL,
    weaponELEMENTAL: item.weaponELEMENTAL,
    weaponFIRE: item.weaponFIRE,
    weaponLIGHTNING: item.weaponLIGHTNING,
    weaponCRIT: item.weaponCRIT,
    weaponAS: item.weaponAS,
    weaponRELOAD: item.weaponRELOAD,
    armourAR: item.armourAR,
    armourEV: item.armourEV,
    armourBLOCK: item.armourBLOCK,
    isFractured: item.isFractured,
    isCorrupted: item.isCorrupted,
    isUnidentified: item.isUnidentified,
    unidentifiedTier: item.unidentifiedTier,
    note: item.note,
  };
}

function parse(item: TestItem): ParsedItem {
  return parseClipboard(item.rawText)._unsafeUnwrap();
}

// Counts prefixes and suffixes of every modifier type, as TestItem does
function modifierCounts(item: ParsedItem) {
  const count = (pick: (type: ModifierType, generation?: string) => boolean) =>
    item.newMods.filter((mod) => pick(mod.info.type, mod.info.generation))
      .length;
  return {
    enchant: count((type) => type === ModifierType.Enchant),
    implicit: count((type) => type === ModifierType.Implicit),
    skill: count((type) => type === ModifierType.Skill),
    prefix: count((_type, generation) => generation === "prefix"),
    suffix: count((_type, generation) => generation === "suffix"),
  };
}

const expectedCounts = (item: TestItem) => ({
  enchant: item.enchantCount,
  implicit: item.implicitCount,
  skill: item.skillCount,
  prefix: item.prefixCount,
  suffix: item.suffixCount,
});

const runes = (item: ParsedItem) =>
  item.augmentSockets && {
    empty: item.augmentSockets.empty,
    current: item.augmentSockets.current,
    normal: item.augmentSockets.normal,
    refNames: item.augmentSockets.augments.map((rune) => rune?.refName),
  };

describe("parseClipboard on whole items", () => {
  beforeEach(async () => {
    setupTests();
    await init("en");
  });

  it.each([
    ["a bow with a fractured modifier", FracturedItem],
    ["a fractured, corrupted crossbow", ItemAllTheModifierTypes],
    [
      "a fractured amulet with a desecrated modifier",
      NewExplicitTypeDefinitions,
    ],
    ["a corrupted bow with three runes", BowThreeAugments],
    ["an unidentified wand", UnidentifiedBase],
    ["an unidentified ring with a tier", UnidentifiedTier],
    ["a normal shield with a note", NormalShield],
  ])("reads the properties of %s", (_item, item) => {
    expect(fields(parse(item))).toEqual(fields(item));
  });

  it.each([
    ["a bow with a fractured modifier", FracturedItem],
    ["a fractured, corrupted crossbow", ItemAllTheModifierTypes],
    [
      "a fractured amulet with a desecrated modifier",
      NewExplicitTypeDefinitions,
    ],
    ["a corrupted bow with three runes", BowThreeAugments],
    ["an unidentified wand", UnidentifiedBase],
    ["an unidentified ring with a tier", UnidentifiedTier],
  ])("counts the modifiers of %s", (_item, item) => {
    expect(modifierCounts(parse(item))).toEqual(expectedCounts(item));
  });

  it.each([
    ["a bow with a fractured modifier", FracturedItem],
    ["a fractured, corrupted crossbow", ItemAllTheModifierTypes],
    ["a corrupted bow with three runes", BowThreeAugments],
  ])("reads the runes in the sockets of %s", (_item, item) => {
    expect(runes(parse(item))).toEqual(runes(item));
  });

  it("reads each modifier type of a crossbow that has all of them", () => {
    const types = new Set(
      parse(ItemAllTheModifierTypes).newMods.map((mod) => mod.info.type),
    );

    expect([...types].sort()).toEqual(
      [
        ModifierType.Enchant,
        ModifierType.Augment,
        ModifierType.Implicit,
        ModifierType.Skill,
        ModifierType.Fractured,
        ModifierType.Explicit,
        ModifierType.Desecrated,
      ].sort(),
    );
  });
});
