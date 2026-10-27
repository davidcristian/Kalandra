import type { ItemFilters } from "./interfaces";
import { ParsedItem, ItemCategory, ItemRarity } from "@/parser";
import { searchListingType, tradeTag } from "../trade/common";
import { ModifierType } from "@/parser/modifiers";
import type { BaseType } from "@/assets/data";
import { CATEGORY_TO_TRADE_ID } from "../trade/pathofexile-trade";
import { ARMOUR, GEM, WEAPON } from "@/parser/meta";
import { maxUsefulItemLevel, uniqueBaseTradeName } from "./common";

const CATEGORIES_WITH_USEFUL_QUALITY = new Set([
  ItemCategory.Flask,
  ItemCategory.Charm,
  ...WEAPON,
  ...ARMOUR,
]);

interface CreateOptions {
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
  exact: boolean;
  useEn: boolean;
}

export function createFilters(
  item: ParsedItem,
  opts: CreateOptions,
): ItemFilters {
  const filters: ItemFilters = {
    searchExact: {},
    trade: {
      offline: false,
      onlineInLeague: false,
      listingType: searchListingType(opts.listingType ?? "securable"),
      listed: undefined,
      currency: opts.currency,
      league: opts.league,
      collapseListings: opts.collapseListings,
    },
  };

  if (item.category && GEM.has(item.category) && !tradeTag(item)) {
    return createGemFilters(item, filters, opts);
  }
  if (item.category === ItemCategory.Currency && item.trials) {
    return createTrialsFilters(item, filters, opts);
  }
  if (item.category === ItemCategory.CapturedBeast) {
    filters.searchExact = {
      baseType: item.info.name,
      baseTypeTrade: item.info.refName, // The trade site takes the English name
    };
    return filters;
  }
  if (item.stackSize || tradeTag(item)) {
    filters.stackSize = {
      value: item.stackSize?.value || 1,
      disabled: !(
        item.stackSize &&
        item.stackSize.value > 1 &&
        opts.activateStockFilter
      ),
    };
  }
  if (item.category === ItemCategory.MetamorphSample) {
    filters.searchExact = {
      baseType: item.info.name,
      baseTypeTrade: t(opts, item.info),
    };
    filters.itemLevel = {
      value: item.itemLevel!,
      disabled: false,
    };
    return filters;
  }
  if (
    item.category === ItemCategory.DivinationCard ||
    item.category === ItemCategory.Currency
  ) {
    filters.searchExact = {
      baseType: item.info.name,
      baseTypeTrade: t(opts, item.info),
    };
    return filters;
  }

  if (item.category === ItemCategory.Map) {
    if (item.rarity === ItemRarity.Unique && item.info.unique) {
      filters.searchExact = {
        name: item.info.name,
        nameTrade: t(opts, item.info),
        baseTypeTrade: uniqueBaseTradeName(item.info.unique.base, opts.useEn),
      };
    } else {
      filters.searchExact = {
        baseType: item.info.name,
        baseTypeTrade: t(opts, item.info),
      };
      filters.searchRelaxed = {
        category: item.category,
        disabled: false,
      };
    }

    filters.mapTier = {
      value: item.mapTier!,
      disabled: false,
    };
  } else if (item.info.refName === "Expedition Logbook") {
    filters.searchExact = {
      baseType: item.info.name,
      baseTypeTrade: t(opts, item.info),
    };
    filters.areaLevel = {
      value: item.areaLevel!,
      disabled: false,
    };
  } else if (item.rarity === ItemRarity.Unique && item.info.unique) {
    filters.searchExact = {
      name: item.info.name,
      nameTrade: t(opts, item.info),
      baseTypeTrade: uniqueBaseTradeName(item.info.unique.base, opts.useEn),
    };
  } else {
    filters.searchExact = {
      baseType: item.info.name,
      baseTypeTrade: t(opts, item.info),
    };
    if (item.category && CATEGORY_TO_TRADE_ID.has(item.category)) {
      filters.searchRelaxed = {
        category: item.category,
        disabled: item.category !== ItemCategory.Charm && opts.exact,
      };
    }
  }

  if (item.quality) {
    if (item.quality >= 20 && item.category === ItemCategory.Flask) {
      filters.quality = {
        value: item.quality,
        disabled: item.quality <= 20,
      };
    } else if (
      // Only exceptional quality counts, since most items have 20
      item.quality > 20 &&
      item.category &&
      CATEGORIES_WITH_USEFUL_QUALITY.has(item.category)
    ) {
      filters.quality = {
        value: item.quality,
        // Off for a rare, which is most likely finished, so its quality does not matter to a buyer
        disabled: item.rarity === ItemRarity.Rare,
      };
    } else if (item.category === ItemCategory.Charm) {
      filters.quality = {
        value: item.quality,
        disabled: item.quality < 10,
      };
    }
  }

  if (item.augmentSockets) {
    if (item.augmentSockets.current) {
      filters.augmentSockets = {
        value: item.augmentSockets.current,
        disabled:
          item.augmentSockets.current <= item.augmentSockets.normal &&
          !item.isCorrupted,
      };
    }
  }
  if (item.requires && item.rarity === ItemRarity.Rare && !opts.exact) {
    if (
      item.requires.level &&
      item.requires.level <= 75 &&
      item.itemLevel &&
      item.itemLevel <= 75
    ) {
      filters.requires = {
        level: {
          value: item.requires.level,
          disabled: true,
        },
      };
    }
  }

  const forAdornedJewel =
    item.rarity === ItemRarity.Magic &&
    // item.isCorrupted is left out, so the buyer can corrupt the jewel
    item.category === ItemCategory.Jewel;

  if (
    !item.isUnmodifiable &&
    // A buyer of a waystone with the right modifiers does not care whether it is corrupted
    item.category !== ItemCategory.Map &&
    (item.rarity === ItemRarity.Normal ||
      item.rarity === ItemRarity.Magic ||
      item.rarity === ItemRarity.Rare ||
      item.rarity === ItemRarity.Unique)
  ) {
    filters.corrupted = {
      value: item.isCorrupted,
      exact: forAdornedJewel,
    };
  }

  if (forAdornedJewel) {
    filters.rarity = {
      value: "magic",
    };
  } else if (
    item.rarity === ItemRarity.Normal &&
    item.info.refName !== "Idol of Estazunti" &&
    opts.exact
  ) {
    // An Orb of Chance works only on a normal item, so the rarity matters
    filters.rarity = {
      value: "normal",
    };
  } else if (
    item.rarity === ItemRarity.Magic &&
    opts.exact &&
    // A magic tablet is searched with rare tablets too
    item.category !== ItemCategory.Tablet
  ) {
    filters.rarity = {
      value: "magic",
    };
  } else if (
    item.rarity === ItemRarity.Normal ||
    item.rarity === ItemRarity.Magic ||
    item.rarity === ItemRarity.Rare
  ) {
    filters.rarity = {
      value: "nonunique",
    };
  }

  if (item.isMirrored) {
    filters.mirrored = { disabled: false };
  }

  if (item.isSanctified) {
    filters.sanctified = { disabled: false };
  }

  if (!item.isFractured && opts.exact) {
    filters.fractured = { value: false };
  }

  if (item.isFoil) {
    filters.foil = { disabled: true };
  }

  if (item.itemLevel) {
    if (
      maxUsefulItemLevel(item.category) !== 1 &&
      item.rarity !== ItemRarity.Unique &&
      item.category !== ItemCategory.Map &&
      item.info.refName !== "Expedition Logbook"
    ) {
      filters.itemLevel = {
        value: Math.min(item.itemLevel, maxUsefulItemLevel(item.category)),
        disabled:
          !opts.exact ||
          item.category === ItemCategory.Flask ||
          item.category === ItemCategory.Charm,
      };
    }
  }

  if (item.isUnidentified) {
    if (item.unidentifiedTier) {
      filters.unidentifiedTier = {
        value: item.unidentifiedTier,
        disabled: item.unidentifiedTier < 5,
      };
    } else {
      filters.unidentified = {
        value: true,
        disabled: item.rarity !== ItemRarity.Unique,
      };
    }
  }

  if (item.isVeiled) {
    filters.veiled = {
      statRefs: item.statsByType
        .filter((calc) => calc.type === ModifierType.Veiled)
        .map((calc) => calc.stat.ref),
      veiledCount: item.newMods.filter(
        (m) => m.info.type === ModifierType.Veiled,
      ).length,
      disabled: item.rarity !== ItemRarity.Unique,
    };

    if (item.rarity !== ItemRarity.Unique) {
      if (filters.itemLevel) {
        filters.itemLevel.disabled = false;
      }
    }
  }

  return filters;
}

function createGemFilters(
  item: ParsedItem,
  filters: ItemFilters,
  opts: CreateOptions,
) {
  filters.searchExact = {
    baseType: item.info.name,
    baseTypeTrade: t(opts, item.info),
  };

  filters.corrupted = {
    value: item.isCorrupted,
  };

  if (item.gemSockets) {
    filters.socketNumber = {
      value: item.gemSockets.number,
      disabled: item.gemSockets.number < 3,
    };
  }

  if (item.quality) {
    filters.quality = {
      value: item.quality,
      disabled: item.quality < 16,
    };
  }

  filters.gemLevel = {
    value: item.gemLevel!,
    disabled: item.gemLevel! < 19,
  };

  return filters;
}

export function createTrialsFilters(
  item: ParsedItem,
  filters: ItemFilters,
  opts: CreateOptions,
) {
  const refName = item.info.refName;
  filters.searchExact = {
    baseType: item.info.name,
    baseTypeTrade: t(opts, item.info),
  };
  const fixedAreaLevel = ascendancyPointsByAreaLevel(refName, item.areaLevel!);

  filters.awardedAscendancyPoints = {
    value: fixedAreaLevel,
    disabled: false,
  };

  filters.areaLevel = {
    value: item.areaLevel!,
    disabled: false,
  };

  if (refName === "Inscribed Ultimatum" && item.trials?.ultimatumHint) {
    filters.ultimatumHint = {
      value: item.trials.ultimatumHint,
      disabled: true,
    };
  }

  return filters;
}

const ASCENDANCY_POINTS: Record<string, Record<number, number>> = {
  "Inscribed Ultimatum": {
    1: 1,
    2: 60,
    3: 75,
  },
  "Djinn Barya": {
    1: 1,
    2: 45,
    3: 60,
    4: 75,
  },
};

export function areaLevelByAscendancyPoints(refName: string, points: number) {
  if (!(refName in ASCENDANCY_POINTS)) {
    return 0;
  }

  const maxPossiblePoints = refName === "Inscribed Ultimatum" ? 3 : 4;
  // Input outside the possible range
  if (points < 1) {
    return 1;
  } else if (points > maxPossiblePoints) {
    return 75;
  }

  const trialLevels = ASCENDANCY_POINTS[refName];

  return trialLevels[points];
}

export function ascendancyPointsByAreaLevel(
  refName: string,
  areaLevel: number,
) {
  if (!(refName in ASCENDANCY_POINTS)) {
    return 0;
  }

  const maxPossiblePoints = refName === "Inscribed Ultimatum" ? 3 : 4;

  // Input outside the possible range
  if (areaLevel < 1) {
    return 1;
  } else if (areaLevel > 80) {
    return maxPossiblePoints;
  }

  for (let i = maxPossiblePoints; i >= 1; i--) {
    if (areaLevel >= ASCENDANCY_POINTS[refName][i]) {
      return i;
    }
  }

  return 1;
}

function t(opts: CreateOptions, info: BaseType) {
  return opts.useEn ? info.refName : info.name;
}
