/**
 * Integration tests for the parser
 */

import { parseClipboard } from "@/parser";
import { present } from "@specs/present";
import { ModifierType } from "@/parser/modifiers";
import {
  CharmQuality,
  MagicNameWithHashOfAnotherItem,
  ModifierIncreaseUnknownFormat,
  ModifierLineUnknownFormat,
  NormalItem,
  RareItem,
  RequiresUnknownFormat,
  RuneLineWithoutRuneStat,
  SpectreIncSpirit,
} from "./items";
import { beforeEach, describe, expect, it } from "vitest";
import { setupTests } from "@specs/vitest.setup";
import { init } from "@/assets/data";

describe("Parse Item Properties", () => {
  // Tests almost everything on items, except for modifiers themselves
  beforeEach(async () => {
    setupTests();
    await init("en");
  });

  it("parses bow dps", () => {
    const item = parseClipboard(RareItem.rawText);

    expect(item.isOk()).toBe(true);

    const parsedItem = item._unsafeUnwrap();

    expect(parsedItem.weaponPHYSICAL).toBe(RareItem.weaponPHYSICAL);
    expect(parsedItem.weaponELEMENTAL).toBe(RareItem.weaponELEMENTAL);
    expect(parsedItem.weaponAS).toBe(RareItem.weaponAS);
    expect(parsedItem.weaponCRIT).toBe(RareItem.weaponCRIT);

    expect(parsedItem.requires).not.toBeUndefined();
    expect(parsedItem.requires?.level).toBe(RareItem.requires?.level);
    expect(parsedItem.requires?.str).toBe(RareItem.requires?.str);
    expect(parsedItem.requires?.dex).toBe(RareItem.requires?.dex);
    expect(parsedItem.requires?.int).toBe(RareItem.requires?.int);
  });

  it("parses a spectre's spirit", () => {
    const item = parseClipboard(SpectreIncSpirit.rawText);

    expect(item.isOk()).toBe(true);

    const parsedItem = item._unsafeUnwrap();

    expect(parsedItem.weaponSPIRIT).toBe(SpectreIncSpirit.weaponSPIRIT);

    expect(parsedItem.requires).not.toBeUndefined();
    expect(parsedItem.requires?.level).toBe(SpectreIncSpirit.requires?.level);
    expect(parsedItem.requires?.str).toBe(SpectreIncSpirit.requires?.str);
    expect(parsedItem.requires?.dex).toBe(SpectreIncSpirit.requires?.dex);
    expect(parsedItem.requires?.int).toBe(SpectreIncSpirit.requires?.int);
  });

  it("parses armour props", () => {
    const item = parseClipboard(NormalItem.rawText);
    const parsedItem = item._unsafeUnwrap();

    expect(parsedItem.armourAR).toBe(NormalItem.armourAR);
    expect(parsedItem.armourEV).toBe(NormalItem.armourEV);
    expect(parsedItem.armourES).toBe(NormalItem.armourES);

    expect(parsedItem.requires).not.toBeUndefined();
    expect(parsedItem.requires?.level).toBe(NormalItem.requires?.level);
    expect(parsedItem.requires?.str).toBe(NormalItem.requires?.str);
    expect(parsedItem.requires?.dex).toBe(NormalItem.requires?.dex);
    expect(parsedItem.requires?.int).toBe(NormalItem.requires?.int);
  });
});

describe("Parse Charm Properties", () => {
  beforeEach(async () => {
    setupTests();
    await init("en");
  });

  it("parses charm quality", () => {
    const item = parseClipboard(CharmQuality.rawText);

    expect(item.isOk()).toBe(true);

    const parsedItem = item._unsafeUnwrap();

    expect(parsedItem.quality).toBe(CharmQuality.quality);
  });
});

describe("Parse lines the game data does not match", () => {
  beforeEach(async () => {
    setupTests();
    await init("en");
  });

  it("keeps the item when the requirements line cannot be read", () => {
    const item = parseClipboard(RequiresUnknownFormat.rawText);

    expect(item.isOk()).toBe(true);
    const parsedItem = item._unsafeUnwrap();
    expect(parsedItem.requires).toBeUndefined();
    expect(parsedItem.itemLevel).toBe(RequiresUnknownFormat.itemLevel);
    expect(parsedItem.weaponPHYSICAL).toBe(
      RequiresUnknownFormat.weaponPHYSICAL,
    );
    expect(parsedItem.newMods).toHaveLength(2);
  });

  it("keeps the type, tags and stats of a modifier line it cannot read", () => {
    const item = parseClipboard(ModifierLineUnknownFormat.rawText);

    expect(item.isOk()).toBe(true);
    const [prefix, suffix] = item._unsafeUnwrap().newMods;
    expect(prefix.info).toMatchObject({
      type: ModifierType.Explicit,
      generation: undefined,
      name: undefined,
      tier: undefined,
      tags: ["Damage", "Elemental", "Lightning", "Attack"],
    });
    expect(prefix.stats.map((stat) => stat.stat.ref)).toEqual([
      "Adds # to # Lightning Damage",
    ]);
    expect(suffix.info.generation).toBe("suffix");
  });

  it("keeps a modifier whose roll increase it cannot read", () => {
    const item = parseClipboard(ModifierIncreaseUnknownFormat.rawText);

    expect(item.isOk()).toBe(true);
    const suffix = item._unsafeUnwrap().newMods[1];
    expect(suffix.info).toMatchObject({
      generation: "suffix",
      name: "of the Brute",
      tier: 8,
      tags: ["Attribute"],
      rollIncr: undefined,
    });
    expect(suffix.stats[0].roll?.value).toBe(8);
  });

  it("keeps a rune line the trade site lists for no rune as unknown", () => {
    const item = parseClipboard(RuneLineWithoutRuneStat.rawText);

    expect(item.isOk()).toBe(true);
    const parsedItem = item._unsafeUnwrap();
    expect(parsedItem.unknownModifiers).toEqual([
      { text: "15% increased Light Radius", type: ModifierType.Augment },
    ]);
    const sockets = present(parsedItem.augmentSockets);
    const expected = present(RuneLineWithoutRuneStat.augmentSockets);
    expect(sockets.empty).toBe(expected.empty);
    expect(sockets.augments.map((augment) => augment?.refName)).toEqual(
      expected.augments.map((augment) => augment?.refName),
    );
  });

  it("finds the base of a magic item whose name has a word with another item's hash", () => {
    const item = parseClipboard(MagicNameWithHashOfAnotherItem.rawText);

    expect(item.isOk()).toBe(true);
    const parsedItem = item._unsafeUnwrap();
    expect(parsedItem.info.refName).toBe(
      MagicNameWithHashOfAnotherItem.info.refName,
    );
    expect(parsedItem.category).toBe(MagicNameWithHashOfAnotherItem.category);
  });
});
