import { init, TRADE_ITEM_BY_REF } from "@/assets/data";
import { ItemCategory, parseClipboard } from "@/parser";
import { uniqueBaseTradeName } from "@/web/price-check/filters/common";
import { createFilters } from "@/web/price-check/filters/create-item-filters";
import { Host } from "@/web/background/IPC";
import { createTestCreateOptions } from "@specs/helper";
import { setupTests } from "@specs/vitest.setup";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { UniqueOnUnknownBase } from "./items";

const savedProxy = vi.mocked(Host.proxy).getMockImplementation()!;

// The saved trade site item list with one unique that the item data does not have
async function proxyWithAddedUnique(
  url: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  const response = await savedProxy(url, init);
  if (!String(url).endsWith("api/trade2/data/items")) return response;
  const items = (await response.json()) as {
    result: Array<{ entries: object[] }>;
  };
  items.result[0].entries.push({
    type: UniqueOnUnknownBase.info.unique!.base,
    text: `${UniqueOnUnknownBase.info.name} ${UniqueOnUnknownBase.info.unique!.base}`,
    name: UniqueOnUnknownBase.info.name,
    flags: { unique: true },
  });
  return new Response(JSON.stringify(items));
}

describe("unique items found only in the trade site's item list", () => {
  beforeEach(async () => {
    setupTests();
    vi.mocked(Host.proxy).mockImplementation(proxyWithAddedUnique);
    await init("en");
  });

  it("parses a unique whose base type the item data does not have", () => {
    const item = parseClipboard(UniqueOnUnknownBase.rawText);

    expect(item.isOk()).toBe(true);
    const parsedItem = item._unsafeUnwrap();
    expect(parsedItem.info).toEqual(UniqueOnUnknownBase.info);
    expect(parsedItem.category).toBe(UniqueOnUnknownBase.category);
    expect(parsedItem.itemLevel).toBe(UniqueOnUnknownBase.itemLevel);
    expect(parsedItem.requires).toEqual(UniqueOnUnknownBase.requires);
    expect(parsedItem.newMods).toHaveLength(
      UniqueOnUnknownBase.uniqueAffixCount,
    );
  });

  it("searches the trade site by the base type text of the item", () => {
    const item = parseClipboard(UniqueOnUnknownBase.rawText)._unsafeUnwrap();

    const filters = createFilters(item, createTestCreateOptions());

    expect(filters.searchExact).toEqual({
      name: "Stormglass Reverie",
      nameTrade: "Stormglass Reverie",
      baseTypeTrade: "Prism Focus",
    });
  });
});

describe("TRADE_ITEM_BY_REF", () => {
  it("returns an item of the trade site's list as craftable with an unknown category when asked to", async () => {
    setupTests();
    await init("en");

    expect(TRADE_ITEM_BY_REF({ name: "Temple Maul" }, true)).toEqual([
      expect.objectContaining({
        craftable: { category: ItemCategory.Unknown },
      }),
    ]);
    expect(TRADE_ITEM_BY_REF({ name: "Temple Maul" })?.[0].craftable).toBe(
      undefined,
    );
  });
});

describe("uniqueBaseTradeName", () => {
  it("returns the translated or English name of a base type in the item data", async () => {
    setupTests();
    await init("de");

    expect(uniqueBaseTradeName("Crystal Focus", false)).toBe("Kristallfokus");
    expect(uniqueBaseTradeName("Crystal Focus", true)).toBe("Crystal Focus");
  });
});
