import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type * as TradeData from "@/web/background/TradeData";
import { HeldRequests } from "./held-requests";

/** Answers the trade site's item and stat list requests from `lists`. */
class FakeTradeSite {
  lists: { items: string[]; stats: string[] } = { items: [], stats: [] };
  held: HeldRequests | undefined;

  proxy = async (input: RequestInfo | URL, init?: RequestInit) => {
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
});
