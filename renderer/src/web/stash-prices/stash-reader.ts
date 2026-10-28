import { shallowReactive } from "vue";
import { logToMain } from "@/web/background/log-to-main";
import { RATE_LIMIT_RULES } from "@/web/price-check/trade/common";
import type { StashListing } from "./stash-listings";
import {
  hasQueue,
  holdForFetch,
  type PauseReason,
  RETRY_MS,
  sendFetch,
  sendSearch,
  threeHourSearchCount,
  waitTime,
} from "./stash-requests";
import {
  clampBudget,
  clampInterval,
  type ReaderSettings,
} from "./reader-settings";

// The trade site returns at most 10 listings per fetch request
const FETCH_SIZE = 10;

/** What the reader reads from the app, each time it needs the value. */
export interface ReaderSources {
  settings: () => ReaderSettings;
  accountName: () => string;
  leagueId: () => string | undefined;
  priceCheckShown: () => boolean;
}

export type ReaderStatus =
  | "off"
  | "no-account"
  | "no-league"
  | "budget-reached"
  | PauseReason
  | "checking"
  | "waiting"
  | "error";

export interface ReaderState {
  status: ReaderStatus;
  error: string | null;
  /** The listings in the tab, newest first. */
  listings: StashListing[];
  /** The count of the account's listings without a price that the last search reported. */
  total: number | null;
  /** The ids the last search returned, at most 100. */
  read: number;
  lastCheckAt: number | null;
  nextCheckAt: number | null;
}

type RunEnd = "done" | "stopped" | PauseReason;

/** Creates the reader that searches the account's listings without a price every interval and keeps those in the tab. */
export function createStashReader(sources: ReaderSources) {
  const state = shallowReactive<ReaderState>({
    status: "off",
    error: null,
    listings: [],
    total: null,
    read: 0,
    lastCheckAt: null,
    nextCheckAt: null,
  });
  // Each fetched id, with its listing, or null when the fetch had no readable listing for it
  const fetched = new Map<string, StashListing | null>();
  let fetchedFor: string | null = null;
  let order: string[] = [];
  let timer: ReturnType<typeof setTimeout> | undefined;
  let runId = 0;
  let running = false;
  let loggedError: string | null = null;

  const intervalMs = (settings: ReaderSettings) =>
    clampInterval(settings.intervalMinutes) * 60_000;

  const keyOf = (settings: ReaderSettings) =>
    JSON.stringify([
      sources.leagueId() ?? "",
      sources.accountName().trim(),
      settings.tabName,
    ]);

  function schedule(delayMs: number) {
    clearTimeout(timer);
    state.nextCheckAt = Date.now() + delayMs;
    timer = setTimeout(() => {
      void check();
    }, delayMs);
  }

  function reasonToWait(settings: ReaderSettings): ReaderStatus | null {
    if (!sources.accountName().trim()) return "no-account";
    if (!sources.leagueId()) return "no-league";
    if (sources.priceCheckShown()) return "price-check-open";
    if (hasQueue(RATE_LIMIT_RULES.SEARCH)) return "busy";
    const searches = threeHourSearchCount() ?? 0;
    if (searches >= clampBudget(settings.searchBudget)) return "budget-reached";
    if (waitTime(RATE_LIMIT_RULES.SEARCH) > 0) return "rate-limited";
    return null;
  }

  function publish(tabName: string) {
    state.listings = order.flatMap((id) => {
      const listing = fetched.get(id);
      return listing?.stashName === tabName ? [listing] : [];
    });
  }

  async function read(
    id: number,
    settings: ReaderSettings,
    deadline: number,
  ): Promise<RunEnd> {
    const key = keyOf(settings);
    if (key !== fetchedFor) {
      fetched.clear();
      order = [];
      fetchedFor = key;
    }
    const search = await sendSearch(
      sources.accountName().trim(),
      sources.leagueId() ?? "",
    );
    if (id !== runId) return "stopped";

    const listed = new Set(search.ids);
    for (const fetchedId of [...fetched.keys()]) {
      if (!listed.has(fetchedId)) fetched.delete(fetchedId);
    }
    order = search.ids;
    state.total = search.total;
    state.read = search.ids.length;
    publish(settings.tabName);

    // The search gives no sign that an item moved, so each check reads every listing's place again
    for (let start = 0; start < search.ids.length; start += FETCH_SIZE) {
      const end = await holdForFetch({
        priceCheckShown: sources.priceCheckShown,
        deadline,
        stopped: () => id !== runId,
        onPause: (reason) => {
          state.status = reason;
        },
      });
      if (end) return end;
      state.status = "checking";
      const chunk = search.ids.slice(start, start + FETCH_SIZE);
      const listings = await sendFetch(search.queryId, chunk);
      if (id !== runId) return "stopped";
      for (const listingId of chunk) {
        fetched.set(listingId, listings.get(listingId) ?? null);
      }
      publish(settings.tabName);
    }
    return "done";
  }

  function fail(error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    state.status = "error";
    state.error = message;
    state.lastCheckAt = Date.now();
    console.warn("[stash-prices] The stash tab check failed:", error);
    if (message !== loggedError) {
      loggedError = message;
      logToMain(
        "warn",
        `[stash-prices] The stash tab check failed: ${message}`,
      );
    }
  }

  async function check(): Promise<void> {
    if (running) return;
    clearTimeout(timer);
    state.nextCheckAt = null;
    const settings = sources.settings();
    if (!settings.enabled) {
      stop();
      return;
    }
    const reason = reasonToWait(settings);
    if (reason) {
      state.status = reason;
      schedule(reason === "budget-reached" ? intervalMs(settings) : RETRY_MS);
      return;
    }

    const id = ++runId;
    running = true;
    state.status = "checking";
    state.error = null;
    try {
      const end = await read(id, settings, Date.now() + intervalMs(settings));
      if (end === "stopped") return;
      if (end === "done") {
        state.status = "waiting";
        state.lastCheckAt = Date.now();
        loggedError = null;
        schedule(intervalMs(settings));
      } else {
        state.status = end;
        schedule(RETRY_MS);
      }
    } catch (error) {
      if (id !== runId) return;
      fail(error);
      schedule(intervalMs(settings));
    } finally {
      if (id === runId) running = false;
    }
  }

  function forget() {
    fetched.clear();
    fetchedFor = null;
    order = [];
    Object.assign(state, { listings: [], total: null, read: 0 });
  }

  /** Stops the timer and the running check, and forgets every listing. */
  function stop() {
    runId++;
    running = false;
    clearTimeout(timer);
    forget();
    Object.assign(state, {
      status: "off",
      error: null,
      lastCheckAt: null,
      nextCheckAt: null,
    });
  }

  /** Applies changed settings: stops when off, forgets the listings and checks at once for another tab, account or league. */
  function refresh() {
    const settings = sources.settings();
    if (!settings.enabled) {
      stop();
      return;
    }
    const changed = fetchedFor !== null && keyOf(settings) !== fetchedFor;
    if (running && !changed) return;
    if (running) {
      runId++;
      running = false;
    }
    if (changed) forget();
    const due =
      state.lastCheckAt === null || changed
        ? Date.now()
        : state.lastCheckAt + intervalMs(settings);
    schedule(Math.max(0, Math.min(due, state.nextCheckAt ?? due) - Date.now()));
  }

  /** Checks at once, unless a check runs; the budget and the pauses still apply. */
  function checkNow(): Promise<void> {
    return check();
  }

  return { state, refresh, checkNow, stop };
}

export type StashReader = ReturnType<typeof createStashReader>;
