/** Writes the modifiers of a trade site fetch result as the game writes them in a copied item with advanced descriptions. */

import { CLIENT_STRINGS as _$ } from "@/assets/data";
import { parseAffixStrings } from "@/parser/Parser";
import { isRecord, text } from "./stash-listings";

type ModKind = "implicit" | "explicit" | "fractured" | "desecrated" | "crafted";
type Json = Record<string, unknown>;

interface Range {
  min: number;
  max: number;
}

interface ModBlock {
  kind: ModKind;
  generation?: "prefix" | "suffix";
  name: string;
  tier?: number;
  lines: string[];
}

// The trade site's tier code of a modifier, such as P6 or S2; a unique's or an implicit's is empty
const TIER_CODE = /^([PS])(\d+)$/;
// A number as the parser reads a roll, with no digit or closing bracket before it
const ROLL = /(?<![\d)])[+-]?\d+(?:\.\d+)?/g;

function list(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function record(value: unknown): Json {
  return isRecord(value) ? value : {};
}

function newBlock(kind: ModKind, meta: unknown): ModBlock {
  const { name, tier } = record(meta);
  const code = TIER_CODE.exec(text(tier));
  return {
    kind,
    generation: code ? (code[1] === "P" ? "prefix" : "suffix") : undefined,
    name: text(name),
    tier: code ? Number(code[2]) || undefined : undefined,
    lines: [],
  };
}

/** Returns the roll ranges of a modifier, only those of `hash` when the site gives a hash for each. */
function ranges(meta: unknown, hash?: string): Range[] {
  return list(record(meta).magnitudes).flatMap((magnitude) => {
    const { min, max, hash: own } = record(magnitude);
    if (hash !== undefined && own !== undefined && own !== hash) return [];
    const range = { min: Number(min), max: Number(max) };
    return Number.isFinite(range.min) && Number.isFinite(range.max)
      ? [range]
      : [];
  });
}

/** Adds the ranges of several modifiers that the site wrote as one line, or returns none when they differ in count. */
function summed(perMod: Range[][]): Range[] {
  const [first = [], ...rest] = perMod;
  if (rest.some((other) => other.length !== first.length)) return [];
  return first.map((range, idx) => ({
    min: rest.reduce((sum, other) => sum + other[idx].min, range.min),
    max: rest.reduce((sum, other) => sum + other[idx].max, range.max),
  }));
}

function rounded(value: number): string {
  return String(Math.round(value * 100) / 100);
}

/** Writes each roll as `value(min-max)` after the first range left that contains it, as a copied item does. */
function withRanges(line: string, rollRanges: Range[]): string {
  let next = 0;
  return line.replace(ROLL, (roll) => {
    const value = Math.abs(Number(roll));
    for (let idx = next; idx < rollRanges.length; idx++) {
      const { min, max } = rollRanges[idx];
      const [low, high] = [Math.abs(min), Math.abs(max)].sort((a, b) => a - b);
      if (min * max >= 0 && value >= low && value <= high) {
        next = idx + 1;
        return low === high
          ? roll
          : `${roll}(${rounded(low)}-${rounded(high)})`;
      }
    }
    return roll;
  });
}

/** Returns the text lines of one modifier line of the site, without its markup. */
export function statLines(description: string, rollRanges: Range[] = []) {
  return parseAffixStrings(description)
    .split(/\r?\n/)
    .map((line) => withRanges(line.trim(), rollRanges))
    .filter(Boolean);
}

function flaggedKind(flags: unknown, kind: ModKind): ModKind {
  const set = record(flags);
  if (set.fractured === true) return "fractured";
  if (set.desecrated === true) return "desecrated";
  if (set.crafted === true) return "crafted";
  return kind;
}

/** Groups the lines of one kind by the modifier that makes them, as the game lists them. */
function kindBlocks(item: Json, kind: ModKind): ModBlock[] {
  const extended = record(item.extended);
  const mods = record(extended.mods);
  // A relic's explicit lines have their modifiers under `sanctum`
  const key = kind === "explicit" && !mods.explicit ? "sanctum" : kind;
  const metas = list(mods[key]);
  const hashes = list(record(extended.hashes)[key]);
  const lines = list(item[`${kind}Mods`]);
  // Lines written as text have their modifiers in `extended`; lines written as objects list their own
  const blocks = lines.some((line) => typeof line === "string")
    ? metas.map((meta) => newBlock(kind, meta))
    : [];
  const byMod = new Map<string, ModBlock>();

  lines.forEach((line, index) => {
    if (typeof line === "string") {
      const [hash, owners] = list(hashes[index]);
      const indexes = list(owners).filter(
        (owner): owner is number =>
          typeof owner === "number" && !!blocks[owner],
      );
      const perMod = indexes.map((owner) => ranges(metas[owner], text(hash)));
      const target = indexes.length ? blocks[indexes[0]] : newBlock(kind, null);
      if (!indexes.length) blocks.push(target);
      target.lines.push(...statLines(line, summed(perMod)));
      return;
    }
    const { description, flags, mods: lineMods } = record(line);
    const lineKind = flaggedKind(flags, kind);
    const owners = list(lineMods).map((meta) => {
      const { name, tier, level } = record(meta);
      const key = JSON.stringify([lineKind, name, tier, level]);
      let owner = byMod.get(key);
      if (!owner) {
        owner = newBlock(lineKind, meta);
        byMod.set(key, owner);
        blocks.push(owner);
      }
      return owner;
    });
    const target = owners[0] ?? newBlock(lineKind, null);
    if (!owners.length) blocks.push(target);
    // Several modifiers on one line have their ranges in no known order, so the line gets none
    const lineRanges = owners.length === 1 ? ranges(list(lineMods)[0]) : [];
    target.lines.push(...statLines(text(description), lineRanges));
  });
  return blocks;
}

function kindWord(kind: ModKind): string | undefined {
  switch (kind) {
    case "implicit":
      return _$.IMPLICIT_MODIFIER;
    case "fractured":
      return _$.FRACTURED_MODIFIER;
    case "desecrated":
      return _$.DESECRATED_MODIFIER;
    case "crafted":
      return _$.CRAFTED_MODIFIER;
    case "explicit":
      return undefined;
  }
}

/** Writes the modifier's header line, leaving out the tier and the name when the language's header pattern does not read them. */
function header(block: ModBlock, fallback: string): string {
  const generation =
    block.generation === "prefix"
      ? _$.PREFIX_MODIFIER
      : block.generation === "suffix"
        ? _$.SUFFIX_MODIFIER
        : undefined;
  const words =
    [kindWord(block.kind), generation].filter(Boolean).join(" ") || fallback;
  const named = `${words} "${block.name}"`;
  const tier = block.tier === undefined ? undefined : String(block.tier);
  const options = [
    ...(tier ? [{ line: `${named} (${_$.TIER}: ${tier})`, tier }] : []),
    { line: named, tier: undefined },
  ];
  // The parser reads a header only through this pattern, which differs between languages
  const fits = options.find((option) => {
    const groups = _$.MODIFIER_LINE.exec(option.line)?.groups;
    return (
      block.name && groups?.name === block.name && groups.tier === option.tier
    );
  });
  return `{ ${fits?.line ?? words} }`;
}

function veiledBlocks(item: Json): ModBlock[] {
  return list(item.veiledMods).map((veiled) => {
    // The site names an unrevealed modifier by its slot, such as Prefix05
    const prefix = text(veiled).startsWith("Prefix");
    return {
      kind: "explicit",
      generation: prefix ? "prefix" : "suffix",
      name: "",
      lines: [prefix ? _$.VEILED_PREFIX : _$.VEILED_SUFFIX],
    };
  });
}

function rank(block: ModBlock): number {
  if (block.generation === "prefix") return 0;
  return block.generation === "suffix" ? 1 : 2;
}

/** Returns the implicit section's lines, each modifier after its header. */
export function implicitLines(item: Json): string[] {
  return kindBlocks(item, "implicit")
    .filter((block) => block.lines.length)
    .flatMap((block) => [header(block, ""), ...block.lines]);
}

/**
 * Returns the explicit section's lines: prefixes, then suffixes, then the rest, each modifier after its header. A
 * modifier without a prefix or suffix gets the header `fallback`, and with `fallback` null no line gets a header.
 */
export function explicitLines(item: Json, fallback: string | null): string[] {
  const kinds: ModKind[] = ["explicit", "fractured", "desecrated", "crafted"];
  return [
    ...kinds.flatMap((kind) => kindBlocks(item, kind)),
    ...veiledBlocks(item),
  ]
    .toSorted((a, b) => rank(a) - rank(b))
    .flatMap((block) =>
      fallback === null
        ? block.lines
        : [header(block, fallback), ...block.lines],
    );
}
