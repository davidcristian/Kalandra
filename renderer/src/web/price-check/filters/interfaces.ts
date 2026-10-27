import { BaseType } from "@/assets/data";
import type { ItemCategory } from "@/parser";
import type { ModifierType, StatCalculated } from "@/parser/modifiers";

export interface FilterPreset {
  id: string;
  filters: ItemFilters;
  stats: StatFilter[];
}

interface SearchFilter {
  name?: string;
  nameTrade?: string;
  baseType?: string;
  baseTypeTrade?: string;
  category?: ItemCategory;
}

export interface ItemFilters {
  searchExact: SearchFilter;
  searchRelaxed?: SearchFilter & { disabled: boolean };
  discriminator?: {
    value?: string;
    trade: string;
  };
  rarity?: {
    value: "normal" | "magic" | "nonunique";
  };
  socketNumber?: FilterNumeric;
  augmentSockets?: FilterNumeric;
  corrupted?: {
    value: boolean;
    exact?: boolean;
  };
  fractured?: {
    value: boolean;
  };
  mirrored?: {
    disabled: boolean;
  };
  sanctified?: {
    disabled: boolean;
  };
  foil?: {
    disabled: boolean;
  };
  quality?: FilterNumeric;
  gemLevel?: FilterNumeric;
  mapTier?: FilterNumeric;
  itemLevel?: FilterNumeric;
  stackSize?: FilterNumeric;
  unidentified?: {
    value: true;
    disabled: boolean;
  };
  unidentifiedTier?: {
    value: number;
    disabled: boolean;
  };
  veiled?: {
    statRefs: string[];
    veiledCount: number;
    disabled: boolean;
  };
  awardedAscendancyPoints?: FilterNumeric;
  ultimatumHint?: {
    value: "Victorious" | "Cowardly" | "Deadly";
    disabled: boolean;
  };
  areaLevel?: FilterNumeric;
  trade: {
    offline: boolean;
    onlineInLeague: boolean;
    listingType: "any" | "online" | "securable" | "available" | "onlineleague";
    listed: string | undefined;
    currency: string | undefined;
    league: string;
    collapseListings: "api" | "app";
  };
  requires?: {
    level?: FilterNumeric;
    str?: FilterNumeric;
    dex?: FilterNumeric;
    int?: FilterNumeric;
  };
}

export interface FilterNumeric {
  value: number;
  max?: number | undefined;
  disabled: boolean;
}

export interface StatFilterRoll {
  value: number;
  min: number | "" | undefined; // The filter UI changes it
  max: number | "" | undefined; // The filter UI changes it
  default: { min: number; max: number };
  bounds?: { min: number; max: number };
  tradeInvert?: boolean;
  dp: boolean;
  isNegated: boolean;
}

export interface StatFilter {
  tradeId: string[];
  statRef: string;
  text: string;
  tag: FilterTag;
  oils?: string[];
  sources: StatCalculated["sources"];
  roll?: StatFilterRoll;
  option?: {
    value: number; // The filter UI changes it
  };
  hidden?: string;
  disabled: boolean; // The filter UI changes it
  additionalInfo?: {
    elementalInfo?: {
      [key: string]: StatFilterRoll;
    };
    emptyModifierInfo?: Record<ItemHasEmptyModifier, number>;
  };
  editorAdded?: BaseType;
}

export const _INTERNAL_TRADE_IDS = [
  "item.base_percentile",
  "item.armour",
  "item.evasion_rating",
  "item.energy_shield",
  "item.block",
  "item.total_dps",
  "item.physical_dps",
  "item.elemental_dps",
  "item.crit",
  "item.aps",
  "item.has_empty_modifier",
  "item.spirit",
  // FilterModifierItemIsElemental.vue reads these four as entries 12 to 15, so the list above
  // keeps exactly 12 ids and these four keep their order
  "item.has_elemental_affix",
  "item.has_elemental_fire_affix",
  "item.has_elemental_cold_affix",
  "item.has_elemental_lightning_affix",
  "item.reload_time",
  "item.rarity_magic",
  "item.map_revives",
  "item.map_pack_size",
  "item.map_drop_chance",
  "item.map_item_rarity",
  "item.map_magic_monsters",
  "item.map_rare_monsters",
  "item.map_gold",
  "item.runic_ward",
  "item.duplicates",
] as const;

export type InternalTradeId = (typeof _INTERNAL_TRADE_IDS)[number];
export const INTERNAL_TRADE_IDS = _INTERNAL_TRADE_IDS as readonly string[];

export enum ItemHasEmptyModifier {
  Any = 0,
  Prefix = 1,
  Suffix = 2,
}
export enum ItemIsElementalModifier {
  Any = 0,
  Fire = 1,
  Cold = 2,
  Lightning = 3,
}

export enum FilterTag {
  Pseudo = "pseudo",
  Explicit = "explicit",
  Implicit = "implicit",
  Crafted = "crafted",
  Enchant = "enchant",
  Scourge = "scourge",
  Fractured = "fractured",
  Corrupted = "corrupted",
  Synthesised = "synthesised",
  Eldritch = "eldritch",
  Variant = "variant",
  Property = "property",
  Shaper = "explicit-shaper",
  Elder = "explicit-elder",
  Crusader = "explicit-crusader",
  Hunter = "explicit-hunter",
  Redeemer = "explicit-redeemer",
  Warlord = "explicit-warlord",
  Delve = "explicit-delve",
  Unveiled = "explicit-veiled",
  Incursion = "explicit-incursion",
  Augment = "rune",
  AddedAugment = "added-rune",
  Desecrated = "desecrated",
  Skill = "skill",
  Mutated = "mutated",
  Veiled = "veiled",
  Sanctum = "sanctum",
}

export const FILTER_TAG_BY_MODIFIER_TYPE: Record<ModifierType, FilterTag> = {
  "pseudo": FilterTag.Pseudo,
  "explicit": FilterTag.Explicit,
  "implicit": FilterTag.Implicit,
  "crafted": FilterTag.Crafted,
  "enchant": FilterTag.Enchant,
  "scourge": FilterTag.Scourge,
  "veiled": FilterTag.Veiled,
  "fractured": FilterTag.Fractured,
  "rune": FilterTag.Augment,
  "added-rune": FilterTag.AddedAugment,
  "sanctum": FilterTag.Sanctum,
  "desecrated": FilterTag.Desecrated,
  "skill": FilterTag.Skill,
};
