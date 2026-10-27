import { beforeEach, describe, expect, it } from "vitest";
import { init } from "@/assets/data";
import { ItemCategory, ParsedItem, parseClipboard } from "@/parser";
import { searchesAtOnce } from "@/web/price-check/initial-search";
import { createTestItem } from "@specs/helper";
import { setupTests } from "@specs/vitest.setup";
import {
  CharmQuality,
  MagicItem,
  MetaSkillGem,
  NormalItem,
  RareItem,
  UncutSkillGem,
  UnidentifiedBase,
  UniqueItem,
} from "../../Parser/items";

function parsed(text: string): ParsedItem {
  return parseClipboard(text)._unsafeUnwrap();
}

/** Whether the item searches at once with the suggested price off and on. */
function searchesFor(item: ParsedItem) {
  return { off: searchesAtOnce(item, false), on: searchesAtOnce(item, true) };
}

describe("searchesAtOnce", () => {
  beforeEach(async () => {
    setupTests();
    await init("en");
  });

  it("searches at once for a rare, magic or normal item only with the suggested price on", () => {
    const waitsWithoutIt = { off: false, on: true };

    expect(searchesFor(parsed(RareItem.rawText))).toEqual(waitsWithoutIt);
    expect(searchesFor(parsed(MagicItem.rawText))).toEqual(waitsWithoutIt);
    expect(searchesFor(parsed(NormalItem.rawText))).toEqual(waitsWithoutIt);
  });

  it("searches at once for a unique, an unidentified item and a charm", () => {
    const always = { off: true, on: true };

    expect(searchesFor(parsed(UniqueItem.rawText))).toEqual(always);
    expect(searchesFor(parsed(UnidentifiedBase.rawText))).toEqual(always);
    expect(searchesFor(parsed(CharmQuality.rawText))).toEqual(always);
  });

  it("searches at once for a veiled rare", () => {
    const veiled = { ...parsed(RareItem.rawText), isVeiled: true };

    expect(searchesFor(veiled)).toEqual({ off: true, on: true });
  });

  it("searches at once for a gem or currency, which has no trade site category", () => {
    const always = { off: true, on: true };

    expect(searchesFor(parsed(MetaSkillGem.rawText))).toEqual(always);
    expect(searchesFor(parsed(UncutSkillGem.rawText))).toEqual(always);
  });

  it("waits for the Search button on an item with a trade site category and no rarity", () => {
    const item = {
      ...createTestItem(),
      category: ItemCategory.MapFragment,
      rarity: undefined,
    };

    expect(searchesFor(item)).toEqual({ off: false, on: false });
  });
});
