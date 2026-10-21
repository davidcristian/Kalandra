import type { Stat, StatMatcher } from "@/assets/data/interfaces";

/** Names a modifier in every language: the stat's ref, and the sign and value of the wording. */
export interface MapStatKey {
  ref: string;
  negate?: true;
  value?: number;
}

/** A modifier that a mark can belong to: its key and each of its wordings in the loaded game data. */
export interface MarkTarget {
  key?: MapStatKey;
  texts: string[];
}

type SavedMark = Partial<MapStatKey> & { matcher?: string };

export function keyOf(
  ref: string,
  matcher: Pick<StatMatcher, "negate" | "value">,
): MapStatKey {
  const key: MapStatKey = { ref };
  if (matcher.negate) key.negate = true;
  if (matcher.value != null) key.value = matcher.value;
  return key;
}

export function sameKey(a: Partial<MapStatKey>, b: MapStatKey): boolean {
  return (
    a.ref === b.ref &&
    Boolean(a.negate) === Boolean(b.negate) &&
    (a.value ?? null) === (b.value ?? null)
  );
}

/** Returns the target of a stat's wording, with every wording of the stat that has the same key. */
export function markTarget(
  stat: Stat,
  matcher: StatMatcher,
): Required<MarkTarget> {
  const key = keyOf(stat.ref, matcher);
  const texts = stat.matchers
    .filter((m) => sameKey(keyOf(stat.ref, m), key))
    .flatMap((m) => (m.advanced ? [m.string, m.advanced] : [m.string]));
  return { key, texts };
}

/** Returns one target for each key of a stat, with the first wording of that key. */
export function statTargets(
  stat: Stat,
): Array<{ text: string; target: Required<MarkTarget> }> {
  const out: Array<{ text: string; target: Required<MarkTarget> }> = [];
  for (const matcher of stat.matchers) {
    const target = markTarget(stat, matcher);
    if (out.some((row) => sameKey(row.target.key, target.key))) continue;
    out.push({ text: matcher.string, target });
  }
  return out;
}

export function keyInStat(stat: Stat, key: MapStatKey): boolean {
  return stat.matchers.some((m) => sameKey(keyOf(stat.ref, m), key));
}

/** Returns the first mark with the target's key, or saved as one of its wordings. */
export function findMark<T extends SavedMark>(
  marks: T[],
  target: MarkTarget,
): T | undefined {
  return marks.find((mark) =>
    mark.ref != null
      ? target.key != null && sameKey(mark, target.key)
      : target.texts.includes(mark.matcher ?? ""),
  );
}

export function newMark(
  key: MapStatKey,
  decision: string,
): MapStatKey & { decision: string } {
  return { ...key, decision };
}
