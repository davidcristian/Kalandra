import { shallowReactive } from "vue";
import type { ParsedItem } from "@/parser";
import { logToMain } from "@/web/background/log-to-main";
import { usePoeninja } from "@/web/background/Prices";
import { listingItem, UNREADABLE } from "./item-text";
import {
  type ListingPrice,
  priceWithoutSearch,
  searchPrice,
} from "./price-item";
import { countPrices, type PricerState, searchPause } from "./pricer-state";
import { clampInterval, type ReaderSettings } from "./reader-settings";
import type { StashListing } from "./stash-listings";
import { holdForFetch, RETRY_MS } from "./stash-requests";

// At most one pricing search in this time, from the start of one to the start of the next
export const PACE_MS = 15_000;

/** What the pricer reads from the app, each time it needs the value. */
export interface PricerSources {
  settings: () => ReaderSettings;
  listings: () => readonly StashListing[];
  leagueId: () => string | undefined;
  accountName: () => string;
  priceCheckShown: () => boolean;
  readerChecking: () => boolean;
}

/** Creates the pricer that prices the reader's listings, newest first, within the search budget. */
export function createStashPricer(sources: PricerSources) {
  const state = shallowReactive<PricerState>({
    status: "off",
    error: null,
    prices: new Map(),
    counts: countPrices(new Map()),
    pricing: null,
    nextSearchAt: null,
  });
  const items = new Map<string, ReturnType<typeof listingItem>>();
  // The listings that need a search, so each run does not build their filters again
  const needsSearch = new Set<string>();
  let timer: ReturnType<typeof setTimeout> | undefined;
  let runId = 0;
  let running = false;
  let lastSearchAt = Number.NEGATIVE_INFINITY;
  let resumeAt = 0;
  let loggedError: string | null = null;

  function setPrices(prices: Map<string, ListingPrice>) {
    state.prices = prices;
    state.counts = countPrices(prices);
  }

  function setPrice(id: string, price: ListingPrice) {
    if (!state.prices.has(id)) return;
    setPrices(new Map(state.prices).set(id, price));
  }

  function schedule(delayMs: number, showNext = false) {
    clearTimeout(timer);
    state.nextSearchAt = showNext ? Date.now() + delayMs : null;
    timer = setTimeout(() => {
      void run();
    }, delayMs);
  }

  function itemOf(listing: StashListing) {
    let item = items.get(listing.id);
    if (!item) {
      item = listingItem(listing.raw);
      items.set(listing.id, item);
    }
    return item;
  }

  function withoutSearch(item: ParsedItem, league: string) {
    try {
      return priceWithoutSearch(item, league);
    } catch (error) {
      console.warn("[stash-prices] Cannot build the item's filters:", error);
      return { status: "cannot-read", reason: UNREADABLE } as const;
    }
  }

  /** Prices each queued listing that needs no search: from the price file, or as one it cannot read or price. */
  function settleWithoutSearch(league: string) {
    const prices = new Map(state.prices);
    for (const listing of sources.listings()) {
      if (prices.get(listing.id)?.status !== "queued") continue;
      if (needsSearch.has(listing.id)) continue;
      const item = itemOf(listing);
      if (item.isErr()) {
        prices.set(listing.id, { status: "cannot-read", reason: item.error });
        continue;
      }
      const price = withoutSearch(item.value, league);
      if (price) prices.set(listing.id, price);
      else needsSearch.add(listing.id);
    }
    setPrices(prices);
  }

  /** Returns the next listing to search: the newest queued one, else the first that failed. */
  function nextListing():
    | { listing: StashListing; item: ParsedItem }
    | undefined {
    const listings = sources.listings();
    const pick =
      listings.find(
        (listing) => state.prices.get(listing.id)?.status === "queued",
      ) ??
      listings.find(
        (listing) => state.prices.get(listing.id)?.status === "failed",
      );
    const item = pick && itemOf(pick);
    return pick && item?.isOk()
      ? { listing: pick, item: item.value }
      : undefined;
  }

  function fail(error: unknown, listingId: string, settings: ReaderSettings) {
    const message = error instanceof Error ? error.message : String(error);
    setPrice(listingId, { status: "failed", message });
    state.status = "error";
    state.error = message;
    console.warn("[stash-prices] Pricing a listing failed:", error);
    if (message !== loggedError) {
      loggedError = message;
      logToMain("warn", `[stash-prices] Pricing a listing failed: ${message}`);
    }
    resumeAt = Date.now() + clampInterval(settings.intervalMinutes) * 60_000;
    schedule(resumeAt - Date.now(), true);
  }

  /** Prices the listing with one search, and returns true when the next listing may follow at once. */
  async function search(
    next: { listing: StashListing; item: ParsedItem },
    settings: ReaderSettings,
    league: string,
  ): Promise<boolean> {
    const id = ++runId;
    running = true;
    lastSearchAt = Date.now();
    state.status = "pricing";
    state.pricing = next.listing.id;
    setPrice(next.listing.id, { status: "pricing" });
    try {
      const result = await searchPrice(next.item, {
        league,
        accountName: sources.accountName(),
        holdFetch: () =>
          holdForFetch({
            priceCheckShown: sources.priceCheckShown,
            deadline: Date.now() + PACE_MS + RETRY_MS,
            stopped: () => id !== runId,
            onPause: (reason) => {
              state.status = reason;
            },
          }),
      });
      if (id !== runId || result === "stopped") return false;
      if (typeof result === "string") {
        // A held fetch puts the listing back; the price check's cache keeps its search for 5 minutes
        setPrice(next.listing.id, { status: "queued" });
        state.status = result;
        schedule(RETRY_MS, true);
        return false;
      }
      setPrice(next.listing.id, result);
      loggedError = null;
      return true;
    } catch (error) {
      if (id === runId) fail(error, next.listing.id, settings);
      return false;
    } finally {
      if (id === runId) {
        running = false;
        state.pricing = null;
      }
    }
  }

  async function run(): Promise<void> {
    if (running) return;
    clearTimeout(timer);
    state.nextSearchAt = null;
    const settings = sources.settings();
    if (!settings.enabled) return stop();
    if (
      ![...state.prices.values()].some(
        (price) => price.status === "queued" || price.status === "failed",
      )
    ) {
      state.status = "done";
      return;
    }
    if (Date.now() < resumeAt) return schedule(resumeAt - Date.now(), true);
    const league = sources.leagueId();
    if (!league) {
      state.status = "no-league";
      return schedule(RETRY_MS);
    }
    const prices = usePoeninja();
    prices.queuePricesFetch();
    if (prices.xchgRate.value === undefined) {
      state.status = "no-prices";
      return schedule(RETRY_MS);
    }
    settleWithoutSearch(league);
    const next = nextListing();
    if (!next) {
      state.status = "done";
      return;
    }
    const wait = lastSearchAt + PACE_MS - Date.now();
    if (wait > 0) {
      state.status = "waiting";
      return schedule(wait, true);
    }
    const reason = searchPause(
      settings,
      sources.priceCheckShown(),
      sources.readerChecking(),
    );
    if (reason) {
      state.status = reason;
      const delay =
        reason === "budget-reached"
          ? clampInterval(settings.intervalMinutes) * 60_000
          : RETRY_MS;
      return schedule(delay, true);
    }
    state.error = null;
    if (await search(next, settings, league)) await run();
  }

  /** Follows the reader's listings: queues each new one, forgets each gone one, and prices when there is work. */
  function sync() {
    if (!sources.settings().enabled) return stop();
    const listings = sources.listings();
    const ids = new Set(listings.map((listing) => listing.id));
    const prices = new Map<string, ListingPrice>();
    for (const listing of listings) {
      prices.set(
        listing.id,
        state.prices.get(listing.id) ?? { status: "queued" },
      );
    }
    for (const id of items.keys()) {
      if (!ids.has(id)) items.delete(id);
    }
    for (const id of needsSearch) {
      if (!ids.has(id)) needsSearch.delete(id);
    }
    setPrices(prices);
    if (!running) void run();
  }

  /** Stops the timer and the running search, and forgets every price. */
  function stop() {
    runId++;
    running = false;
    clearTimeout(timer);
    items.clear();
    needsSearch.clear();
    resumeAt = 0;
    setPrices(new Map());
    Object.assign(state, {
      status: "off",
      error: null,
      pricing: null,
      nextSearchAt: null,
    });
  }

  return { state, sync, stop };
}

export type StashPricer = ReturnType<typeof createStashPricer>;
