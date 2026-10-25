import { beforeEach, describe, expect, it } from "vitest";
import { setupTests } from "@specs/vitest.setup";
import { createTestCreateOptions } from "@specs/helper";
import {
  MetaSkillGem,
  UncutSkillGem,
  UncutSpiritGem,
  UncutSupportGem,
} from "@specs/Parser/items";
import type { TestItem } from "@specs/Parser/items";
import { init } from "@/assets/data";
import { parseClipboard } from "@/parser";
import { createFilters } from "@/web/price-check/filters/create-item-filters";
import type { ItemFilters } from "@/web/price-check/filters/interfaces";
import { createTradeRequest } from "@/web/price-check/trade/pathofexile-trade";

function filtersOf(item: TestItem) {
  const parsed = parseClipboard(item.rawText)._unsafeUnwrap();
  const filters = createFilters(parsed, {
    ...createTestCreateOptions(),
    exact: true,
  });
  return {
    filters,
    query: (edited: ItemFilters = filters) =>
      createTradeRequest(edited, [], parsed).query,
  };
}

describe("the filters of a gem", () => {
  beforeEach(async () => {
    setupTests();
    await init("en");
  });

  it("searches a skill gem by name and sockets, and by level from level 19", () => {
    const { filters, query } = filtersOf(MetaSkillGem);

    expect(filters.searchExact).toEqual({
      baseType: "Mirage Archer",
      baseTypeTrade: "Mirage Archer",
    });
    expect(filters.gemLevel).toEqual({ value: 14, disabled: true });
    expect(filters.socketNumber).toEqual({ value: 4, disabled: false });
    expect(filters.corrupted).toEqual({ value: false });
    const sent = query();
    expect(sent.type).toBe("Mirage Archer");
    expect(sent.filters.misc_filters?.filters).toMatchObject({
      gem_sockets: { min: 4 },
    });
    expect(sent.filters.misc_filters?.filters).not.toHaveProperty("gem_level");

    filters.gemLevel!.disabled = false;
    expect(query().filters.misc_filters?.filters.gem_level).toEqual({
      min: 14,
    });
  });

  it.each([
    ["Uncut Skill Gem (Level 19)", UncutSkillGem],
    ["Uncut Spirit Gem (Level 16)", UncutSpiritGem],
    ["Uncut Support Gem (Level 5)", UncutSupportGem],
  ])("searches an %s as currency, by the type of its level", (name, item) => {
    const { filters, query } = filtersOf(item);

    expect(filters.searchExact).toEqual({
      baseType: name,
      baseTypeTrade: name,
    });
    expect(filters.stackSize).toEqual({ value: 1, disabled: true });
    expect(filters.gemLevel).toBeUndefined();
    expect(query().type).toBe(name);
  });
});
