/** The trade site's item and stat lists, which the data loader reads for the items and stats the game data lacks. */
export interface TradeLists {
  /** Downloads the lists now and returns the error message of a failed download, or null. */
  load: () => Promise<string | null>;
  /** Records a use of the lists, since the timer downloads them again only after a recent use. */
  expressInterest: () => void;
  /** The English names and base types of the items. */
  readonly items: ReadonlySet<string>;
  /** The trade ids of each English stat text, by modifier type such as `explicit`. */
  readonly stats: ReadonlyMap<
    string,
    { readonly [type: string]: readonly string[] }
  >;
  /** Every stat trade id. */
  readonly statIds: ReadonlySet<string>;
}

let current: TradeLists | undefined;

/** Sets where the data loader reads the trade lists; the app calls it once at start. */
export function setTradeLists(lists: TradeLists) {
  current = lists;
}

export function tradeLists(): TradeLists {
  if (!current) {
    throw new Error("The trade lists are read before the app sets them");
  }
  return current;
}
