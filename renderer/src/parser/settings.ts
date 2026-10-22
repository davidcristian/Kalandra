/** Saved augment ref names, one per socket, by item category or by a group such as `armour` or `all`. */
export type SavedAugments = Record<string, Array<string | null>>;

/** The user settings the parser reads. */
export interface ParserSettings {
  readonly language: string;
  readonly savedAugments: SavedAugments;
}

let current: ParserSettings | undefined;

/** Sets where the parser reads the user settings; the app calls it once at start. */
export function setParserSettings(settings: ParserSettings) {
  current = settings;
}

export function parserSettings(): ParserSettings {
  if (!current) {
    throw new Error("The parser settings are read before the app sets them");
  }
  return current;
}
