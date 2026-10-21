import { describe, expect, it } from "vitest";
import { createTestCreateOptions, createTestItem } from "@specs/helper";
import { ItemCategory, ItemInfluence, ItemRarity } from "@/parser";
import type { ParsedItem } from "@/parser";
import { createFilters } from "@/web/price-check/filters/create-item-filters";
import type { ItemFilters } from "@/web/price-check/filters/interfaces";
import { createTradeRequest } from "@/web/price-check/trade/pathofexile-trade";

interface Toggle {
  disabled: boolean;
}

// The item editor's state, which the filter buttons do not show
const NOT_SHOWN = ["itemEditorSelection"];

const ITEMS: Array<[string, Partial<ParsedItem>]> = [
  [
    "a sentinel with a charge",
    { category: ItemCategory.Sentinel, sentinelCharge: 3 },
  ],
  [
    "a heist blueprint with revealed wings",
    {
      category: ItemCategory.HeistBlueprint,
      areaLevel: 83,
      heist: { wingsRevealed: 2 },
    },
  ],
  [
    "an item with linked and white sockets",
    { gemSockets: { number: 6, linked: 6, white: 2 } },
  ],
  [
    "an influenced rare item",
    {
      rarity: ItemRarity.Rare,
      influences: [ItemInfluence.Shaper, ItemInfluence.Elder],
    },
  ],
];

const UNIQUE: Partial<ParsedItem> = {
  rarity: ItemRarity.Unique,
  isCorrupted: true,
  isMirrored: true,
  isUnidentified: true,
  quality: 22,
  category: ItemCategory.BodyArmour,
  augmentSockets: { empty: 0, current: 3, normal: 2, augments: [] },
};

function item(props: Partial<ParsedItem>): ParsedItem {
  return { ...createTestItem(), ...props };
}

function isToggle(value: unknown): value is Toggle {
  return (
    typeof value === "object" &&
    value !== null &&
    "disabled" in value &&
    typeof value.disabled === "boolean"
  );
}

/** Returns each filter button that turns on and off, with the name of its filter. */
function toggles(filters: ItemFilters): Array<[string, Toggle]> {
  return Object.entries(filters)
    .filter(([name]) => !NOT_SHOWN.includes(name))
    .flatMap(([name, value]) => {
      const list: unknown[] = Array.isArray(value) ? value : [value];
      return list
        .filter(isToggle)
        .map((toggle): [string, Toggle] => [name, toggle]);
    });
}

function search(filters: ItemFilters, parsed: ParsedItem) {
  return JSON.stringify(createTradeRequest(filters, [], parsed));
}

/** Returns the name of each filter button that leaves the search the same when turned on or off. */
function unchangedToggles(props: Partial<ParsedItem>): string[] {
  const parsed = item(props);
  const filters = createFilters(parsed, {
    ...createTestCreateOptions(),
    exact: true,
  });
  return toggles(filters)
    .filter(([, toggle]) => {
      toggle.disabled = false;
      const on = search(filters, parsed);
      toggle.disabled = true;
      return on === search(filters, parsed);
    })
    .map(([name]) => name);
}

describe("the filter buttons of a price check", () => {
  it("are found for an item with several of them", () => {
    const filters = createFilters(item(UNIQUE), createTestCreateOptions());

    expect(toggles(filters).map(([name]) => name)).toEqual(
      expect.arrayContaining([
        "augmentSockets",
        "quality",
        "mirrored",
        "unidentified",
      ]),
    );
  });

  it.each([["a corrupted unique", UNIQUE], ...ITEMS])(
    "change the search when turned on or off, for %s",
    (_, props) => {
      expect(unchangedToggles(props)).toEqual([]);
    },
  );

  it("show no blight label for a map, since the search cannot send it", () => {
    const map = item({
      category: ItemCategory.Map,
      mapTier: 16,
      mapBlighted: "Blighted",
    });

    const filters = createFilters(map, createTestCreateOptions());

    expect(filters.mapTier?.value).toBe(16);
    expect(Object.keys(filters)).not.toContain("mapBlighted");
  });
});
