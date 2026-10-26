import { CLIENT_STRINGS as _$ } from "@/assets/data";
import type { TranslationDict } from "@/assets/data/interfaces";
import { cachePerDataLoad } from "@/assets/data/loads";

/** A search whose text comes from the game data, so it follows the game language. */
export type StashSearchPreset =
  | "currency"
  | "normal-rarity"
  | "trial-count"
  | "waystone-tier"
  | "martial-weapon";

export interface StashSearchEntry {
  id: number;
  name: string;
  text: string;
  hotkey: string | null;
  /** Set until the user edits the text; the entry then searches the preset's game text. */
  preset?: StashSearchPreset;
}

const PRESET_TEXT = new Map<
  StashSearchPreset,
  (strings: TranslationDict) => string
>([
  ["currency", (strings) => strings.RARITY_CURRENCY],
  ["normal-rarity", (strings) => strings.RARITY + strings.RARITY_NORMAL],
  ["trial-count", (strings) => strings.TRIAL_COUNT],
  ["waystone-tier", (strings) => strings.WAYSTONE_TIER],
  ["martial-weapon", (strings) => strings.MARTIAL_WEAPON],
]);

/** The text of each preset in the default widgets before version 39, which is English. */
const ENGLISH_DEFAULTS = new Map<string, StashSearchPreset>([
  ["Currency", "currency"],
  ['"Rarity: Normal"', "normal-rarity"],
  ["Trials:", "trial-count"],
]);

/** The text of each preset that version 40 added to the default widgets, as earlier versions saved it. */
export const ENGLISH_DEFAULTS_40 = new Map<string, StashSearchPreset>([
  ['"Waystone Tier"', "waystone-tier"],
  ['"Martial Weapon"', "martial-weapon"],
]);

/** Returns the text as one search keyword, in quotes when it has a space, as the game's search tip says. */
export function searchKeyword(text: string): string {
  const keyword = text.trim();
  return /\s/.test(keyword) ? `"${keyword}"` : keyword;
}

const presetText = cachePerDataLoad((preset: StashSearchPreset) => {
  const build = PRESET_TEXT.get(preset);
  return build ? searchKeyword(build(_$)) : undefined;
});

/** Returns what an entry searches: its preset's text in the loaded game language, else the text it holds. */
export function entrySearchText(entry: StashSearchEntry): string {
  return (entry.preset && presetText(entry.preset)) || entry.text;
}

/** Sets the text the user wrote, which ends the entry's preset. */
export function setEntryText(entry: StashSearchEntry, text: string): void {
  entry.text = text;
  delete entry.preset;
}

/** Names each entry that holds one of the English default texts by its preset. */
export function namePresetEntries(
  config: { widgets: Array<Record<string, unknown>> },
  englishDefaults: ReadonlyMap<string, StashSearchPreset> = ENGLISH_DEFAULTS,
): void {
  for (const widget of config.widgets) {
    if (widget.wmType !== "stash-search" || !Array.isArray(widget.entries)) {
      continue;
    }
    for (const entry of widget.entries as Array<Partial<StashSearchEntry>>) {
      const preset =
        typeof entry.text === "string"
          ? englishDefaults.get(entry.text)
          : undefined;
      if (preset && entry.preset === undefined) entry.preset = preset;
    }
  }
}
