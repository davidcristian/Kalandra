import { init, ITEM_BY_TRANSLATED } from "@/assets/data";
import { parseClipboard } from "@/parser";
import type { Config } from "@/web/Config";
import { setupTests } from "@specs/vitest.setup";
import { describe, expect, it } from "vitest";
import {
  DeCoatOfRed,
  DeCoutureOfCrimson,
  DePlatedRaiment,
  DePlatedVestments,
  JaArrayBuckler,
  JaArrayedFocus,
  JaAtziriOnOtherBase,
  JaAtzirisContempt,
  JaAtzirisDisdain,
  JaVagabondArmour,
  TestItem,
} from "./items";

async function loadLanguage(language: Config["language"]) {
  setupTests({ language });
  await init(language);
}

function refNamesOf(records: Array<{ refName: string }> | undefined) {
  return records?.map((record) => record.refName);
}

function expectParsedAs(expected: TestItem) {
  const item = parseClipboard(expected.rawText);

  expect(item.isOk()).toBe(true);
  const parsedItem = item._unsafeUnwrap();
  expect(parsedItem.info.refName).toBe(expected.info.refName);
  expect(parsedItem.category).toBe(expected.category);
  expect(parsedItem.rarity).toBe(expected.rarity);
}

describe("item lookup by a translated name that items share", () => {
  it("returns every item with the name", async () => {
    await loadLanguage("ja");

    expect(refNamesOf(ITEM_BY_TRANSLATED("ITEM", "整列のフォーカス"))).toEqual([
      "Array Buckler",
      "Arrayed Focus",
    ]);
  });

  it("returns each variant of the uniques with the name once", async () => {
    await loadLanguage("ja");

    const records = ITEM_BY_TRANSLATED("UNIQUE", "アッツィリの軽蔑");

    expect(records?.map((record) => record.unique?.base)).toEqual([
      "Pronged Spear",
      "Gold Circlet",
      "Runemastered Gold Circlet",
    ]);
  });
});

describe("parsing an item whose translated name another item shares", () => {
  it.each([
    ["Focus", JaArrayedFocus],
    ["Buckler", JaArrayBuckler],
  ])("picks the %s by the defences it shows (ja)", async (_, expected) => {
    await loadLanguage("ja");

    expectParsedAs(expected);
  });

  it.each([
    ["armour and energy shield", DePlatedVestments],
    ["energy shield only", DePlatedRaiment],
  ])("picks the base with %s (de)", async (_, expected) => {
    await loadLanguage("de");

    expectParsedAs(expected);
  });

  it.each([
    ["Gold Circlet", JaAtzirisDisdain],
    ["Pronged Spear", JaAtzirisContempt],
  ])("picks the unique on %s (ja)", async (_, expected) => {
    await loadLanguage("ja");

    expectParsedAs(expected);
  });

  it.each([
    ["Gilded Vestments", DeCoutureOfCrimson],
    ["Chain Mail", DeCoatOfRed],
  ])("picks the unique on %s (de)", async (_, expected) => {
    await loadLanguage("de");

    expectParsedAs(expected);
  });

  it("keeps the first item in the data when the text does not tell them apart", async () => {
    await loadLanguage("ja");

    expectParsedAs(JaVagabondArmour);
  });

  it("keeps the first unique when none is on the copied base type", async () => {
    await loadLanguage("ja");

    expectParsedAs(JaAtziriOnOtherBase);
  });
});
