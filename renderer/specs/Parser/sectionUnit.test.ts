import { __testExports } from "@/parser/Parser";
import { beforeEach, describe, expect, it } from "vitest";
import { setupTests } from "@specs/vitest.setup";
import { init } from "@/assets/data";
import {
  createTestItem,
  createTestItemWithInfo,
  createTestParserState,
} from "@specs/helper";
import { ParsedItem } from "@/parser";

describe("Parse Unidentified Sections", () => {
  beforeEach(async () => {
    setupTests();
    await init("en");
  });

  it("can parse normal Unidentified", () => {
    const parsedItem = createTestParserState();
    const lines = ["Unidentified"];

    const res = __testExports.parseUnidentified(lines, parsedItem);

    expect(res).toBe("SECTION_PARSED");
    expect(parsedItem.isUnidentified).toBeTruthy();
    expect(parsedItem.unidentifiedTier).toBeUndefined();
  });

  it("can parse Unidentified with tier", () => {
    const parsedItem = createTestParserState();
    const lines = ["Unidentified (Tier 4)"];

    const res = __testExports.parseUnidentified(lines, parsedItem);

    expect(res).toBe("SECTION_PARSED");
    expect(parsedItem.isUnidentified).toBeTruthy();
    expect(parsedItem.unidentifiedTier).toBe(4);
  });

  it.each([
    [["Item Level: 54"]],
    [
      [
        "{ Implicit Modifier — Elemental, Cold, Resistance }",
        "+23(20-30)% to Cold Resistance",
      ],
    ],
    [["Item Class: Rings", "Rarity: Magic", "Sapphire Ring"]],
  ])("%#. shouldn't be unidentified", (lines: string[]) => {
    const parsedItem = createTestParserState();

    const res = __testExports.parseUnidentified(lines, parsedItem);

    expect(res).toBe("SECTION_SKIPPED");
    expect(parsedItem.isUnidentified).toBeFalsy();
    expect(parsedItem.unidentifiedTier).toBeUndefined();
  });
});

describe("parseTrials", () => {
  beforeEach(async () => {
    setupTests();
    await init("en");
  });

  it.each([
    [["Area Level: 25", "Number of Trials: 1"], 25, 1],
    [["Area Level: 58", "Number of Trials: 2"], 58, 2],
    [["Area Level: 70", "Number of Trials: 3"], 70, 3],
    [["Area Level: 80", "Number of Trials: 4"], 80, 4],
  ])(
    "%#. should parse Djinn Barya",
    (lines: string[], area: number, count: number) => {
      const parsedItem: ParsedItem = {
        ...createTestItem(),
        info: { ...createTestItem().info, refName: "Djinn Barya" },
      };

      const res = __testExports.parseTrials(lines, parsedItem);

      expect(res).toBe("SECTION_PARSED");
      expect(parsedItem.areaLevel).toBe(area);
      expect(parsedItem.trials).toBeDefined();
      expect(parsedItem.trials!.numberOfTrials).toEqual(count);
    },
  );

  it.each([
    [["Area Level: 27", "Number of Trials: 1"], 27, 1],
    [["Area Level: 56", "Number of Trials: 2"], 56, 2],
    [["Area Level: 69", "Number of Trials: 3"], 69, 3],
    [
      ["Area Level: 75", "Number of Trials: 4", "Victorious"],
      75,
      4,
      "Victorious",
    ],
    [["Area Level: 76", "Number of Trials: 4", "Cowardly"], 76, 4, "Cowardly"],
    [["Area Level: 79", "Number of Trials: 4", "Deadly"], 79, 4, "Deadly"],
  ])(
    "%#. should parse Inscribed Ultimatum",
    (lines: string[], area: number, count: number, hint?: string) => {
      const parsedItem: ParsedItem = {
        ...createTestItem(),
        info: { ...createTestItem().info, refName: "Inscribed Ultimatum" },
      };

      const res = __testExports.parseTrials(lines, parsedItem);

      expect(res).toBe("SECTION_PARSED");
      expect(parsedItem.areaLevel).toBe(area);
      expect(parsedItem.trials).toBeDefined();
      expect(parsedItem.trials!.numberOfTrials).toEqual(count);
      expect(parsedItem.trials!.ultimatumHint).toEqual(hint);
    },
  );

  it.each([
    ["Divine Crown", ["Area Level: 27", "Number of Trials: 1"]],
    ["Withered Wand", ["Area Level: 56", "Number of Trials: 2"]],
    ["Uncut Support Gem (Level 5)", ["Area Level: 69", "Number of Trials: 3"]],
    ["Ornate Belt", ["Area Level: 75", "Number of Trials: 4", "Victorious"]],
    ["Rider Bow", ["Area Level: 76", "Number of Trials: 4", "Cowardly"]],
    ["", ["Area Level: 79", "Number of Trials: 4", "Deadly"]],
  ])("%#. should skip non trial items", (refName: string, lines: string[]) => {
    const parsedItem: ParsedItem = {
      ...createTestItem(),
      info: { ...createTestItem().info, refName },
    };

    const res = __testExports.parseTrials(lines, parsedItem);

    expect(res).toBe("PARSER_SKIPPED");
    expect(parsedItem.areaLevel).toBeUndefined();
    expect(parsedItem.trials).toBeUndefined();
  });
});

// Lines of the first area of the Expedition Logbook listing in specs/docs/fetchResponses.json
const LOGBOOK_AREA = [
  "Frigid Bluffs",
  "Druids of the Broken Circle",
  "Area contains 12 additional Chest Markers",
  "Area contains 35% increased number of Monster Markers",
];

describe("Parse Expedition Logbook area sections", () => {
  beforeEach(async () => {
    setupTests();
    await init("en");
  });

  it.each([
    ["SECTION_PARSED", "an area section", LOGBOOK_AREA],
    [
      "SECTION_SKIPPED",
      "a section without a faction line",
      [LOGBOOK_AREA[0], ...LOGBOOK_AREA.slice(2)],
    ],
    ["SECTION_SKIPPED", "a section of two lines", LOGBOOK_AREA.slice(0, 2)],
  ])("returns %s for %s and adds no modifier", (result, _section, lines) => {
    const item = createTestItemWithInfo({ refName: "Expedition Logbook" });

    expect(__testExports.parseLogbookArea(lines, item)).toBe(result);
    expect(item.newMods).toEqual([]);
    expect(item.unknownModifiers).toEqual([]);
  });

  it("skips the parser for an item that is not an Expedition Logbook", () => {
    expect(__testExports.parseLogbookArea(LOGBOOK_AREA, createTestItem())).toBe(
      "PARSER_SKIPPED",
    );
  });
});
