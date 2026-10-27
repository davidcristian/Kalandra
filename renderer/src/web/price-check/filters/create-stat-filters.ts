import {
  ParsedItem,
  ItemRarity,
  ItemCategory,
  itemIsModifiable,
} from "@/parser";
import {
  ModifierType,
  StatCalculated,
  StatRoll,
  statSourcesTotal,
  translateStatWithRoll,
} from "@/parser/modifiers";
import { percentRoll, percentRollDelta, roundRoll } from "./util";
import {
  FILTER_TAG_BY_MODIFIER_TYPE,
  FilterTag,
  ItemHasEmptyModifier,
  StatFilter,
  StatFilterRoll,
} from "./interfaces";
import { filterPseudo } from "./pseudo";
import { applyRules as applyMissingFracturedRules } from "./pseudo/missing-fractured-rules";
import { filterItemProp } from "./pseudo/item-property";
import { decodeOils, applyAnointmentRules } from "./pseudo/anointments";
import { StatBetter, CLIENT_STRINGS, CATALYST_TYPES } from "@/assets/data";
import { explicitModifierCount, maxUsefulItemLevel } from "./common";
import { getMaxSockets } from "@/parser/Parser";

export interface FiltersCreationContext {
  readonly item: ParsedItem;
  readonly searchInRange: number;
  filters: StatFilter[];
  statsByType: StatCalculated[];
}

export function createExactStatFilters(
  item: ParsedItem,
  statsByType: StatCalculated[],
  opts: { searchStatRange: number; defaultAllSelected: boolean },
): StatFilter[] {
  let searchInRange = Math.min(2, opts.searchStatRange);
  if (item.category === ItemCategory.Tablet) {
    searchInRange = 0;
  }

  if (item.mapBlighted || item.category === ItemCategory.Invitation) return [];
  if (
    item.isUnidentified &&
    item.rarity === ItemRarity.Unique &&
    !item.isSynthesised
  ) {
    return statsByType
      .filter((mod) => mod.type === ModifierType.Implicit)
      .map((mod) => calculatedStatToFilter(mod, searchInRange, item))
      .map((filter) => ({
        ...filter,
        disabled: false,
      }));
  }

  const keepByType = [
    ModifierType.Pseudo,
    ModifierType.Fractured,
    ModifierType.Desecrated,
    ModifierType.Crafted,
    ModifierType.Enchant,
    ModifierType.Sanctum,
    ModifierType.Skill,
  ];

  if (
    !item.influences.length &&
    !item.isFractured &&
    item.category !== ItemCategory.Tincture
  ) {
    keepByType.push(ModifierType.Implicit);
  }

  if (
    (item.rarity === ItemRarity.Magic ||
      (item.rarity === ItemRarity.Rare &&
        explicitModifierCount(item).total < 5)) &&
    item.category !== ItemCategory.ClusterJewel &&
    item.category !== ItemCategory.Map &&
    item.category !== ItemCategory.HeistContract &&
    item.category !== ItemCategory.HeistBlueprint &&
    item.category !== ItemCategory.Sentinel
  ) {
    keepByType.push(ModifierType.Explicit);
  }

  if (item.category === ItemCategory.Flask) {
    keepByType.push(ModifierType.Crafted);
  }

  const ctx: FiltersCreationContext = {
    item,
    searchInRange,
    filters: [],
    statsByType: statsByType.filter((calc) => keepByType.includes(calc.type)),
  };

  // A tablet's "# uses remaining" filter comes from filterPseudo
  if (item.category === ItemCategory.Tablet) {
    filterPseudo(ctx);
  }

  ctx.filters.push(
    ...ctx.statsByType.map((mod) =>
      calculatedStatToFilter(mod, ctx.searchInRange, item),
    ),
  );

  for (const filter of ctx.filters) {
    filter.hidden = undefined;

    // Left off: a tablet's implicits, and the explicit filters of a fractured item, which
    // searches its fractured modifiers instead
    if (
      (ctx.item.isFractured && filter.tag === FilterTag.Explicit) ||
      (item.category === ItemCategory.Tablet &&
        filter.tag === FilterTag.Implicit)
    ) {
      continue;
    }

    if (item.category === ItemCategory.Tablet) {
      filter.disabled = false;
    } else if (filter.tag === FilterTag.Explicit) {
      filter.disabled = !filter.sources.some(
        (source) =>
          source.modifier.info.tier != null && source.modifier.info.tier <= 2,
      );
    } else if (filter.tag !== FilterTag.Property) {
      filter.disabled = false;
    }

    if (filter.statRef === "# uses remaining" && filter.roll) {
      filter.roll.min = filter.roll.value;
      filter.roll.default.min = filter.roll.value;
      filter.roll.default.max = filter.roll.value;
    }
  }

  // Older game versions copied a fractured item without marking its fractured modifier
  if (
    ctx.item.isFractured &&
    !ctx.filters.some((f) => f.tag === FilterTag.Fractured)
  ) {
    const explicitStats = statsByType
      .filter((calc) => calc.type === ModifierType.Explicit)
      .map((mod) => calculatedStatToFilter(mod, ctx.searchInRange, item));
    applyMissingFracturedRules(ctx.filters, explicitStats);
  }

  const hasEmptyModifier = showHasEmptyModifier(ctx);
  if (hasEmptyModifier !== false) {
    const roll = hasEmptyModifier.counts[hasEmptyModifier.empty];
    ctx.filters.push({
      tradeId: ["item.has_empty_modifier"],
      text: "# Empty Modifier",
      statRef: "# Empty Modifier",
      disabled: false,
      tag: FilterTag.Pseudo,
      sources: [],
      option: {
        value: hasEmptyModifier.empty,
      },
      additionalInfo: {
        emptyModifierInfo: hasEmptyModifier.counts,
      },
      roll: {
        value: roll,
        min: roll,
        max: undefined,
        default: { min: roll, max: roll },
        dp: false,
        isNegated: false,
      },
    });
  }

  if (item.category === ItemCategory.ClusterJewel) {
    applyClusterJewelRules(ctx.filters);
  } else if (item.category === ItemCategory.Flask) {
    applyFlaskRules(ctx.filters);
  } else if (
    item.category === ItemCategory.MemoryLine ||
    item.category === ItemCategory.SanctumRelic ||
    item.category === ItemCategory.Charm ||
    item.category === ItemCategory.Relic
  ) {
    enableAllFilters(ctx.filters);
  }

  if (opts.defaultAllSelected) {
    enableAllFilters(ctx.filters);
  }

  return ctx.filters;
}

export function initUiModFilters(
  item: ParsedItem,
  opts: {
    searchStatRange: number;
    defaultAllSelected: boolean;
  },
): StatFilter[] {
  const ctx: FiltersCreationContext = {
    item,
    filters: [],
    searchInRange:
      item.rarity === ItemRarity.Normal ? 100 : opts.searchStatRange,
    statsByType: item.statsByType.map((calc) => {
      if (
        (calc.type === ModifierType.Fractured ||
          calc.type === ModifierType.Desecrated ||
          calc.type === ModifierType.Crafted) &&
        calc.stat.trade.ids?.[ModifierType.Explicit]
      ) {
        return { ...calc, type: ModifierType.Explicit };
      } else {
        return calc;
      }
    }),
  };

  if (item.info.refName !== "Split Personality") {
    filterItemProp(ctx);
    // No pseudo filters for a unique that can have sockets, since the trade site's totals
    // also count the augments of each listed unique
    if (item.rarity !== ItemRarity.Unique || !getMaxSockets(item)) {
      filterPseudo(ctx);
    }
  }

  if (itemIsModifiable(item)) {
    ctx.statsByType = ctx.statsByType.filter(
      (mod) =>
        mod.type !== ModifierType.Fractured &&
        mod.type !== ModifierType.Desecrated &&
        mod.type !== ModifierType.Crafted,
    );
    // The sources of a stat can come from several modifier types, so each of these keeps
    // only the sources of its own type
    const statsWithAllSources = item.statsByType.filter(
      (mod) =>
        mod.type === ModifierType.Fractured ||
        mod.type === ModifierType.Desecrated ||
        mod.type === ModifierType.Crafted,
    );
    const statsFilteredSources = statsWithAllSources.map((mod) => {
      const filteredSources = mod.sources.filter((source) => {
        return source.modifier.info.type === mod.type;
      });
      return {
        ...mod,
        sources: filteredSources,
      };
    });
    ctx.statsByType.push(...statsFilteredSources);
  }

  if (item.isVeiled) {
    ctx.statsByType = ctx.statsByType.filter(
      (mod) => mod.type !== ModifierType.Veiled,
    );
  }

  ctx.filters.push(
    ...ctx.statsByType.map((mod) =>
      calculatedStatToFilter(mod, ctx.searchInRange, item),
    ),
  );

  if (item.isVeiled) {
    ctx.filters.forEach((filter) => {
      filter.disabled = true;
    });
  }

  finalFilterTweaks(ctx);

  if (opts.defaultAllSelected) {
    enableAllFilters(ctx.filters);
  }

  return ctx.filters;
}

export function shortRollToFilter(
  roll: StatRoll,
  percent: number,
  item: ParsedItem,
): StatFilterRoll {
  // Only the elemental damage filters call this: their rolls have no decimals and are not negated
  const dp = false;
  const filterBounds = {
    min: percentRoll(roll.min, -0, Math.floor, dp),
    max: percentRoll(roll.max, +0, Math.ceil, dp),
  };
  const filterDefault = {
    min: percentRoll(roll.value, -percent, Math.floor, dp),
    max: percentRoll(roll.value, +percent, Math.ceil, dp),
  };

  filterDefault.min = Math.max(filterDefault.min, filterBounds.min);
  filterDefault.max = Math.min(filterDefault.max, filterBounds.max);

  const filterRoll = {
    value: roundRoll(roll.value, dp),
    min: undefined,
    max: undefined,
    default: filterDefault,
    bounds:
      item.rarity === ItemRarity.Unique && roll.min !== roll.max
        ? filterBounds
        : undefined,
    dp,
    isNegated: false,
    tradeInvert: false,
  };
  filterFillMinMax(filterRoll, StatBetter.PositiveRoll);
  return filterRoll;
}

export function calculatedStatToFilter(
  calc: StatCalculated,
  percent: number,
  item: ParsedItem,
  disabled: boolean = true,
): StatFilter {
  const { stat, sources, type } = calc;
  const tradeId = (stat.trade.ids ?? {})[
    type === ModifierType.AddedAugment ? ModifierType.Augment : type
  ];
  let filter: StatFilter;

  const roll = statSourcesTotal(calc.sources);
  const translation = translateStatWithRoll(calc, roll);

  if (stat.trade.option) {
    filter = {
      tradeId,
      statRef: stat.ref,
      text:
        roll?.option === roll?.value
          ? sources[0].stat.translation.string
          : translation.string,
      tag:
        type === ModifierType.Enchant ? FilterTag.Enchant : FilterTag.Variant,
      oils: decodeOils(calc),
      sources,
      option: {
        value: sources[0].contributes!.option!,
      },
      disabled: false,
    };
  }

  filter ??= {
    tradeId,
    statRef: stat.ref,
    text: translation.string,
    tag: FILTER_TAG_BY_MODIFIER_TYPE[type],
    oils: decodeOils(calc),
    sources,
    roll: undefined,
    disabled,
  };

  if (type === ModifierType.Implicit) {
    if (sources.some((s) => s.modifier.info.generation === "eldritch")) {
      filter.tag = FilterTag.Eldritch;
    } else if (item.isSynthesised) {
      filter.tag = FilterTag.Synthesised;
    } else if (
      item.info.unique?.base.startsWith("Runemastered") &&
      item.info.unique?.fixedStats
    ) {
      const fixedStats = item.info.unique.fixedStats;
      if (!fixedStats.includes(filter.statRef)) {
        filter.tag = FilterTag.Variant;
      }
    }
  } else if (type === ModifierType.Explicit) {
    if (
      item.rarity === ItemRarity.Unique &&
      sources.some((s) => s.modifier.info.generation === "mutated")
    ) {
      filter.tag = FilterTag.Mutated;
    }

    if (item.info.unique?.fixedStats) {
      const fixedStats = item.info.unique.fixedStats;
      if (!fixedStats.includes(filter.statRef)) {
        filter.tag = FilterTag.Variant;
      }
    } else if (hasModNamed(sources, CLIENT_STRINGS.DELVE_MODS)) {
      filter.tag = FilterTag.Delve;
    } else if (hasModNamed(sources, CLIENT_STRINGS.VEILED_MODS)) {
      // A veiled modifier keeps its tag
    } else if (hasModNamed(sources, CLIENT_STRINGS.INCURSION_MODS)) {
      filter.tag = FilterTag.Incursion;
    }
  } else if (type === ModifierType.Enchant) {
    if (sources.some((s) => s.modifier.info.generation === "corrupted")) {
      filter.tag = FilterTag.Corrupted;
    }
  }

  if (roll && (!filter.option || roll.option !== roll.value)) {
    if (
      (item.rarity === ItemRarity.Magic &&
        (item.isUnmodifiable || !itemIsModifiable(item))) ||
      stat.ref === "Has # Charm Slot"
    ) {
      percent = 0;
    } else if (
      item.rarity === ItemRarity.Unique ||
      (item.rarity === ItemRarity.Magic &&
        (item.category === ItemCategory.Jewel ||
          item.category === ItemCategory.Tablet)) ||
      calc.sources.some(
        ({ modifier }) =>
          modifier.info.tier === 1 &&
          modifier.info.type === ModifierType.Fractured,
      )
    ) {
      const perfectRoll =
        (calc.stat.better === StatBetter.PositiveRoll &&
          roll.value >= roll.max) ||
        (calc.stat.better === StatBetter.NegativeRoll &&
          roll.value <= roll.min);
      if (perfectRoll) {
        percent = 0;
      }
    }

    const dp =
      calc.stat.dp ||
      calc.sources.some(
        (s) => s.stat.stat.ref === calc.stat.ref && s.stat.roll?.dp,
      );

    const filterBounds = {
      min: percentRoll(roll.min, -0, Math.floor, dp),
      max: percentRoll(roll.max, +0, Math.ceil, dp),
    };

    const filterDefault =
      calc.stat.better === StatBetter.NotComparable
        ? { min: roll.value, max: roll.value }
        : item.rarity === ItemRarity.Unique
          ? {
              min: percentRollDelta(
                roll.value,
                roll.max - roll.min,
                -percent,
                Math.floor,
                dp,
              ),
              max: percentRollDelta(
                roll.value,
                roll.max - roll.min,
                +percent,
                Math.ceil,
                dp,
              ),
            }
          : {
              min: percentRoll(roll.value, -percent, Math.floor, dp),
              max: percentRoll(roll.value, +percent, Math.ceil, dp),
            };

    filterDefault.min = Math.max(filterDefault.min, filterBounds.min);
    filterDefault.max = Math.min(filterDefault.max, filterBounds.max);

    filter.roll = {
      value: roundRoll(roll.value, dp),
      min: undefined,
      max: undefined,
      default: filterDefault,
      bounds:
        item.rarity === ItemRarity.Unique &&
        roll.min !== roll.max &&
        calc.stat.better !== StatBetter.NotComparable
          ? filterBounds
          : undefined,
      dp,
      isNegated: false,
      tradeInvert: calc.stat.trade.inverted,
    };

    let usedBetter = calc.stat.better;
    if (
      stat.trade.ids?.pseudo?.length === 1 &&
      stat.trade.ids.pseudo[0] === "item.reload_time"
    ) {
      usedBetter = StatBetter.NegativeRoll;
    }

    filterFillMinMax(filter.roll, usedBetter);

    if (translation.negate) {
      filterAdjustmentForNegate(filter.roll);
    }
  }

  hideNotVariableStat(filter, item);

  return filter;
}

function hideNotVariableStat(filter: StatFilter, item: ParsedItem) {
  if (item.rarity !== ItemRarity.Unique) return;
  if (filter.tag === FilterTag.Implicit && item.category === ItemCategory.Jewel)
    return;
  if (
    (filter.tag !== FilterTag.Implicit &&
      filter.tag !== FilterTag.Explicit &&
      filter.tag !== FilterTag.Pseudo) ||
    (filter.tag === FilterTag.Pseudo &&
      filter.sources.some((s) => s.modifier.info.type === ModifierType.Enchant))
  )
    return;

  if (filter.statRef === "# uses remaining") return;

  if (!filter.roll) {
    filter.hidden = "filters.hide_const_roll";
  } else if (!filter.roll.bounds && item.rarity === ItemRarity.Unique) {
    filter.roll.min = undefined;
    filter.roll.max = undefined;
    filter.hidden = "filters.hide_const_roll";
  }
}

function filterFillMinMax(
  roll: NonNullable<StatFilter["roll"]>,
  better: StatBetter,
) {
  switch (better) {
    case StatBetter.PositiveRoll:
      roll.min = roll.default.min;
      break;
    case StatBetter.NegativeRoll:
      roll.max = roll.default.max;
      break;
    case StatBetter.NotComparable:
      roll.min = roll.default.min;
      roll.max = roll.default.max;
      break;
  }
}

function filterAdjustmentForNegate(roll: NonNullable<StatFilter["roll"]>) {
  roll.tradeInvert = !roll.tradeInvert;
  roll.isNegated = true;
  const swap = JSON.parse(JSON.stringify(roll)) as typeof roll;

  if (swap.bounds && roll.bounds) {
    roll.bounds.min = -1 * swap.bounds.max;
    roll.bounds.max = -1 * swap.bounds.min;
  }

  roll.default.min = -1 * swap.default.max;
  roll.default.max = -1 * swap.default.min;

  roll.value = -1 * swap.value;
  roll.min = typeof swap.max === "number" ? -1 * swap.max : undefined;
  roll.max = typeof swap.min === "number" ? -1 * swap.min : undefined;
}

export function finalFilterTweaks(ctx: FiltersCreationContext) {
  const { item } = ctx;

  if (
    item.category === ItemCategory.ClusterJewel &&
    item.rarity !== ItemRarity.Unique
  ) {
    applyClusterJewelRules(ctx.filters);
  } else if (item.category === ItemCategory.Flask) {
    applyFlaskRules(ctx.filters);
  }

  if (
    item.rarity === ItemRarity.Unique &&
    item.info.refName !== "Morior Invictus" &&
    item.info.refName !== "Darkness Enthroned"
  ) {
    hideAllAugments(ctx.filters);
  }

  const hasEmptyModifier = showHasEmptyModifier(ctx);
  if (hasEmptyModifier !== false) {
    const roll = hasEmptyModifier.counts[hasEmptyModifier.empty];
    ctx.filters.push({
      tradeId: ["item.has_empty_modifier"],
      text: "# Empty Modifier",
      statRef: "# Empty Modifier",
      disabled: true,
      hidden: "filters.hide_empty_mod",
      tag: FilterTag.Pseudo,
      sources: [],
      option: {
        value: hasEmptyModifier.empty,
      },
      additionalInfo: {
        emptyModifierInfo: hasEmptyModifier.counts,
      },
      roll: {
        value: roll,
        min: roll,
        max: undefined,
        default: { min: roll, max: roll },
        dp: false,
        isNegated: false,
      },
    });
  }

  if (
    item.category === ItemCategory.Amulet ||
    item.category === ItemCategory.Ring
  ) {
    applyAnointmentRules(ctx.filters, ctx.item);
  }

  const possibleCatalyst = item.qualityType
    ? (item.category === ItemCategory.Jewel
        ? CATALYST_TYPES.Refined
        : item.category === ItemCategory.Ring ||
            item.category === ItemCategory.Amulet
          ? CATALYST_TYPES.Normal
          : undefined
      )?.find((c) => c.tags[1] === item.qualityType)
    : undefined;

  for (const filter of ctx.filters) {
    if (
      filter.tag === FilterTag.Fractured ||
      filter.tag === FilterTag.Desecrated ||
      filter.tag === FilterTag.Crafted
    ) {
      const mod = ctx.item.statsByType.find(
        (mod) => mod.stat.ref === filter.statRef,
      );
      if (mod?.stat.trade.ids?.[ModifierType.Explicit]) {
        filter.hidden = "filters.hide_for_crafting";
      }
    } else if (filter.tag === FilterTag.Skill && filter.roll) {
      filter.disabled = filter.roll.value < 19;
      if (filter.disabled) {
        filter.hidden = "filters.hide_not_max_level";
      }
    }
    if (ctx.item.category === ItemCategory.Map) {
      if (
        filter.tag !== FilterTag.Property &&
        filter.tag !== FilterTag.Desecrated
      ) {
        filter.disabled = true;
        filter.hidden = "filters.hide_for_map";
      }
    }
    if (ctx.item.category === ItemCategory.Tablet) {
      // Shown even on a unique tablet, whose fixed rolls are hidden
      if (filter.statRef === "# uses remaining") {
        filter.hidden = undefined;
      }
    }
    if (filter.sources.some((s) => s.stat.fromAddedAugment)) {
      filter.editorAdded = filter.sources.find(
        (s) => s.stat.fromAddedAugment,
      )?.stat.fromAddedAugment;
    }
    if (
      filter.sources.some((s) => s.modifier.info.addedIncr) &&
      possibleCatalyst
    ) {
      filter.editorAdded = possibleCatalyst;
    }
  }

  if (
    item.rarity === ItemRarity.Magic &&
    itemIsModifiable(item) &&
    item.itemLevel &&
    maxUsefulItemLevel(item.category) - 3 > item.itemLevel
  ) {
    ctx.filters.push({
      tradeId: ["item.rarity_magic"],
      text: "Rarity: Magic",
      statRef: "Rarity: Magic",
      disabled: true,
      hidden: "filters.hide_low_ilvl",
      tag: FilterTag.Pseudo,
      sources: [],
    });
  }

  if (
    item.rarity === ItemRarity.Unique ||
    item.category === ItemCategory.Relic
  ) {
    const countVisible = ctx.filters.reduce(
      (cnt, filter) => (filter.hidden ? cnt : cnt + 1),
      0,
    );
    if (countVisible <= 3) {
      enableAllFilters(ctx.filters);
    }
  }
}

function hasModNamed(sources: StatFilter["sources"], names: string[]) {
  return sources.some(
    (s) =>
      s.modifier.info.name !== undefined &&
      names.includes(s.modifier.info.name),
  );
}

function applyClusterJewelRules(filters: StatFilter[]) {
  for (const filter of filters) {
    if (filter.statRef === "# Added Passive Skills are Jewel Sockets") {
      filter.hidden = "filters.hide_const_roll";
      filter.disabled = true;
    }

    // https://www.poewiki.net/wiki/Cluster_Jewel#Optimal_passive_skill_amounts
    if (filter.statRef === "Adds # Passive Skills") {
      filter.disabled = false;

      const roll = filter.roll;
      if (roll?.value === 4) {
        roll.max = 5;
      } else if (roll?.value === 5) {
        roll.min = roll.default.min;
      } else if (roll && [3, 6, 10, 11, 12].includes(roll.value)) {
        roll.min = roll.default.min;
        roll.max = undefined;
      }
      // Other values keep the range that calculatedStatToFilter set
    }
  }
}

function applyFlaskRules(filters: StatFilter[]) {
  for (const filter of filters) {
    if (filter.tag === FilterTag.Enchant) {
      filter.hidden = "hide_harvest_and_instilling";
      filter.disabled = true;
    }
  }
}

function hideAllAugments(filters: StatFilter[]) {
  for (const filter of filters) {
    if (
      filter.tag === FilterTag.Augment ||
      filter.tag === FilterTag.AddedAugment
    ) {
      filter.disabled = true;

      if (
        filter.statRef ===
        "Destroys all Augment Sockets on the item to create a Jewel Socket"
      ) {
        continue;
      }

      filter.hidden = "filters.hide_const_roll";
    }
  }
}

function showHasEmptyModifier(ctx: FiltersCreationContext):
  | {
      empty: ItemHasEmptyModifier;
      counts: Record<ItemHasEmptyModifier, number>;
    }
  | false {
  const { item } = ctx;

  if (!itemIsModifiable(item) || item.category === ItemCategory.Map) {
    return false;
  }

  if (item.rarity !== ItemRarity.Rare && item.rarity !== ItemRarity.Magic) {
    return false;
  }

  const { prefixes, suffixes, total } = explicitModifierCount(item);
  const maxAmount = itemMaxModifiersBySlot(item, ctx.filters);

  if (total !== maxAmount[ItemHasEmptyModifier.Any] && total !== 0) {
    const empty =
      suffixes === maxAmount[ItemHasEmptyModifier.Suffix]
        ? ItemHasEmptyModifier.Prefix
        : prefixes === maxAmount[ItemHasEmptyModifier.Prefix]
          ? ItemHasEmptyModifier.Suffix
          : ItemHasEmptyModifier.Any;

    const counts = {
      [ItemHasEmptyModifier.Any]: maxAmount[ItemHasEmptyModifier.Any] - total,
      [ItemHasEmptyModifier.Prefix]:
        maxAmount[ItemHasEmptyModifier.Prefix] - prefixes,
      [ItemHasEmptyModifier.Suffix]:
        maxAmount[ItemHasEmptyModifier.Suffix] - suffixes,
    };

    return {
      empty,
      counts,
    };
  }

  return false;
}

function enableAllFilters(filters: StatFilter[]) {
  for (const filter of filters) {
    if (!filter.hidden) {
      filter.disabled = false;
    }
  }
}

function itemBaseMaxModifiersOfType(
  category: ItemCategory | undefined,
  rarity: ItemRarity | undefined,
) {
  let base;
  switch (rarity) {
    case ItemRarity.Normal:
      base = 0;
      break;
    case ItemRarity.Magic:
      base = 1;
      break;

    default:
      switch (category) {
        case ItemCategory.Jewel:
        case ItemCategory.Tablet:
        case ItemCategory.Relic:
        case ItemCategory.SanctumRelic:
          base = 2;
          break;
        default:
          base = 3;
          break;
      }
      break;
  }
  return base;
}
function itemMaxModifiersBySlot(
  item: ParsedItem,
  statsAndRolls: Array<{ statRef: string; roll?: StatFilterRoll }>,
) {
  const base = itemBaseMaxModifiersOfType(item.category, item.rarity);

  const maxAmount = [2 * base, base, base];
  for (const { statRef, roll } of statsAndRolls) {
    if (statRef === "# Prefix Modifier allowed") {
      maxAmount[ItemHasEmptyModifier.Prefix] += roll?.value ?? 0;
    } else if (statRef === "# Suffix Modifier allowed") {
      maxAmount[ItemHasEmptyModifier.Suffix] += roll?.value ?? 0;
    }
  }

  if (maxAmount[ItemHasEmptyModifier.Prefix] < 0) {
    maxAmount[ItemHasEmptyModifier.Prefix] = 0;
  }
  if (maxAmount[ItemHasEmptyModifier.Suffix] < 0) {
    maxAmount[ItemHasEmptyModifier.Suffix] = 0;
  }

  maxAmount[ItemHasEmptyModifier.Any] =
    maxAmount[ItemHasEmptyModifier.Prefix] +
    maxAmount[ItemHasEmptyModifier.Suffix];

  return maxAmount;
}

// eslint-disable-next-line @typescript-eslint/naming-convention -- the name marks an object exported only for tests
export const __testExports = {
  itemMaxModifiersBySlot,
};
