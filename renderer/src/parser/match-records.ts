import {
  BaseType,
  CLIENT_STRINGS as _$,
  ITEM_BY_TRANSLATED,
} from "@/assets/data";

type Defence = keyof NonNullable<BaseType["armour"]>;

const DEFENCE_LABELS: ReadonlyArray<
  [Defence, "ARMOUR" | "EVASION" | "ENERGY_SHIELD"]
> = [
  ["ar", "ARMOUR"],
  ["ev", "EVASION"],
  ["es", "ENERGY_SHIELD"],
];

/**
 * Keeps the item data records that match the copied item: a unique by its base type, and base types
 * that share a translated name by the defences the item shows. Returns every record when none match.
 */
export function recordsMatchingItem(
  records: BaseType[],
  item: { baseType?: string; rawText: string },
): BaseType[] {
  const matching = records[0].unique
    ? uniquesOnBase(records, item.baseType)
    : recordsWithDefences(records, item.rawText);
  return matching.length ? matching : records;
}

function uniquesOnBase(records: BaseType[], baseType: string | undefined) {
  if (!baseType) return [];
  const exact = records.filter((record) => record.unique?.base === baseType);
  if (exact.length) return exact;
  const bases = new Set(
    ITEM_BY_TRANSLATED("ITEM", baseType)?.map((base) => base.refName),
  );
  return records.filter((record) => bases.has(record.unique?.base ?? ""));
}

function recordsWithDefences(records: BaseType[], rawText: string) {
  if (records.every((record) => record.refName === records[0].refName)) {
    return records;
  }
  const lines = rawText.split(/\r?\n/);
  const shown = new Set(
    DEFENCE_LABELS.filter(([, label]) =>
      lines.some((line) => line.startsWith(_$[label])),
    ).map(([defence]) => defence),
  );
  return records.filter((record) =>
    DEFENCE_LABELS.every(
      ([defence]) =>
        (record.armour?.[defence] !== undefined) === shown.has(defence),
    ),
  );
}
