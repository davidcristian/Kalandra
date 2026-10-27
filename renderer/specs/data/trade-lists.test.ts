import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { setupTests } from "../vitest.setup";
import {
  init,
  TRADE_ITEM_BY_REF,
  TRADE_STAT_BY_MATCH_STR,
  TRADE_STAT_BY_STAT_ID,
} from "@/assets/data";
import { setTradeLists, type TradeLists } from "@/assets/data/trade-lists";
import { connectTradeLists } from "@/web/background/TradeData";

/** Trade lists held in memory, which a test replaces between reads as a new download would. */
class FakeTradeLists implements TradeLists {
  items = new Set<string>();
  stats = new Map<string, { [type: string]: string[] }>();
  statIds = new Set<string>();
  error: string | null = null;

  async load() {
    return this.error;
  }

  expressInterest() {}
}

describe("the trade lists of the data loader", () => {
  let lists: FakeTradeLists;

  beforeEach(() => {
    setupTests();
    lists = new FakeTradeLists();
  });

  afterEach(() => {
    connectTradeLists();
    vi.restoreAllMocks();
  });

  it("reads the lists of the last download at each lookup", async () => {
    setTradeLists(lists);
    await init("en");
    expect(TRADE_ITEM_BY_REF({ name: "Temple Maul" })).toBeUndefined();
    expect(TRADE_STAT_BY_STAT_ID("explicit.stat_1")).toBe(false);
    expect(TRADE_STAT_BY_MATCH_STR("# to Spirit")).toBeUndefined();

    lists.items = new Set(["Temple Maul"]);
    lists.stats = new Map([["# to Spirit", { explicit: ["explicit.stat_1"] }]]);
    lists.statIds = new Set(["explicit.stat_1"]);

    expect(TRADE_ITEM_BY_REF({ name: "Temple Maul" })?.[0].name).toBe(
      "Temple Maul",
    );
    expect(TRADE_STAT_BY_STAT_ID("explicit.stat_1")).toBe(true);
    expect(TRADE_STAT_BY_MATCH_STR("# to Spirit")).toEqual({
      explicit: ["explicit.stat_1"],
    });
  });

  it("sets no trade lookups when the download fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.resetModules();
    const data = await import("@/assets/data");
    const { setTradeLists: setFresh } = await import(
      "@/assets/data/trade-lists"
    );
    lists.items = new Set(["Temple Maul"]);
    lists.error = "The trade site request failed (status 503).";
    setFresh(lists);

    await data.init("en");

    expect(data.TRADE_ITEM_BY_REF({ name: "Temple Maul" })).toBeUndefined();
  });

  it("fails the load when the app has not set the lists", async () => {
    vi.resetModules();
    const data = await import("@/assets/data");

    await expect(data.init("en")).rejects.toThrow(
      "The trade lists are read before the app sets them",
    );
  });
});
