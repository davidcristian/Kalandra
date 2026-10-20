import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createTestCreateOptions, createTestItem } from "@specs/helper";
import type { ParsedItem } from "@/parser";
import { createFilters } from "@/web/price-check/filters/create-item-filters";
import type { ItemFilters } from "@/web/price-check/filters/interfaces";
import { createTradeRequest as createBulkRequest } from "@/web/price-check/trade/pathofexile-bulk";
import { createTradeRequest as createSearchRequest } from "@/web/price-check/trade/pathofexile-trade";

type ListingType = ItemFilters["trade"]["listingType"];

const CURRENCY: ParsedItem = {
  ...createTestItem(),
  info: { ...createTestItem().info, tradeTag: "chaos" },
};

function filtersWith(listingType: ListingType): ItemFilters {
  const filters = createFilters(createTestItem(), createTestCreateOptions());
  filters.trade.listingType = listingType;
  return filters;
}

describe("the listing type of a trade request", () => {
  let errors: unknown[];

  beforeEach(() => {
    errors = [];
    vi.spyOn(console, "error").mockImplementation((message: unknown) => {
      errors.push(message);
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it.each<[ListingType, ListingType]>([
    ["onlineleague", "securable"],
    ["available", "available"],
    ["securable", "securable"],
    ["online", "online"],
    ["any", "any"],
  ])("sends %s as %s in an item search and keeps the filter", (type, sent) => {
    const filters = filtersWith(type);

    const body = createSearchRequest(filters, [], createTestItem());

    expect(body.query.status.option).toBe(sent);
    expect(filters.trade.listingType).toBe(type);
    expect(errors).toEqual([]);
  });

  it.each<[ListingType, ListingType]>([
    ["securable", "online"],
    ["available", "online"],
    ["onlineleague", "onlineleague"],
    ["online", "online"],
    ["any", "any"],
  ])(
    "sends %s as %s in a currency exchange and keeps the filter",
    (type, sent) => {
      const filters = filtersWith(type);

      const body = createBulkRequest(filters, CURRENCY, ["divine"]);

      expect(body.query.status.option).toBe(sent);
      expect(filters.trade.listingType).toBe(type);
      expect(errors).toEqual([]);
    },
  );
});

describe("the listing type of new filters", () => {
  it.each<[ListingType | undefined, ListingType]>([
    [undefined, "securable"],
    ["onlineleague", "securable"],
    ["available", "available"],
    ["online", "online"],
    ["any", "any"],
  ])("starts from a remembered %s as %s", (remembered, expected) => {
    const filters = createFilters(createTestItem(), {
      ...createTestCreateOptions(),
      listingType: remembered,
    });

    expect(filters.trade.listingType).toBe(expected);
  });
});
