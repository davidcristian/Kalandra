import { readonly, shallowRef } from "vue";
import { createGlobalState } from "@vueuse/core";
import { Host } from "@/web/background/IPC";
import { readTradeData } from "@/web/price-check/trade/trade-response";

// from Prices.ts, but longer periods since maybe would slowdown ui more
const RETRY_INTERVAL_MS = 30 * 60 * 1000; // 30 min, try to get new stuff
const UPDATE_INTERVAL_MS = 2 * 60 * 60 * 1000; // 2 hours, only allow every this period
const INTEREST_SPAN_MS = 60 * 60 * 1000; // 20 min, refuse to get if haven't used for this period

export interface ItemQuery {
  group: string;
  type: string;
  name?: string;
}

interface TradeItem {
  type: string;
  text?: string;
  name?: string;
  flags?: {
    unique: true;
  };
}

interface TradeStat {
  id: string;
  text: string;
}

function countNew(next: Set<string>, current: Set<string>) {
  return [...next].filter((entry) => !current.has(entry)).length;
}

export const useTradeData = createGlobalState(() => {
  let lastUpdateTime = 0;
  let downloadController: AbortController | undefined;
  let lastInterestTime = 0;

  const isLoading = shallowRef(false);
  const error = shallowRef<string | null>(null);
  // ref data - nameplates are always REF
  const itemData = shallowRef<Set<string>>(new Set([]));
  // English stat texts in every app language: only English item text matches
  const statDataSet = shallowRef<Set<string>>(new Set([]));
  const statData = shallowRef<Map<string, { [type: string]: string[] }>>(
    new Map(),
  );

  async function loadStatData(): Promise<
    [Map<string, Record<string, string[]>>, Set<string>]
  > {
    if (!downloadController) {
      throw new Error("download controller not initialized");
    }

    const response = await Host.proxy(
      `www.pathofexile.com/api/trade2/data/stats`,
      {
        signal: downloadController.signal,
      },
    );
    const rawStatsData = await readTradeData<{
      result: Array<{ id: string; entries: TradeStat[] }>;
    }>(response);
    const tradeStatsProcessingTime = performance.now();

    const outStatData: Map<string, { [type: string]: string[] }> = new Map();
    const statDataSet = new Set<string>();

    for (const { id: modType, entries } of rawStatsData.result) {
      for (const { id: statId, text: matcher } of entries) {
        let modMap = outStatData.get(matcher);

        if (!modMap) {
          modMap = {};
          outStatData.set(matcher, modMap);
        }

        let statIds = modMap[modType];

        if (!statIds) {
          statIds = [];
          modMap[modType] = statIds;
        }

        statDataSet.add(statId);
        statIds.push(statId);
      }
    }
    performance.measure("loadStatData", {
      start: tradeStatsProcessingTime,
      end: performance.now(),
    });

    return [outStatData, statDataSet];
  }

  async function loadItemData() {
    if (!downloadController) {
      throw new Error("download controller not initialized");
    }

    const response = await Host.proxy(
      // don't use `getTradeEndpoint` since we want ref items, not translated
      `www.pathofexile.com/api/trade2/data/items`,
      {
        signal: downloadController.signal,
      },
    );
    const rawItemData = await readTradeData<{
      result: Array<{ entries: TradeItem[] }>;
    }>(response);
    const tradeItemsProcessingTime = performance.now();

    const outItemData = new Set<string>();

    for (const category of rawItemData.result) {
      for (const { type, text } of category.entries) {
        if (type) {
          outItemData.add(type);
        }
        if (text) {
          outItemData.add(text);
        }
      }
    }

    performance.measure("loadItemData", {
      start: tradeItemsProcessingTime,
      end: performance.now(),
    });

    return outItemData;
  }

  async function load(force: boolean = false) {
    if (
      !force &&
      // don't update more that this frequently
      (Date.now() - lastUpdateTime < UPDATE_INTERVAL_MS ||
        // don't update if user hasn't needed them recently
        Date.now() - lastInterestTime > INTEREST_SPAN_MS)
    )
      return;

    downloadController?.abort();
    const controller = new AbortController();
    downloadController = controller;

    let foundItems: number = 0;
    let foundStats: number = 0;

    try {
      performance.mark("trade-data-load-start");
      isLoading.value = true;
      error.value = null;

      // grab the data
      const [outItemData, [outStatData, outStatDataSet]] = await Promise.all([
        loadItemData(),
        loadStatData(),
      ]);

      // An empty list means the request failed, so the loaded lists stay
      if (outItemData.size && outStatDataSet.size) {
        foundItems = countNew(outItemData, itemData.value);
        foundStats = countNew(outStatDataSet, statDataSet.value);
        itemData.value = outItemData;
        statData.value = outStatData;
        statDataSet.value = outStatDataSet;
        lastUpdateTime = Date.now();
      }
    } catch (e) {
      if (controller === downloadController) {
        console.warn(e);
        error.value = (e as Error).message;
      }
    } finally {
      if (controller === downloadController) isLoading.value = false;
    }
    performance.mark("trade-data-load-end");

    // give caller some data if they want it
    return {
      foundItems,
      foundStats,
    };
  }

  function expressInterest() {
    lastInterestTime = Date.now();
  }

  // TODO: remove possibly, if this is laggy then don't want to load at random times
  setInterval(() => {
    load();
  }, RETRY_INTERVAL_MS);

  return {
    isLoading,
    error,
    expressInterest,
    tradeItemData: readonly(itemData),
    tradeStatData: readonly(statData),
    tradeStatDataSet: readonly(statDataSet),
    load,
  };
});
