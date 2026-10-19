import {
  CATALYST_TO_TAG,
  CATALYST_TYPES,
  CLIENT_STRINGS as _$,
} from "@/assets/data";
import { ItemCategory } from "./meta";
import type { ParsedItem } from "./ParsedItem";

/** Reads a jewellery quality line such as "Quality (Attribute Modifiers): +20% (augmented)". */
export function parseJewelleryQuality(
  section: string[],
  item: ParsedItem,
): boolean {
  const colon = _$.QUALITY.indexOf(":");
  const label = _$.QUALITY.slice(0, colon);
  const separator = _$.QUALITY.slice(colon);

  for (const line of section) {
    if (!line.startsWith(label)) continue;
    const valueStart = line.indexOf(separator, label.length);
    if (valueStart === -1) continue;
    const quality = parseInt(line.slice(valueStart + separator.length), 10);
    if (Number.isNaN(quality)) continue;

    item.quality = quality;
    item.qualityType = catalystType(
      line.slice(label.length, valueStart),
      item.category,
    );
    return true;
  }
  return false;
}

/** Returns the catalyst tag, such as "attribute_catalyst", whose modifier tag the text names. */
function catalystType(
  modifierText: string,
  category: ItemCategory | undefined,
): string | undefined {
  const catalysts =
    category === ItemCategory.Jewel
      ? CATALYST_TYPES.Refined
      : CATALYST_TYPES.Normal;
  for (const catalyst of catalysts) {
    const type = catalyst.tags[1];
    const tags = CATALYST_TO_TAG[type] ?? [];
    if (tags.some((tag) => modifierText.includes(tag))) {
      return type;
    }
  }
  return undefined;
}
