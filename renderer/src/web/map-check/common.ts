import { STAT_BY_MATCH_STR, STAT_BY_REF } from "@/assets/data";
import {
  keyInStat,
  keyOf,
  type MapStatKey,
  type MarkTarget,
} from "./mark-target";

export interface MapCheckConfig {
  profile: number;
  showNewStats: boolean;
  selectedStats: MapCheckStat[];
}

/** The marks of one modifier: its key, or before version 37 its text in the language of that time. */
export interface MapCheckStat extends Partial<MapStatKey> {
  matcher?: string;
  decision: string;
}

export enum StatTag {
  Outdated = 1,
  HeistExclusive,
  UberMapExclusive,
}

export interface StatMatcher {
  matchStr: string;
  tag?: StatTag;
  target: MarkTarget;
}

export function decisionHasColor(decisionSet: string, profileName: number) {
  // Three profiles stored as "---"
  // -: undefined
  // d: deadly mod
  // w: warning
  // g: good mod
  // s: marked as seen
  const idx = profileName - 1;
  return decisionSet[idx] !== "-" && decisionSet[idx] !== "s";
}

export function nextDecision(current: string): string {
  switch (current) {
    case "d":
      return "w";
    case "w":
      return "g";
    case "g":
      return "s";
  }
  return "d";
}

export function decisionCreate(
  value: string,
  profileName: number,
  updateSet = "---",
) {
  const idx = profileName - 1;
  const split = updateSet.split("");
  split[idx] = value;
  return split.join("");
}

/** Removes the mark of one profile from a modifier and keeps the marks of the other profiles. */
export function removeMark(stat: MapCheckStat, profileName: number): void {
  stat.decision = decisionCreate("-", profileName, stat.decision);
}

export function isOutdated(profileName: number, stat: MapCheckStat): boolean {
  if (!decisionHasColor(stat.decision, profileName)) return false;
  if (stat.ref != null) {
    const found = STAT_BY_REF(stat.ref);
    return found == null || !keyInStat(found, keyOf(stat.ref, stat));
  }
  return STAT_BY_MATCH_STR(stat.matcher ?? "").length === 0;
}

/** Returns the settings list row of an outdated mark, named by its ref or its saved text. */
export function outdatedRow(stat: MapCheckStat): StatMatcher {
  const target: MarkTarget =
    stat.ref != null
      ? { key: keyOf(stat.ref, stat), texts: [] }
      : { texts: [stat.matcher ?? ""] };
  return {
    matchStr: stat.ref ?? stat.matcher ?? "",
    tag: StatTag.Outdated,
    target,
  };
}
