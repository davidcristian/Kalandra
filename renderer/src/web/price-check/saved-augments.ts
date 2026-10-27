type SavedWidget = Record<string, unknown>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Moves the augments saved under `maritalWeapon` to `martialWeapon`, the key the price check reads, on each price check widget. */
export function moveMartialWeaponAugments(config: {
  widgets: SavedWidget[];
}): void {
  for (const widget of config.widgets) {
    const saved = widget.savedAugments;
    if (widget.wmType !== "price-check" || !isRecord(saved)) continue;
    if (!("maritalWeapon" in saved)) continue;
    // The price check already applies a martialWeapon set, so that set stays
    saved.martialWeapon ??= saved.maritalWeapon;
    delete saved.maritalWeapon;
  }
}
