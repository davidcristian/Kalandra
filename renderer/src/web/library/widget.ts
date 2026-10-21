import { err, ok, Result } from "neverthrow";
import { Anchor, Widget } from "@/web/overlay/widgets";
import { ParsedItem } from "@/parser";
import { ModifierType, modsEqual } from "@/parser/modifiers";
import { ParsedModifier } from "@/parser/advanced-mod-desc";

export interface LibraryWidget extends Widget {
  anchor: Anchor;
  logItemKey: string | null;
  libraryOutputPath: string | null;
  selectedProfile: string;
  profiles: Record<string, ColumnOpts>;
}

export interface ShortMod {
  name?: string;
  tier?: number;
  roll: Array<number | -999>;
  ref: string[];
  type: string;
  generation?: string;
}
export interface ColumnOpts {
  refName: true;
  itemLevel: true;
  rarity: true;
  sockets: true;
  mods: true;
  addedMods: boolean;
  removedMods: boolean;
  keep: {
    explicit: boolean;
    implicit: boolean;
    enchant: boolean;
    augment: boolean;
  };
  modOpts: {
    name: true;
    tier: boolean;
    roll: boolean;
    ref: boolean;
    type: boolean;
    generation: boolean;
  };
}

export interface CsvColumns {
  [key: string]: ColumnOpts;
}

type ColumnKey =
  | "refName"
  | "itemLevel"
  | "rarity"
  | "sockets"
  | "mods"
  | "addedMods"
  | "removedMods";

const COLUMNS: ReadonlyArray<{ key: ColumnKey; header: string }> = [
  { key: "refName", header: "base" },
  { key: "itemLevel", header: "ilvl" },
  { key: "rarity", header: "rarity" },
  { key: "sockets", header: "sockets" },
  { key: "mods", header: "mods" },
  { key: "addedMods", header: "addedMods" },
  { key: "removedMods", header: "removedMods" },
];

/** Returns the columns a profile writes, in file order. */
function profileColumns(columnOpts: ColumnOpts) {
  return COLUMNS.filter((column) => columnOpts[column.key]);
}

function modFilter(mod: ParsedModifier, keep: ColumnOpts["keep"]) {
  if (
    keep.explicit &&
    (mod.info.generation === "suffix" ||
      mod.info.generation === "prefix" ||
      mod.info.generation === "mutated" ||
      // Should be redundant with prefix/suffix
      mod.info.type === ModifierType.Desecrated ||
      mod.info.type === ModifierType.Fractured ||
      mod.info.type === ModifierType.Crafted)
  ) {
    return true;
  }
  if (keep.implicit && mod.info.type === ModifierType.Implicit) {
    return true;
  }
  if (keep.enchant && mod.info.type === ModifierType.Enchant) {
    return true;
  }
  if (keep.augment && mod.info.type === ModifierType.Augment) {
    return true;
  }
  return false;
}

export function buildCsvString(
  item: ParsedItem,
  sessionType: string,
  addedMods: ParsedModifier[],
  removedMods: ParsedModifier[],
  opts: { columnOpts: ColumnOpts },
): Result<string, string> {
  const { columnOpts } = opts;
  if (sessionType === "chaos") {
    const modsCell = (mods: ParsedModifier[]) =>
      arrayToCsvString(
        mods
          .filter((mod) => modFilter(mod, columnOpts.keep))
          .map((m) => modToShortMod(m, columnOpts)),
      );
    const cells: Record<ColumnKey, string | number | undefined> = {
      refName: item.info.refName,
      itemLevel: item.itemLevel,
      rarity: item.rarity,
      sockets: item.augmentSockets?.current ?? 0,
      mods: modsCell(item.newMods),
      addedMods: modsCell(addedMods),
      removedMods: modsCell(removedMods),
    };

    return ok(
      profileColumns(columnOpts)
        .map((column) => cells[column.key])
        .join(","),
    );
  }

  return err("sessionType not supported");
}

export function getHeader(sessionType: string, columnOpts: ColumnOpts) {
  switch (sessionType) {
    case "chaos":
      return ok(
        profileColumns(columnOpts)
          .map((column) => column.header)
          .join(","),
      );

    default:
      return err("sessionType not supported");
  }
}

export function diffItem(curr: ParsedItem, prev: ParsedItem | null) {
  if (!prev) {
    return {
      added: curr.newMods.filter(
        (mod) =>
          mod.info.generation === "suffix" || mod.info.generation === "prefix",
      ),
      removed: [],
    };
  }

  const filteredModsA = curr.newMods.filter(
    (mod) =>
      mod.info.generation === "suffix" || mod.info.generation === "prefix",
  );
  const filteredModsB = prev.newMods.filter(
    (mod) =>
      mod.info.generation === "suffix" || mod.info.generation === "prefix",
  );

  const added = filteredModsA.filter(
    (mod) => !filteredModsB.some((modB) => modsEqual(mod, modB)),
  );
  const removed = filteredModsB.filter(
    (mod) => !filteredModsA.some((modA) => modsEqual(mod, modA)),
  );

  return { added, removed };
}

function modToShortMod(mod: ParsedModifier, opts: ColumnOpts): ShortMod {
  if (!opts) throw new Error("ColumnOpts is null");

  return {
    name: mod.info.name,
    tier: mod.info.tier,
    roll: mod.stats.map((s) => s.roll?.value ?? -999),
    ref: mod.stats.map((s) => s.stat.ref),
    type: mod.info.type,
    generation: mod.info.generation,
  };
}

function arrayToCsvString(arr: ShortMod[]) {
  const json = JSON.stringify(arr);
  return `"${json.replaceAll("'", "\\'").replaceAll('"', "'")}"`;
}

// eslint-disable-next-line @typescript-eslint/naming-convention
export const __testExports = {
  modFilter,
};
