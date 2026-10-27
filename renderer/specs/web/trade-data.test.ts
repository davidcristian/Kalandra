import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type * as TradeData from "@/web/background/TradeData";
import type { TradeLists } from "@/assets/data/trade-lists";
import { HeldRequests, settle } from "./held-requests";

const THIRTY_MINUTES = 30 * 60 * 1000;

/** Answers the trade site's item and stat list requests from `lists`, or with a web page while `down` is set. */
class FakeTradeSite {
  lists: { items: string[]; stats: string[] } = { items: [], stats: [] };
  held: HeldRequests | undefined;
  down = false;

  proxy = async (input: RequestInfo | URL, init?: RequestInit) => {
    if (this.down) return new Response("<html></html>", { status: 503 });
    const { items, stats } = this.lists;
    const body = String(input).endsWith("/data/items")
      ? { result: [{ entries: items.map((type) => ({ type })) }] }
      : {
          result: [
            { id: "explicit", entries: stats.map((id) => ({ id, text: id })) },
          ],
        };
    if (this.held)
      return await this.held.answer(JSON.stringify(body), init?.signal);
    return new Response(JSON.stringify(body));
  };
}

describe("useTradeData", () => {
  let site: FakeTradeSite;
  let tradeData: ReturnType<typeof TradeData.useTradeData>;

  beforeEach(async () => {
    vi.useFakeTimers({ toFake: ["setInterval", "clearInterval", "Date"] });
    // useTradeData is one shared state per module, so each test imports a new one
    vi.resetModules();
    site = new FakeTradeSite();
    const { Host } = await import("@/web/background/IPC");
    vi.mocked(Host.proxy).mockImplementation(site.proxy);
    const { useTradeData } = await import("@/web/background/TradeData");
    tradeData = useTradeData();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("leaves isLoading and error to the load that replaced a running one", async () => {
    site.lists = { items: ["Iron Ring"], stats: ["stat_1"] };
    site.held = new HeldRequests();
    const replaced = tradeData.load(true);
    const current = tradeData.load(true);

    await replaced;
    expect(tradeData.isLoading.value).toBe(true);
    expect(tradeData.error.value).toBeNull();

    site.held.release();
    await current;
    expect(tradeData.isLoading.value).toBe(false);
    expect(tradeData.error.value).toBeNull();
    expect([...tradeData.tradeItemData.value]).toEqual(["Iron Ring"]);
  });

  it("applies a reload that brings new stats and no new items", async () => {
    site.lists = { items: ["Iron Ring"], stats: ["stat_1"] };
    await tradeData.load(true);
    site.lists = { items: ["Iron Ring"], stats: ["stat_1", "stat_2"] };

    expect(await tradeData.load(true)).toEqual({
      foundItems: 0,
      foundStats: 1,
    });
    expect([...tradeData.tradeStatDataSet.value]).toEqual(["stat_1", "stat_2"]);
  });

  it("applies a shorter list and counts only the entries that are new", async () => {
    site.lists = { items: ["Iron Ring", "Gold Ring"], stats: ["stat_1"] };
    await tradeData.load(true);
    site.lists = { items: ["Iron Ring"], stats: ["stat_2"] };

    expect(await tradeData.load(true)).toEqual({
      foundItems: 0,
      foundStats: 1,
    });
    expect([...tradeData.tradeItemData.value]).toEqual(["Iron Ring"]);
    expect([...tradeData.tradeStatData.value.keys()]).toEqual(["stat_2"]);
  });

  it("keeps the loaded lists when a response has an empty list", async () => {
    site.lists = { items: ["Iron Ring"], stats: ["stat_1"] };
    await tradeData.load(true);
    site.lists = { items: ["Gold Ring"], stats: [] };

    expect(await tradeData.load(true)).toEqual({
      foundItems: 0,
      foundStats: 0,
    });
    expect([...tradeData.tradeItemData.value]).toEqual(["Iron Ring"]);
    expect([...tradeData.tradeStatDataSet.value]).toEqual(["stat_1"]);
  });

  it("loads again at the next timer tick after a response with an empty list", async () => {
    site.lists = { items: [], stats: ["stat_1"] };
    await tradeData.load(true);
    site.lists = { items: ["Iron Ring"], stats: ["stat_1"] };

    tradeData.expressInterest();
    await vi.advanceTimersByTimeAsync(THIRTY_MINUTES);
    await settle();
    expect([...tradeData.tradeItemData.value]).toEqual(["Iron Ring"]);
  });

  it("waits 2 hours after a load that applied the lists", async () => {
    site.lists = { items: ["Iron Ring"], stats: ["stat_1"] };
    await tradeData.load(true);
    site.lists = {
      items: ["Iron Ring", "Gold Ring"],
      stats: ["stat_1", "stat_2"],
    };

    tradeData.expressInterest();
    await vi.advanceTimersByTimeAsync(3 * THIRTY_MINUTES);
    await settle();
    expect(tradeData.tradeItemData.value.size).toBe(1);

    tradeData.expressInterest();
    await vi.advanceTimersByTimeAsync(THIRTY_MINUTES);
    await settle();
    expect(tradeData.tradeItemData.value.size).toBe(2);
  });
});

describe("connectTradeLists", () => {
  let site: FakeTradeSite;
  let lists: TradeLists;

  beforeEach(async () => {
    vi.useFakeTimers({ toFake: ["setInterval", "clearInterval", "Date"] });
    vi.resetModules();
    site = new FakeTradeSite();
    const { Host } = await import("@/web/background/IPC");
    vi.mocked(Host.proxy).mockImplementation(site.proxy);
    const { connectTradeLists } = await import("@/web/background/TradeData");
    const { tradeLists } = await import("@/assets/data/trade-lists");
    connectTradeLists();
    lists = tradeLists();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("gives the data loader the lists of the last download at each read", async () => {
    site.lists = { items: ["Iron Ring"], stats: ["stat_1"] };
    expect(await lists.load()).toBeNull();
    expect([...lists.items]).toEqual(["Iron Ring"]);

    site.lists = { items: ["Iron Ring"], stats: ["stat_1", "stat_2"] };
    expect(await lists.load()).toBeNull();
    expect([...lists.statIds]).toEqual(["stat_1", "stat_2"]);
    expect(lists.stats.get("stat_2")).toEqual({ explicit: ["stat_2"] });
  });

  it("returns the error message of a failed download", async () => {
    site.down = true;

    expect(await lists.load()).toContain(
      "The trade site sent a web page instead of data (status 503)",
    );
  });

  it("downloads the lists again on the timer only after the data loader used them", async () => {
    site.lists = { items: ["Iron Ring"], stats: ["stat_1"] };
    await lists.load();
    site.lists = { items: ["Iron Ring", "Gold Ring"], stats: ["stat_1"] };

    await vi.advanceTimersByTimeAsync(5 * THIRTY_MINUTES);
    await settle();
    expect(lists.items.size).toBe(1);

    lists.expressInterest();
    await vi.advanceTimersByTimeAsync(THIRTY_MINUTES);
    await settle();
    expect(lists.items.size).toBe(2);
  });
});
