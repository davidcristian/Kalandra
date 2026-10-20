import fs from "fs";
import path from "path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { setupTests } from "@specs/vitest.setup";
import { init } from "@/assets/data";
import { Host } from "@/web/background/IPC";
import { requestResults } from "@/web/price-check/trade/pathofexile-trade";

interface SavedListing {
  id: string;
  item: { socketedItems: Array<{ gemSockets?: string[] }> };
}

const FETCH_URL = "www.pathofexile.com/api/trade2/fetch/";

/** The saved Wrath Sceptre listing, whose one socketed gem has 4 sockets. */
function savedSceptre(): SavedListing {
  const file = path.resolve(__dirname, "../../../docs/fetchResponses.json");
  const saved: { result: SavedListing[] } = JSON.parse(
    fs.readFileSync(file, "utf-8"),
  );
  return saved.result.find((result) => result.id.startsWith("4ec60fea5b"))!;
}

describe("requestResults gem sockets", () => {
  beforeEach(async () => {
    setupTests();
    await init("en");
  });

  // One request only: the fetch rate limit holds a second one for 5 seconds
  it("shows the most sockets of the gems socketed in a listing", async () => {
    const oneGem = savedSceptre();
    const twoGems = { ...savedSceptre(), id: "two gems" };
    const [gem] = twoGems.item.socketedItems;
    twoGems.item.socketedItems.push({ ...gem, gemSockets: ["W", "W"] });
    vi.mocked(Host.proxy).mockImplementation(async (input) => {
      const url = String(input);
      if (!url.startsWith(FETCH_URL)) throw new Error(`No fake for ${url}`);
      return new Response(JSON.stringify({ result: [oneGem, twoGems] }));
    });

    const results = await requestResults("query", [oneGem.id, twoGems.id], {
      accountName: "",
    });

    expect(results.map((result) => [result.id, result.gemSockets])).toEqual([
      [oneGem.id, 4],
      ["two gems", 4],
    ]);
  });
});
