import fnv1a from "@sindresorhus/fnv1a";
import { lineStartsByHash } from "./hash-index";
import type { Stat } from "./interfaces";

/** Returns the first stat in `stats.ndjson` whose ref is `ref`, or undefined when no stat has it. */
export function statByRef(
  ndjson: string,
  index: Uint32Array,
  ref: string,
): Stat | undefined {
  const hash = Number(fnv1a(ref, { size: 32 }));
  for (const start of lineStartsByHash(index, hash, 2)) {
    const end = ndjson.indexOf("\n", start);
    const stat = JSON.parse(ndjson.slice(start, end)) as Stat;
    if (stat.ref === ref) return stat;
  }
  return undefined;
}
