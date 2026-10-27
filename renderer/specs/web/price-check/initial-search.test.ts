import { beforeEach, describe, expect, it } from "vitest";
import { init } from "@/assets/data";
import { ItemCategory, parseClipboard } from "@/parser";
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

function searchesAtOnceFor(text: string): boolean {
  return searchesAtOnce(parseClipboard(text)._unsafeUnwrap());
}

describe("searchesAtOnce", () => {
  beforeEach(async () => {
    setupTests();
    await init("en");
  });

  it("searches at once for a rare, magic or normal item", () => {
    expect(searchesAtOnceFor(RareItem.rawText)).toBe(true);
    expect(searchesAtOnceFor(MagicItem.rawText)).toBe(true);
    expect(searchesAtOnceFor(NormalItem.rawText)).toBe(true);
  });

  it("searches at once for a unique, an unidentified item and a charm", () => {
    expect(searchesAtOnceFor(UniqueItem.rawText)).toBe(true);
    expect(searchesAtOnceFor(UnidentifiedBase.rawText)).toBe(true);
    expect(searchesAtOnceFor(CharmQuality.rawText)).toBe(true);
  });

  it("searches at once for a gem or currency, which has no trade site category", () => {
    expect(searchesAtOnceFor(MetaSkillGem.rawText)).toBe(true);
    expect(searchesAtOnceFor(UncutSkillGem.rawText)).toBe(true);
  });

  it("waits for the Search button on an item with a trade site category and no rarity", () => {
    const item = {
      ...createTestItem(),
      category: ItemCategory.MapFragment,
      rarity: undefined,
    };

    expect(searchesAtOnce(item)).toBe(false);
  });
});
