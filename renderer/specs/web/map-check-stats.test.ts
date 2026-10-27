import { present } from "@specs/present";
import { beforeEach, describe, expect, it } from "vitest";
import { setupTests } from "@specs/vitest.setup";
import {
  RareMap,
  RareMapFakeAllProps,
  TwoLineOneImplicitItem,
} from "@specs/Parser/items";
import { init } from "@/assets/data";
import { parseClipboard } from "@/parser";
import { prepareMapStats } from "@/web/map-check/prepare-map-stats";

const PROJECTILES = "Monsters fire # additional Projectiles";
const FLASK_CHARGES = "Players gain #% reduced Flask Charges";

function parsed(rawText: string) {
  return parseClipboard(rawText)._unsafeUnwrap();
}

beforeEach(async () => {
  setupTests();
  await init("en");
});

describe("the rows of the Map check window", () => {
  it("list each stat of a Waystone with its roll, and a stat without a value without one", () => {
    const rows = prepareMapStats(parsed(RareMap.rawText));

    expect(rows.map((row) => [row.matcher, row.roll, row.type])).toEqual([
      ["Area has patches of Shocked Ground", undefined, "explicit"],
      ["#% increased Monster Damage", 28, "explicit"],
      [PROJECTILES, 2, "explicit"],
      ["Monsters have #% increased Critical Hit Chance", 293, "explicit"],
      ["#% to Monster Critical Damage Bonus", 26, "explicit"],
    ]);
    expect(rows[2].target).toEqual({
      key: { ref: PROJECTILES },
      texts: [
        PROJECTILES,
        "Players and Monsters fire # additional Projectiles",
      ],
    });
  });

  it("show a reduced wording with a positive roll, and name it by the negated key", () => {
    const row = prepareMapStats(parsed(RareMapFakeAllProps.rawText)).find(
      (stat) => stat.matcher === FLASK_CHARGES,
    );

    expect(row?.roll).toBe(33);
    expect(row?.target.key).toEqual({ ref: FLASK_CHARGES, negate: true });
  });

  it("name a stat by its ref when the item shows another wording of it", () => {
    const rows = prepareMapStats(parsed(TwoLineOneImplicitItem.rawText));

    expect(rows[0].type).toBe("implicit");
    expect(rows[1]).toEqual({
      matcher: "#% increased Pack Size",
      roll: 7,
      type: "explicit",
      target: {
        key: { ref: "#% increased Pack Size in Map" },
        texts: [
          "#% increased Pack Size",
          "#% reduced Pack Size in Map",
          "#% increased Pack Size in Map",
        ],
      },
    });
  });

  it("name a stat by its ref alone when the game data has no wording for its roll", () => {
    const item = parsed(RareMap.rawText);
    const projectiles = present(
      item.statsByType.find((calc) => calc.stat.ref === PROJECTILES),
    );
    // Only the wording for the value 0 is left, so the roll of 2 has none
    projectiles.stat = {
      ...projectiles.stat,
      matchers: projectiles.stat.matchers.filter((m) => m.value != null),
    };

    const row = prepareMapStats(item).find(
      (stat) => stat.target.key.ref === PROJECTILES,
    );

    expect(row?.roll).toBe(2);
    expect(row?.target).toEqual({ key: { ref: PROJECTILES }, texts: [] });
  });
});
