import fnv1a from "@sindresorhus/fnv1a";
import { lineStartsByHash } from "./hash-index";
import type { Stat, StatMatcher } from "./interfaces";

export interface StatMatch {
  stat: Stat;
  matcher: StatMatcher;
}

/** Returns every stat with a matcher whose text or advanced text is `text`, in the order of `stats.ndjson`. */
export function statsByMatcherText(
  ndjson: string,
  index: Uint32Array,
  text: string,
): StatMatch[] {
  const hash = Number(fnv1a(text, { size: 32 }));
  const out: StatMatch[] = [];
  let previous = -1;
  for (const start of lineStartsByHash(index, hash, 2)) {
    if (start === previous) continue;
    previous = start;
    const end = ndjson.indexOf("\n", start);
    const stat = JSON.parse(ndjson.slice(start, end)) as Stat;
    const matcher = stat.matchers.find(
      (m) => m.string === text || m.advanced === text,
    );
    if (matcher) out.push({ stat, matcher });
  }
  return out;
}
