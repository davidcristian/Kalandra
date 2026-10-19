import fs from "fs";
import path from "path";
import { beforeEach, describe, expect, it } from "vitest";
import { setupTests } from "@specs/vitest.setup";
import { BaseType, CATALYST_TYPES, init } from "@/assets/data";
import { __testExports, DbQuery, NinjaSchema } from "@/web/background/Prices";
import { catalystCost } from "@/web/price-check/item-editor/item-editor";

const PRICE_FILE = JSON.stringify({
  core: {
    rates: { exalted: 541.6, chaos: 8.53 },
    primary: "divine",
    secondary: "chaos",
  },
  itemOverviews: [
    {
      type: "Breach",
      lines: [
        {
          name: "Adaptive Catalyst",
          primaryValue: 0.25,
          detailsId: "adaptive-catalyst",
          id: "adaptive-catalyst",
          volumePrimaryValue: 3.5,
          maxVolumeCurrency: "exalted",
          maxVolumeRate: 135,
          sparkline: { totalChange: 0, data: [0] },
        },
      ],
    },
  ],
});

function findPriceIn(blob: string) {
  const schema: NinjaSchema = JSON.parse(
    fs.readFileSync(
      path.resolve(__dirname, "../../../../public/data/namespaceMap.json"),
      "utf-8",
    ),
  );
  const database = __testExports.splitJsonBlob(blob, schema);
  return (query: DbQuery) =>
    __testExports.findInDatabase(database, query)?.info ?? null;
}

function catalyst(refName: string): BaseType {
  const found = CATALYST_TYPES.Normal.find((c) => c.refName === refName);
  if (!found) throw new Error(`No catalyst ${refName} in the item data`);
  return found;
}

describe("catalystCost with German item data", () => {
  beforeEach(async () => {
    setupTests({ language: "de" });
    await init("de");
  });

  it("finds a catalyst by its English name in the price file", () => {
    const adaptive = catalyst("Adaptive Catalyst");
    expect(adaptive.name).toBe("Anpassungsfähiger Katalysator");

    expect(catalystCost(adaptive, 20, findPriceIn(PRICE_FILE))).toBe(5);
  });

  it("returns undefined for a catalyst the price file does not list", () => {
    const carapace = catalyst("Carapace Catalyst");

    expect(catalystCost(carapace, 20, findPriceIn(PRICE_FILE))).toBeUndefined();
  });
});
