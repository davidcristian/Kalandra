/** Turns a listing's trade site fetch result into the item text the game copies, and parses it as the price check does. */

import { err, ok, type Result } from "neverthrow";
import { CLIENT_STRINGS as _$, type TranslationDict } from "@/assets/data";
import { type ParsedItem, parseClipboard } from "@/parser";
import { AUGMENT_LINE, ENCHANT_LINE } from "@/parser/advanced-mod-desc";
import { parseAffixStrings } from "@/parser/Parser";
import { TradePropType } from "@/web/price-check/trade/pathofexile-trade";
import { explicitLines, implicitLines, statLines } from "./mod-text";
import { isRecord, text } from "./stash-listings";

type Json = Record<string, unknown>;
// A client string that is plain text, not a pattern or a list
type Label = {
  [Key in keyof TranslationDict]: TranslationDict[Key] extends string
    ? Key
    : never;
}[keyof TranslationDict];

/** The reason a listing cannot be read: a key of `app_i18n.json`, as the parser returns. */
export const UNREADABLE = "stash_prices.unreadable";

// The line start of each property the parser reads, by the site's property type; others keep the site's name
const PROPERTY_LABELS = new Map<number, Label>([
  [TradePropType.GemLevel, "GEM_LEVEL"],
  [TradePropType.Quality, "QUALITY"],
  [TradePropType.WeaponPhysicalDamage, "PHYSICAL_DAMAGE"],
  [TradePropType.WeaponElementalDamage, "ELEMENTAL_DAMAGE"],
  [TradePropType.WeaponCriticalChance, "CRIT_CHANCE"],
  [TradePropType.WeaponSpeed, "ATTACK_SPEED"],
  [TradePropType.WeaponReloadTime, "RELOAD_SPEED"],
  [TradePropType.ShieldBlock, "BLOCK_CHANCE"],
  [TradePropType.ArmourReduction, "ARMOUR"],
  [TradePropType.ArmourEvasion, "EVASION"],
  [TradePropType.ArmourEnergyShield, "ENERGY_SHIELD"],
  [TradePropType.Spirit, "BASE_SPIRIT"],
  [TradePropType.StackSize, "STACK_SIZE"],
  [TradePropType.AreaLevel, "AREA_LEVEL"],
  [TradePropType.MapPortals, "WAYSTONE_REVIVES"],
  [TradePropType.MapPackSizeBonus, "WAYSTONE_PACK_SIZE"],
  [TradePropType.MapMagicMonstersQuantityBonus, "WAYSTONE_MAGIC_MONSTERS"],
  [TradePropType.MapRareMonstersQuantityBonus, "WAYSTONE_RARE_MONSTERS"],
  [TradePropType.MapRarityBonus, "WAYSTONE_RARITY"],
  [TradePropType.MapMapItemDropChanceBonus, "WAYSTONE_DROP_CHANCE"],
]);

const RARITY_BY_NAME = new Map<string, Label>([
  ["Normal", "RARITY_NORMAL"],
  ["Magic", "RARITY_MAGIC"],
  ["Rare", "RARITY_RARE"],
  ["Unique", "RARITY_UNIQUE"],
]);
// The site's frame type of an item without a rarity
const RARITY_BY_FRAME = new Map<number, Label>([
  [4, "RARITY_GEM"],
  [5, "RARITY_CURRENCY"],
  [6, "RARITY_DIVCARD"],
  [7, "RARITY_QUEST"],
]);
const GEM_FRAME = 4;

// Fields whose lines the converter does not write; an item with one is not read rather than read without them
const UNWRITTEN_FIELDS = ["logbookMods", "mutatedMods"];

interface TradeLine {
  name: string;
  values: string[];
  displayMode: number;
  type?: number;
}

function list(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function tradeLines(value: unknown): TradeLine[] {
  return list(value).flatMap((line) => {
    if (!isRecord(line)) return [];
    return [
      {
        name: parseAffixStrings(text(line.name)),
        values: list(line.values).map((value) => text(list(value)[0])),
        displayMode:
          typeof line.displayMode === "number" ? line.displayMode : 0,
        type: typeof line.type === "number" ? line.type : undefined,
      },
    ];
  });
}

function propertyLine(line: TradeLine): string | undefined {
  const label =
    line.type === undefined ? undefined : PROPERTY_LABELS.get(line.type);
  const values = line.values.join(", ");
  switch (line.displayMode) {
    case 0:
      if (label) return `${_$[label]}${values}`;
      if (!line.name || !values) return line.name || values;
      return `${line.name}: ${values}`;
    case 3:
      return line.name.replace(
        /\{(\d+)\}/g,
        (_, idx: string) => line.values[Number(idx)] ?? "",
      );
    default:
      // A progress bar, such as a gem's experience, or a layout the copied text does not show
      return undefined;
  }
}

function rarityLabel(item: Json): Label | undefined {
  const byName = RARITY_BY_NAME.get(text(item.rarity));
  if (byName) return byName;
  return typeof item.frameType === "number"
    ? RARITY_BY_FRAME.get(item.frameType)
    : undefined;
}

function nameSection(item: Json, rarity: string, className: string): string[] {
  return [
    `${_$.ITEM_CLASS}${className}`,
    `${_$.RARITY}${rarity}`,
    text(item.name),
    text(item.typeLine),
  ].filter((line, idx) => idx < 2 || line);
}

function requirementsLine(item: Json): string | undefined {
  const parts = tradeLines(item.requirements).map((line) =>
    line.displayMode === 1
      ? `${line.values.join(", ")} ${line.name}`
      : `${line.name} ${line.values.join(", ")}`,
  );
  return parts.length ? `${_$.REQUIRES}${parts.join(", ")}` : undefined;
}

function socketsLine(item: Json, isGem: boolean): string | undefined {
  // A copied item writes each augment socket as S; a gem's sockets are its support gem sockets
  const sockets = isGem
    ? list(item.gemSockets).map(text)
    : list(item.sockets).map(() => "S");
  return sockets.length ? `${_$.SOCKETS}${sockets.join(" ")}` : undefined;
}

function stateLines(item: Json): string[][] {
  const sections: string[][] = [];
  if (item.identified === false) {
    const tier = Number(item.unidentifiedTier);
    const withTier = `${_$.ITEM_UNIDENTIFIED} (${_$.TIER} ${tier})`;
    sections.push([
      tier && _$.UNIDENTIFIED.test(withTier) ? withTier : _$.ITEM_UNIDENTIFIED,
    ]);
  }
  if (item.doubleCorrupted === true) sections.push([_$.DOUBLE_CORRUPTED]);
  else if (item.corrupted === true) sections.push([_$.CORRUPTED]);
  if (item.duplicated === true) sections.push([_$.MIRRORED]);
  if (item.sanctified === true) sections.push([_$.SANCTIFIED]);
  return sections;
}

function suffixed(value: unknown, suffix: string): string[] {
  return list(value).flatMap((line) =>
    statLines(isRecord(line) ? text(line.description) : text(line)).map(
      (stat) => `${stat}${suffix}`,
    ),
  );
}

/** Returns the item text of a fetch result's `item`, sections joined as the game copies them, or the reason it cannot. */
export function listingItemText(item: unknown): Result<string, string> {
  if (!isRecord(item) || !text(item.typeLine)) return err(UNREADABLE);
  const label = rarityLabel(item);
  const unwritten = UNWRITTEN_FIELDS.filter(
    (field) => list(item[field]).length,
  );
  if (!label || unwritten.length) {
    console.warn(
      "[stash-prices] Cannot write the item text of:",
      text(item.typeLine),
      unwritten,
    );
    return err(UNREADABLE);
  }
  const isGem = item.frameType === GEM_FRAME;
  const properties = tradeLines(item.properties);
  // The first property without a value names the item class, or a gem's tags
  const classLine = properties.find((line) => !line.values.length)?.name ?? "";
  const propertyLines = properties
    .filter(
      (line) =>
        (isGem ? true : line.values.length) &&
        line.type !== TradePropType.MapTier,
    )
    .map(propertyLine)
    .filter((line): line is string => line !== undefined);
  const ilvl = Number(item.ilvl);
  const skills = tradeLines(item.grantedSkills).map(
    (line) => `${_$.GRANTS_SKILL}${line.values.join(", ")}`,
  );

  const sections = [
    nameSection(item, _$[label], isGem ? "" : classLine),
    propertyLines,
    [requirementsLine(item)],
    [socketsLine(item, isGem)],
    [ilvl > 0 ? `${_$.ITEM_LEVEL}${ilvl}` : undefined],
    suffixed(item.enchantMods, ENCHANT_LINE),
    suffixed(item.runeMods, AUGMENT_LINE),
    implicitLines(item),
    skills,
    // A copied item without a rarity, such as a rune, writes its modifiers without headers
    explicitLines(
      item,
      RARITY_BY_NAME.has(text(item.rarity)) ? _$[label] : null,
    ),
    ...stateLines(item),
  ]
    .map((section) => section.filter((line): line is string => !!line))
    .filter((section) => section.length);
  return ok(sections.map((section) => section.join("\n")).join("\n--------\n"));
}

/** Returns the parsed item of a listing's fetch result, or the reason it cannot be read; it never throws. */
export function listingItem(raw: {
  item: unknown;
}): Result<ParsedItem, string> {
  try {
    return listingItemText(raw.item).andThen((itemText) =>
      parseClipboard(itemText),
    );
  } catch (error) {
    console.warn("[stash-prices] Cannot read the listing's item:", error);
    return err(UNREADABLE);
  }
}
