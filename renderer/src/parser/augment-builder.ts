import { AugmentLineData, BaseType, ITEM_BY_REF } from "@/assets/data";
import { ARMOUR, ItemCategory, MARTIAL_WEAPON } from "./meta";
import { parseStatsFromMod, replaceHashWithValues } from "./Parser";
import { EditorItem, ParsedItem } from "./ParsedItem";
import {
  INTERNAL_AUGMENT_TYPES,
  ModifierType,
  sumStatsByModType,
} from "./modifiers";
import { recalculateItemProperties } from "./calc-base";
import { parserSettings } from "./settings";

export function selectAugmentEffectByItemCategory(
  category: ItemCategory,
  rune: BaseType["augment"],
): AugmentLineData[] | undefined {
  if (!rune) return;

  return rune.filter((rune) => rune.categories.includes(category));
}

export function buildEditorItems(
  augments: BaseType[],
  category: ItemCategory,
  existing?: true,
): EditorItem[] {
  return augments
    .map((augment) => {
      const effect = selectAugmentEffectByItemCategory(
        category,
        augment.augment,
      );
      if (!effect || !effect.length) return undefined;
      return buildEditorItem(augment, effect, existing);
    })
    .filter((augment) => augment !== undefined);
}

/** Writes each effect line with its values, which the lines take in order from their own values arrays. */
function effectText(lines: AugmentLineData[]): string {
  let next = 0;
  return lines
    .map((line, index) => {
      const values = (line.string.match(/#/g) ?? []).map(() => {
        const position = ownPosition(lines, index, next);
        next = position + 1;
        return line.values[position] ?? 0;
      });
      return replaceHashWithValues(line.string, values);
    })
    .join("\n");
}

// The data scales a value, such as 180 Life per minute to 3.0 per second, only in the values array of the
// line that shows it, so a position where only this line's value differs belongs to this line.
function ownPosition(
  lines: AugmentLineData[],
  index: number,
  start: number,
): number {
  const own = lines[index].values;
  for (let position = start; position < own.length; position++) {
    if (
      lines.every(
        (other, i) => i === index || other.values[position] !== own[position],
      )
    ) {
      return position;
    }
  }
  return start;
}

function buildEditorItem(
  augment: BaseType,
  stats: AugmentLineData[],
  existing?: true,
): EditorItem {
  return {
    existing,
    name: augment.name,
    refName: augment.refName,
    icon: augment.icon,
    displayString: effectText(stats),
    stats,
    baseItem: augment,
  };
}

export function getSavedAugments(item: ParsedItem): Array<BaseType | null> {
  if (!item.augmentSockets) return [];
  const lookup = parserSettings().savedAugments;

  let refNames: Array<string | null> = [];
  if (item.category && lookup[item.category]?.length) {
    refNames = lookup[item.category]!;
  } else if (
    item.category &&
    MARTIAL_WEAPON.has(item.category) &&
    lookup.martialWeapon?.length
  ) {
    refNames = lookup.martialWeapon;
  } else if (
    (item.category === ItemCategory.Wand ||
      item.category === ItemCategory.Staff) &&
    lookup.casterWeapon?.length
  ) {
    refNames = lookup.casterWeapon;
  } else if (
    item.category &&
    ARMOUR.has(item.category) &&
    lookup.armour?.length
  ) {
    refNames = lookup.armour;
  } else if (lookup.all?.length) {
    refNames = lookup.all;
  }

  const bases = refNames.map((refName) => {
    if (!refName) return null;
    return ITEM_BY_REF("ITEM", refName)?.at(0) ?? null;
  });

  return bases;
}

export function useAugment(
  item: ParsedItem,
  augment: EditorItem,
  index: number,
) {
  if (!item.augmentSockets || item.augmentSockets.augments.length < index) {
    throw new Error("Augment index out of bounds");
  }

  // deep copy
  const oldItem = JSON.parse(JSON.stringify(item)) as ParsedItem;

  // remove old augment stats from item
  item.newMods = item.newMods.filter(
    (mod) => !INTERNAL_AUGMENT_TYPES.has(mod.info.type),
  );
  item.statsByType = item.statsByType.filter(
    (stat) => !INTERNAL_AUGMENT_TYPES.has(stat.type),
  );

  // add augment
  item.augmentSockets!.augments[index] = augment;
  // add augment stat to item
  for (const thisAugment of item.augmentSockets!.augments) {
    if (!thisAugment) continue;
    const modInfo = {
      // need to keep pre-existing ones marked as non-added
      type: thisAugment.existing
        ? ModifierType.Augment
        : ModifierType.AddedAugment,
      tags: [],
    };
    parseStatsFromMod(
      thisAugment.displayString.split("\n"),
      item,
      {
        info: modInfo,
        stats: [],
      },
      thisAugment.existing ? undefined : thisAugment.baseItem,
    );
  }
  item.statsByType = sumStatsByModType(item.newMods);

  recalculateItemProperties(item, oldItem);
}
