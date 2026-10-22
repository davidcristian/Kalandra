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

export interface Suggestion {
  type: "exalted";
  text?: string;
  text2?: string;
  confidenceLevel?: "Low" | "Medium" | "High";
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
  itemEditorSelection?: { disabled: boolean; editing: boolean; value: string };
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

export interface FilterDropdown {
  value: string;
  disabled: boolean;
  options: Array<{ label: string; value: string }>;
}

export interface StatFilterRoll {
  value: number;
  min: number | "" | undefined; // NOTE: mutable in UI
  max: number | "" | undefined; // NOTE: mutable in UI
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
    value: number; // NOTE: mutable in UI
  };
  hidden?: string;
  disabled: boolean; // NOTE: mutable in UI
  additionalInfo?: {
    elementalInfo?: {
      [key: string]: StatFilterRoll;
    };
    emptyModifierInfo?: Record<ItemHasEmptyModifier, number>;
  };
  editorAdded?: BaseType;
}

export const _INTERNAL_TRADE_IDS = [
  // #region DO NOT ADD OR REMOVE
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
  // #endregion DO NOT ADD OR REMOVE
  // KEEP AS 12 number, maybe fix this to be better later
  "item.has_elemental_affix",
  "item.has_elemental_fire_affix",
  "item.has_elemental_cold_affix",
  "item.has_elemental_lightning_affix",
  // KEEP above in order and as 12-15
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
  Necropolis = "necropolis",
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
  "necropolis": FilterTag.Necropolis,
  "veiled": FilterTag.Veiled,
  "fractured": FilterTag.Fractured,
  "rune": FilterTag.Augment,
  "added-rune": FilterTag.AddedAugment,
  "sanctum": FilterTag.Sanctum,
  "desecrated": FilterTag.Desecrated,
  "skill": FilterTag.Skill,
};
