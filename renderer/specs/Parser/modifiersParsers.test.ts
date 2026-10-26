import { __testExports } from "@/parser/Parser";
import { beforeEach, describe, expect, it } from "vitest";
import { setupTests } from "@specs/vitest.setup";
import {
  ArmourHighValueRareItem,
  BowThreeAugments,
  HighDamageRareItem,
  ItemAllTheModifierTypes,
  MagicItem,
  NormalShield,
  RareItem,
  RareWithImplicit,
  TestItem,
  TwoImplicitItem,
  TwoLineOneImplicitItem,
  UniqueItem,
  WandRareItem,
} from "./items";
import { init } from "@/assets/data";
import { ItemCategory, ItemRarity, ParsedItem } from "@/parser";
import { ModifierType } from "@/parser/modifiers";

describe("[e2e] parseModifiers", () => {
  beforeEach(async () => {
    setupTests();
    await init("en");
  });

  it.each([
    // [NormalItem, NormalItem.sectionCount],
    [MagicItem, [4]],
    [RareItem, [4]],
    [UniqueItem, [4]],
    [RareWithImplicit, [3, 4]],
    [HighDamageRareItem, [5, 6, 7]],
    [ArmourHighValueRareItem, [5, 6]],
    [WandRareItem, [3, 4]],
    [TwoImplicitItem, [3, 4]],
    [TwoLineOneImplicitItem, [2, 3]],
  ])(
    "%#, Each mod section is recognized",
    (testItem: TestItem, modifierSections: number[]) => {
      const sections = __testExports.itemTextToSections(testItem.rawText);
      const parsedItem: ParsedItem = {
        rarity: testItem.rarity,
        category: testItem.category,
        itemLevel: testItem.itemLevel,
        isUnidentified: false,
        isCorrupted: false,
        newMods: [],
        statsByType: [],
        unknownModifiers: [],
        influences: [],
        info: testItem.info,
        rawText: testItem.rawText,
      };

      modifierSections.forEach((section) => {
        const res = __testExports.parseModifiers(sections[section], parsedItem);
        expect(res).toBe("SECTION_PARSED");
      });
    },
  );

  it.each([
    ["MagicItem:explicit", MagicItem, 4, MagicItem.explicitCount],
    ["RareItem:explicit", RareItem, 4, RareItem.explicitCount],
    ["UniqueItem:uniqueAffix", UniqueItem, 4, UniqueItem.uniqueAffixCount],
    [
      "RareWithImplicit:implicit",
      RareWithImplicit,
      3,
      RareWithImplicit.implicitCount,
    ],
    [
      "RareWithImplicit:explicit",
      RareWithImplicit,
      4,
      RareWithImplicit.explicitCount,
    ],
    ["HighDamageRareItem:fixed", HighDamageRareItem, 5, 1],
    [
      "HighDamageRareItem:implicit",
      HighDamageRareItem,
      6,
      HighDamageRareItem.implicitCount,
    ],
    [
      "HighDamageRareItem:explicit",
      HighDamageRareItem,
      7,
      HighDamageRareItem.explicitCount,
    ],
    ["ArmourHighValueRareItem:fixed", ArmourHighValueRareItem, 5, 1],
    [
      "ArmourHighValueRareItem:explicit",
      ArmourHighValueRareItem,
      6,
      ArmourHighValueRareItem.explicitCount,
    ],
    ["WandRareItem:implicit", WandRareItem, 3, WandRareItem.implicitCount],
    ["WandRareItem:explicit", WandRareItem, 4, WandRareItem.explicitCount],
    ["NormalShield:implicit", NormalShield, 4, NormalShield.implicitCount],
    [
      "TwoImplicitItem:implicit",
      TwoImplicitItem,
      3,
      TwoImplicitItem.implicitCount,
    ],
    [
      "TwoImplicitItem:explicit",
      TwoImplicitItem,
      4,
      TwoImplicitItem.explicitCount,
    ],
    [
      "TwoLineOneImplicitItem:implicit",
      TwoLineOneImplicitItem,
      2,
      TwoLineOneImplicitItem.implicitCount,
    ],
    [
      "TwoLineOneImplicitItem:explicit",
      TwoLineOneImplicitItem,
      3,
      TwoLineOneImplicitItem.explicitCount,
    ],
  ])(
    "%s, Each mod section adds correct count to newMods",
    (
      testName: string,
      testItem: TestItem,
      section: number,
      expectedCount: number,
    ) => {
      const sections = __testExports.itemTextToSections(testItem.rawText);
      const parsedItem: ParsedItem = {
        rarity: testItem.rarity,
        category: testItem.category,
        itemLevel: testItem.itemLevel,
        isUnidentified: false,
        isCorrupted: false,
        newMods: [],
        statsByType: [],
        unknownModifiers: [],
        influences: [],
        info: testItem.info,
        rawText: testItem.rawText,
      };

      const res = __testExports.parseModifiers(sections[section], parsedItem);
      expect(res).toBe("SECTION_PARSED");
      expect(parsedItem.newMods.length).toBe(expectedCount);
      expect(parsedItem.unknownModifiers.length).toBe(0);
    },
  );
});

describe("[unit] parseModifiers", () => {
  let parsedItem: ParsedItem;

  beforeEach(async () => {
    setupTests();
    await init("en");
    parsedItem = new TestItem("");
    parsedItem.rarity = ItemRarity.Rare;
    parsedItem.category = ItemCategory.Bow;
  });

  it.each([
    [
      "a fractured crossbow",
      ItemAllTheModifierTypes,
      9,
      [
        [ModifierType.Fractured, "prefix", "Electrocuting", 2],
        [ModifierType.Explicit, "prefix", "Razor-sharp", 3],
        [ModifierType.Explicit, "prefix", "Overpowering", 2],
        [ModifierType.Explicit, "suffix", "of the Drought", 1],
        [ModifierType.Desecrated, "suffix", "of Siphoning", 3],
        [ModifierType.Explicit, "suffix", "of Acclaim", 1],
      ],
    ],
    [
      "a bow with a crafted suffix",
      BowThreeAugments,
      7,
      [
        [ModifierType.Explicit, "prefix", "Cruel", 3],
        [ModifierType.Desecrated, "prefix", "Razor-sharp", 3],
        [ModifierType.Explicit, "prefix", "Blasting", 3],
        [ModifierType.Explicit, "suffix", "of Renown", 2],
        [ModifierType.Explicit, "suffix", "of the Vampire", 1],
        [ModifierType.Crafted, "suffix", "of Calamity", 3],
      ],
    ],
  ])(
    "Should parse the explicit modifiers of %s",
    (_name, testItem, section, expected) => {
      const sections = __testExports.itemTextToSections(testItem.rawText);
      parsedItem.category = testItem.category;

      const res = __testExports.parseModifiers(sections[section], parsedItem);
      expect(res).toBe("SECTION_PARSED");
      expect(parsedItem.unknownModifiers).toEqual([]);
      expect(
        parsedItem.newMods.map(({ info }) => [
          info.type,
          info.generation,
          info.name,
          info.tier,
        ]),
      ).toEqual(expected);
    },
  );

  it("Should parse implicit modifiers", () => {
    const section = `{ Implicit Modifier — Attack }
Loads an additional bolt
`;

    const res = __testExports.parseModifiers(section.split("\n"), parsedItem);
    expect(res).toBe("SECTION_PARSED");
    expect(parsedItem.newMods.length).toBe(1);
    expect(parsedItem.unknownModifiers.length).toBe(0);
    expect(parsedItem.newMods[0].info.type).toBe(ModifierType.Implicit);
  });

  it("Should parse granted skill modifiers", () => {
    const section = `Grants Skill: Level 18 Cackling Companions
`;

    const res = __testExports.parseModifiers(section.split("\n"), parsedItem);
    expect(res).toBe("SECTION_PARSED");
    expect(parsedItem.newMods.length).toBe(1);
    expect(parsedItem.unknownModifiers.length).toBe(0);
    expect(parsedItem.newMods[0].info.type).toBe(ModifierType.Skill);
  });

  it("Should parse augment modifiers", () => {
    const section = `18% increased Physical Damage (rune)
Gain 24 Mana per enemy killed (rune)
`;

    const res = __testExports.parseModifiers(section.split("\n"), parsedItem);
    expect(res).toBe("SECTION_PARSED");
    expect(parsedItem.newMods.length).toBe(1);
    expect(parsedItem.unknownModifiers.length).toBe(0);
    expect(parsedItem.newMods[0].info.type).toBe(ModifierType.Augment);
  });

  it("Should parse enchant modifiers", () => {
    const section = `45% increased Elemental Damage with Attacks (enchant)
`;

    const res = __testExports.parseModifiers(section.split("\n"), parsedItem);
    expect(res).toBe("SECTION_PARSED");
    expect(parsedItem.unknownModifiers).toEqual([]);
    expect(parsedItem.newMods).toHaveLength(1);
    expect(parsedItem.newMods[0].info.type).toBe(ModifierType.Enchant);
    expect(parsedItem.newMods[0].stats.map(({ stat }) => stat.ref)).toEqual([
      "#% increased Elemental Damage with Attacks",
    ]);
  });

  it("Should leave a section whose first line is not a modifier header", () => {
    const section = `A line before the header
{ Suffix Modifier "of Acclaim" (Tier: 1) — Attack, Speed }
18(17-19)% increased Attack Speed
`;

    const res = __testExports.parseModifiers(section.split("\n"), parsedItem);
    expect(res).toBe("SECTION_SKIPPED");
    expect(parsedItem.newMods).toEqual([]);
    expect(parsedItem.unknownModifiers).toEqual([]);
  });

  it("Should parse new enchant modifiers", () => {
    const section = `{ Enhancement }
Allocates Core of the Guardian — Unscalable Value
`;

    const res = __testExports.parseModifiers(section.split("\n"), parsedItem);
    expect(res).toBe("SECTION_PARSED");
    expect(parsedItem.newMods.length).toBe(1);
    expect(parsedItem.unknownModifiers.length).toBe(0);
    expect(parsedItem.newMods[0].info.type).toBe(ModifierType.Enchant);
  });
});
