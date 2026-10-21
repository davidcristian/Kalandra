import { beforeEach, describe, expect, it } from "vitest";
import { setupTests } from "@specs/vitest.setup";
import { RareMap } from "@specs/Parser/items";
import {
  init,
  loadForLang,
  STAT_BY_MATCH_STR,
  STAT_BY_REF,
} from "@/assets/data";
import { parseClipboard } from "@/parser";
import {
  isOutdated,
  outdatedRow,
  StatTag,
  type MapCheckStat,
} from "@/web/map-check/common";
import {
  findMark,
  markTarget,
  newMark,
  statTargets,
} from "@/web/map-check/mark-target";
import { prepareMapStats } from "@/web/map-check/prepare-map-stats";
import {
  convertTextMarks,
  nameDefaultMarksByRef,
} from "@/web/map-check/saved-marks";

const GOLD = "#% increased Gold found in Map";
const ABYSSES = "Map contains # additional Abysses";
const CRIT = "Monsters have #% increased Critical Hit Chance";
const RESISTANCES = "#% maximum Player Resistances";
const REFLECT = "Monsters reflect #% of Physical Damage";

const GOLD_DE = "#% erhöhtes gefundenes Gold in der Karte";
const LESS_GOLD_DE = "#% verringertes gefundenes Gold in der Karte";

function converted(marks: MapCheckStat[]): MapCheckStat[] {
  convertTextMarks(marks, STAT_BY_MATCH_STR);
  return marks;
}

function target(ref: string, text: string) {
  const stat = STAT_BY_REF(ref)!;
  return markTarget(stat, stat.matchers.find((m) => m.string === text)!);
}

beforeEach(() => {
  setupTests();
});

describe("converting map check marks saved as text", () => {
  it("names English marks by the stat ref and the sign of the wording", async () => {
    await init("en");

    expect(
      converted([
        { matcher: "#% increased Gold found in Map", decision: "d--" },
        { matcher: "#% reduced Gold found in Map", decision: "g--" },
      ]),
    ).toEqual([
      { ref: GOLD, decision: "d--" },
      { ref: GOLD, negate: true, decision: "g--" },
    ]);
  });

  it("names German marks by the same keys", async () => {
    await init("de");

    expect(
      converted([
        { matcher: GOLD_DE, decision: "d--" },
        { matcher: LESS_GOLD_DE, decision: "g--" },
      ]),
    ).toEqual([
      { ref: GOLD, decision: "d--" },
      { ref: GOLD, negate: true, decision: "g--" },
    ]);
  });

  it("names a wording for one value by that value", async () => {
    await init("de");

    expect(
      converted([
        {
          matcher: "Karte enthält einen zusätzlichen Abgrund",
          decision: "w--",
        },
        { matcher: "Karte enthält # zusätzliche Abgründe", decision: "d--" },
      ]),
    ).toEqual([
      { ref: ABYSSES, value: 1, decision: "w--" },
      { ref: ABYSSES, decision: "d--" },
    ]);
  });

  it("keeps a mark whose text is not in the game data of the language", async () => {
    await init("en");
    const german = { matcher: GOLD_DE, decision: "d--" };
    const removed = { matcher: REFLECT, decision: "d--" };

    const marks = converted([
      german,
      { matcher: CRIT, decision: "w--" },
      removed,
    ]);

    expect(marks).toEqual([german, { ref: CRIT, decision: "w--" }, removed]);
    expect(marks[0]).toBe(german);
    expect(marks[2]).toBe(removed);
  });

  it("drops a later mark of a modifier that an earlier mark has", async () => {
    await init("en");

    expect(
      converted([
        { matcher: "#% increased Gold found in Map", decision: "d--" },
        { matcher: "#% increased Gold found in your Maps", decision: "g--" },
      ]),
    ).toEqual([{ ref: GOLD, decision: "d--" }]);
  });
});

describe("map check marks after a language change", () => {
  it("color the modifier of an English Waystone with a mark saved in German", async () => {
    await init("de");
    const marks = converted([
      {
        matcher: "Monster haben #% erhöhte kritische Trefferchance",
        decision: "d--",
      },
    ]);

    await loadForLang("en");
    const item = parseClipboard(RareMap.rawText)._unsafeUnwrap();
    const crit = prepareMapStats(item).find((stat) => stat.matcher === CRIT)!;

    expect(findMark(marks, crit.target)).toBe(marks[0]);
    expect(isOutdated(1, marks[0])).toBe(false);
  });

  it("match a mark set in English to the German wording of the same sign only", async () => {
    await init("en");
    const marks = [
      newMark(target(GOLD, "#% increased Gold found in Map").key, "d--"),
    ];

    await loadForLang("de");

    expect(findMark(marks, target(GOLD, GOLD_DE))).toBe(marks[0]);
    expect(findMark(marks, target(GOLD, LESS_GOLD_DE))).toBeUndefined();
  });

  it("match a mark saved as text to every wording of its modifier before it is converted", async () => {
    await init("de");
    const marks: MapCheckStat[] = [
      {
        matcher: "#% verringertes gefundenes Gold in Euren Karten",
        decision: "d--",
      },
    ];

    expect(findMark(marks, target(GOLD, LESS_GOLD_DE))).toBe(marks[0]);
    expect(findMark(marks, target(GOLD, GOLD_DE))).toBeUndefined();
  });
});

describe("an outdated map check mark", () => {
  it("is a colored mark of a modifier the game data does not have", async () => {
    await init("en");

    expect(isOutdated(1, { ref: REFLECT, decision: "d--" })).toBe(true);
    expect(isOutdated(1, { ref: GOLD, value: 5, decision: "d--" })).toBe(true);
    expect(isOutdated(1, { matcher: GOLD_DE, decision: "d--" })).toBe(true);
    expect(isOutdated(1, { ref: GOLD, decision: "d--" })).toBe(false);
    expect(isOutdated(1, { ref: REFLECT, decision: "-d-" })).toBe(false);
    expect(isOutdated(2, { ref: REFLECT, decision: "-d-" })).toBe(true);
  });

  it("is listed by its ref or its saved text, and finds its own mark", () => {
    const byRef = { ref: REFLECT, negate: true as const, decision: "d--" };
    const byText = { matcher: GOLD_DE, decision: "w--" };

    expect(outdatedRow(byRef)).toEqual({
      matchStr: REFLECT,
      tag: StatTag.Outdated,
      target: { key: { ref: REFLECT, negate: true }, texts: [] },
    });
    expect(outdatedRow(byText).matchStr).toBe(GOLD_DE);
    expect(findMark([byText, byRef], outdatedRow(byRef).target)).toBe(byRef);
    expect(findMark([byRef, byText], outdatedRow(byText).target)).toBe(byText);
  });
});

describe("the settings rows of a stat", () => {
  it("are one row for each key, named by its first wording, with every wording to search", async () => {
    await init("en");

    const rows = statTargets(STAT_BY_REF(GOLD)!);

    expect(rows.map((row) => row.text)).toEqual([
      "#% increased Gold found in Map",
      "#% reduced Gold found in Map",
    ]);
    expect(rows[0].target).toEqual({
      key: { ref: GOLD },
      texts: [
        "#% increased Gold found in Map",
        "#% increased Gold found in your Maps",
        "#% increased Gold found in this Area",
      ],
    });
    expect(rows[1].target.key).toEqual({ ref: GOLD, negate: true });
  });
});

describe("the default marks of earlier versions", () => {
  function savedConfig(selectedStats: MapCheckStat[]) {
    return {
      widgets: [
        { wmType: "price-check" },
        { wmType: "item-check", maps: { profile: 1, selectedStats } },
      ],
    };
  }

  it("are named by ref, and the other marks stay as they are", () => {
    const config = savedConfig([
      { matcher: RESISTANCES, decision: "w--" },
      { matcher: GOLD_DE, decision: "g--" },
      { matcher: REFLECT, decision: "d--" },
      { ref: GOLD, decision: "d--" },
    ]);

    nameDefaultMarksByRef(config);

    expect(config.widgets[1].maps!.selectedStats).toEqual([
      { ref: RESISTANCES, decision: "w--" },
      { matcher: GOLD_DE, decision: "g--" },
      { ref: REFLECT, decision: "d--" },
      { ref: GOLD, decision: "d--" },
    ]);
  });

  it("match the modifier in German once named by ref", async () => {
    await init("de");
    const config = savedConfig([{ matcher: RESISTANCES, decision: "w--" }]);

    nameDefaultMarksByRef(config);
    const marks = config.widgets[1].maps!.selectedStats;

    expect(
      findMark(marks, target(RESISTANCES, "#% maximale Spielerwiderstände")),
    ).toBe(marks[0]);
  });

  it("leave a config without item check marks as it is", () => {
    const config = { widgets: [{ wmType: "item-check" }] };

    nameDefaultMarksByRef(config);

    expect(config).toEqual({ widgets: [{ wmType: "item-check" }] });
  });
});
