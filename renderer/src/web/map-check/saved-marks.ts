import type { StatMatch } from "@/assets/data/stats-by-matcher";
import type { MapCheckStat } from "./common";
import { findMark, markTarget, newMark } from "./mark-target";

/** The default marks before version 37, which are English stat text. */
const ENGLISH_DEFAULT_MARKS = [
  "#% maximum Player Resistances",
  "Monsters reflect #% of Physical Damage",
  "Monsters reflect #% of Elemental Damage",
  "Area contains two Unique Bosses",
];

/** Replaces each mark saved as text with a mark by key for each stat `lookup` finds, and keeps a mark it finds none for. */
export function convertTextMarks(
  marks: MapCheckStat[],
  lookup: (text: string) => StatMatch[],
): void {
  const out: MapCheckStat[] = [];
  let changed = false;
  for (const mark of marks) {
    const text = mark.ref == null ? mark.matcher : undefined;
    const found = typeof text === "string" && text ? lookup(text) : [];
    if (!found.length) {
      out.push(mark);
      continue;
    }
    changed = true;
    // findMark returns the first mark of a key, so a later mark with the same key is dropped
    for (const { stat, matcher } of found) {
      const target = markTarget(stat, matcher);
      if (!findMark(out, target)) out.push(newMark(target.key, mark.decision));
    }
  }
  if (changed) marks.splice(0, marks.length, ...out);
}

/** Names the default marks of earlier versions by ref, which is their English text, so they apply in every language. */
export function nameDefaultMarksByRef(config: {
  widgets: Array<Record<string, unknown>>;
}): void {
  const itemCheck = config.widgets.find((w) => w.wmType === "item-check");
  const maps = itemCheck?.maps as { selectedStats?: unknown } | undefined;
  if (!Array.isArray(maps?.selectedStats)) return;

  const marks = maps.selectedStats as MapCheckStat[];
  marks.forEach((mark, i) => {
    const text = mark.ref == null ? mark.matcher : undefined;
    if (text != null && ENGLISH_DEFAULT_MARKS.includes(text)) {
      marks[i] = { ref: text, decision: mark.decision };
    }
  });
}
