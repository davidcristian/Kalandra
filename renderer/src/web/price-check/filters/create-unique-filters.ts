import { ParsedItem } from "@/parser";
import { ModifierType, StatCalculated } from "@/parser/modifiers";
import { FilterPreset, StatFilter } from "./interfaces";
import {
  calculatedStatToFilter,
  FiltersCreationContext,
} from "./create-stat-filters";
import { propToFilter } from "./pseudo/item-property";
import { createFilters } from "./create-item-filters";

export const PRESET_UNIQUES = new Set(["Mageblood"]);

export function createUniquePresets(
  item: ParsedItem,
  opts: {
    league: string;
    currency: string | undefined;
    listingType:
      | "securable"
      | "any"
      | "online"
      | "available"
      | "onlineleague"
      | undefined;
    collapseListings: "app" | "api";
    activateStockFilter: boolean;
    searchStatRange: number;
    useEn: boolean;
    defaultAllSelected: boolean;
  },
): {
  presets: FilterPreset[];
  active: string;
} {
  if (!PRESET_UNIQUES.has(item.info.refName)) {
    throw new Error("item doesn't have unique presets");
  }
  switch (item.info.refName) {
    case "Mageblood":
      return {
        active: "filters.preset_exact",
        presets: [
          {
            id: "filters.preset_exact",
            filters: createFilters(item, { ...opts, exact: true }),
            stats: createMagebloodFilters(item, item.statsByType, opts),
          },
        ],
      };
  }

  throw new Error("not implemented");
}

function createMagebloodFilters(
  item: ParsedItem,
  statsByType: StatCalculated[],
  opts: { searchStatRange: number },
): StatFilter[] {
  const searchInRange = Math.min(2, opts.searchStatRange);
  const ctx: FiltersCreationContext = {
    item,
    searchInRange,
    filters: [],
    statsByType,
  };

  /** --------
   *  { Implicit Modifier }
   *  20% of Flask Recovery applied Instantly
   *  { Implicit Modifier — Charm }
   *  Has 3(1-3) Charm Slots
   *  --------
   *  { Unique Modifier }
   *  Legacy of Topaz(Amethyst-Topaz) — Unscalable Value
   *  { Unique Modifier }
   *  Legacy of Topaz(Amethyst-Topaz) — Unscalable Value
   *  { Unique Modifier }
   *  Legacy of Gold(Amethyst-Topaz) — Unscalable Value
   *  { Unique Modifier }
   *  Legacy of Topaz(Amethyst-Topaz) — Unscalable Value
   *  { Unique Modifier }
   *  All Mage's Legacies have 40(25-50)% increased effect per duplicate Mage's Legacy you have
   *  --------
   */

  // push all but the "Legacy of #" stats
  ctx.filters.push(
    ...ctx.statsByType
      .filter(
        (s) =>
          s.type !== ModifierType.Explicit ||
          s.stat.ref.startsWith("All Mage's Legacies"),
      )
      .map((mod) => calculatedStatToFilter(mod, ctx.searchInRange, item)),
  );

  const legacies = ctx.statsByType.filter(
    (s) => s.type === ModifierType.Explicit && s.stat.ref.startsWith("Legacy"),
  );

  const duplicates = 4 - legacies.length;
  const dupFilter = propToFilter(
    {
      ref: "Duplicates: #",
      tradeId: "item.duplicates",
      roll: {
        min: duplicates,
        max: duplicates,
        value: duplicates,
      },
      sources: legacies.flatMap((s) => s.sources),
      disabled: false,
    },
    ctx,
  );
  // calculatedStatToFilter hides a unique's fixed roll, and this roll gets a range of 0 to 3 below
  dupFilter.hidden = undefined;
  dupFilter.roll!.bounds = {
    min: 0,
    max: 3,
  };
  dupFilter.roll!.min = duplicates;
  ctx.filters.push(dupFilter);

  ctx.filters.push(
    ...legacies.map((mod) => {
      const f = calculatedStatToFilter(
        withoutRoll(mod),
        ctx.searchInRange,
        item,
      );
      f.roll = undefined;

      return f;
    }),
  );

  for (const filter of ctx.filters) {
    if (!filter.hidden) {
      filter.disabled = false;
    }
  }

  return ctx.filters;
}

/** Returns a copy of the stat with its first source at a roll of 0, and leaves the item's own stat unchanged. */
function withoutRoll(mod: StatCalculated): StatCalculated {
  const [source] = mod.sources;
  const option = source.contributes?.option;
  return {
    ...mod,
    sources: [{ ...source, contributes: { value: 0, min: 0, max: 0, option } }],
  };
}
