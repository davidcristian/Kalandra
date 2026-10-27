import { present } from "@specs/present";
import fs from "fs";
import path from "path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { setupTests } from "@specs/vitest.setup";
import { init } from "@/assets/data";
import { Host } from "@/web/background/IPC";
import { requestResults } from "@/web/price-check/trade/pathofexile-trade";

interface SavedListing {
  id: string;
  item: {
    properties?: Array<{
      name: string;
      values: Array<[string, number]>;
      displayMode: number;
      type?: number;
    }>;
  };
}

const FETCH_URL = "www.pathofexile.com/api/trade2/fetch/";

/** The saved Dreaming Quarterstaff listing: item level 81 and the Quality property +20%. */
function savedQuarterstaff(): SavedListing {
  const file = path.resolve(__dirname, "../../../docs/fetchResponses.json");
  const saved: { result: SavedListing[] } = JSON.parse(
    fs.readFileSync(file, "utf-8"),
  );
  return present(
    saved.result.find((result) => result.id.startsWith("2fa2f1ee")),
  );
}

describe("requestResults item properties", () => {
  beforeEach(async () => {
    setupTests();
    await init("en");
  });

  // One request only: the fetch rate limit holds a second one for 5 seconds
  it("reads the item level, quality and gem level by their property type", async () => {
    const quarterstaff = savedQuarterstaff();
    const leveled = { ...savedQuarterstaff(), id: "leveled" };
    leveled.item.properties = [
      { name: "Level", values: [["17", 0]], displayMode: 0, type: 5 },
      { name: "Item Level", values: [["79", 0]], displayMode: 0, type: 78 },
      { name: "Map Tier", values: [["15", 0]], displayMode: 0, type: 1 },
    ];
    vi.mocked(Host.proxy).mockImplementation(async (input) => {
      const url = String(input);
      if (!url.startsWith(FETCH_URL)) throw new Error(`No fake for ${url}`);
      return new Response(JSON.stringify({ result: [quarterstaff, leveled] }));
    });

    const ids = [quarterstaff.id, leveled.id];
    const results = await requestResults("query", ids, { accountName: "" });

    expect(results.map((r) => [r.itemLevel, r.quality, r.level])).toEqual([
      ["81", "+20%", undefined],
      ["79", undefined, "17"],
    ]);
  });
});
