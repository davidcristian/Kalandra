const STRIP_PERCENT_MODS = new Set([
  "item.crit",
  "item.map_pack_size",
  "item.map_magic_monsters",
  "item.map_rare_monsters",
  "item.map_drop_chance",
  "item.map_item_rarity",
  "item.map_gold",
]);

export interface TooltipI18n {
  t: (key: string) => string;
  te: (key: string, locale: string) => boolean;
}

/** Returns the text of a listing tooltip line: a UI text key translated, any other text unchanged. */
export function tooltipLineText(text: string, { t, te }: TooltipI18n): string {
  // The message formatter reads braces, pipes and @ in trade site text as its own syntax
  if (!te(text, "en")) return text;

  const translated = t(text);
  if (STRIP_PERCENT_MODS.has(text)) {
    return translated.slice(0, translated.lastIndexOf(" ")) + " ";
  }
  return translated;
}
