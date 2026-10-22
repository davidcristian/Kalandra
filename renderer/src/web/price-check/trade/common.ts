import { shallowReactive } from "vue";
import type { ItemFilters, StatFilter } from "../filters/interfaces";
import { AppConfig } from "@/web/Config";
import type { PriceCheckWidget } from "@/web/overlay/interfaces";
import { RateLimiter } from "./RateLimiter";
import { ParsedItem, ItemCategory } from "@/parser";
export { poeWebApi as getTradeEndpoint } from "@/web/Config";

export interface Account {
  name: string;
  lastCharacterName: string;
  online?: {
    status?: "afk";
  };
}

export type TradeResponse<T> =
  | (T & { error?: null })
  | {
      error: {
        code: number;
        message: string;
      };
    };

export function apiToSatisfySearch(
  item: ParsedItem,
  stats: StatFilter[],
  filters: ItemFilters,
): "trade" | "bulk" {
  if (stats.some((s) => !s.disabled)) {
    return "trade";
  }

  if (filters.stackSize) {
    if (
      item.category === ItemCategory.DivinationCard ||
      item.category === ItemCategory.Map
    ) {
      return filters.stackSize.disabled ? "trade" : "bulk";
    }
  }

  return tradeTag(item) != null ? "bulk" : "trade";
}

export function tradeTag(item: ParsedItem): string | undefined {
  return item.info.tradeTag;
}

type ListingType = ItemFilters["trade"]["listingType"];

/** Returns the status an item search sends, since it has no Online in League option. */
export function searchListingType(
  type: ListingType,
): Exclude<ListingType, "onlineleague"> {
  return type === "onlineleague" ? "securable" : type;
}

/** Returns the status a currency exchange sends, since it has no Instant options. */
export function exchangeListingType(
  type: ListingType,
): Exclude<ListingType, "securable" | "available"> {
  return type === "securable" || type === "available" ? "online" : type;
}

export const RATE_LIMIT_RULES = {
  SEARCH: shallowReactive(new Set([new RateLimiter(1, 5)])),
  EXCHANGE: shallowReactive(new Set([new RateLimiter(1, 5)])),
  FETCH: shallowReactive(new Set([new RateLimiter(1, 5)])),
  // WHISPER: shallowReactive(new Set([new RateLimiter(1, 5)])),
  // HISTORY: shallowReactive(new Set([new RateLimiter(1, 5)])),
};

interface ServerLimit {
  max: number;
  window: number;
  state: number;
  restriction: number;
}

// A rule name becomes part of a header name, and Headers.get throws on an invalid name
const RULE_NAME = /^[\w-]+$/;

export function adjustRateLimits(
  clientLimits: Set<RateLimiter>,
  headers: Headers,
): void {
  const rules = headers.get("x-rate-limit-rules");
  if (rules != null) {
    const { serverLimits, readAllRules } = readRules(headers, rules);
    _adjustRateLimits(clientLimits, serverLimits, readAllRules);
  }

  const retryAfter = readRetryAfter(headers.get("retry-after"));
  if (retryAfter > 0) {
    for (const limit of clientLimits) {
      limit.restrict(retryAfter);
    }
  }
}

function readRules(headers: Headers, rules: string) {
  const extraWindow =
    AppConfig<PriceCheckWidget>("price-check")!.apiLatencySeconds;
  const serverLimits: ServerLimit[] = [];
  let readAllRules = true;
  for (const rule of rules.split(",")) {
    const limits = readRule(headers, rule.trim(), extraWindow);
    if (limits) {
      serverLimits.push(...limits);
    } else {
      readAllRules = false;
    }
  }
  return { serverLimits, readAllRules };
}

function readRule(
  headers: Headers,
  rule: string,
  extraWindow: number,
): ServerLimit[] | undefined {
  const isValidName = RULE_NAME.test(rule);
  const limitStr = isValidName ? headers.get(`x-rate-limit-${rule}`) : null;
  const stateStr = isValidName
    ? headers.get(`x-rate-limit-${rule}-state`)
    : null;
  const limits = limitStr?.split(",").map(readNumbers) ?? [];
  const states = stateStr?.split(",").map(readNumbers) ?? [];

  const isReadable =
    limits.length > 0 &&
    limits.length === states.length &&
    limits.every(
      ([max, window]) =>
        isCount(max) && max > 0 && Number.isFinite(window) && window > 0,
    ) &&
    states.every(
      ([hits, , restriction = 0]) =>
        isCount(hits) && Number.isFinite(restriction) && restriction >= 0,
    );
  if (!isReadable) {
    console.warn(
      `Skipped rate limit rule "${rule}": limit header "${limitStr}", state header "${stateStr}"`,
    );
    return undefined;
  }

  return limits.map(([max, window], idx) => {
    const [hits, , restriction = 0] = states[idx];
    return { max, window: window + extraWindow, state: hits, restriction };
  });
}

function readRetryAfter(value: string | null): number {
  if (value == null) return 0;

  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) return seconds;

  console.warn(
    `Ignored Retry-After header "${value}": not a number of seconds`,
  );
  return 0;
}

function readNumbers(entry: string): number[] {
  return entry.split(":").map(Number);
}

function isCount(value: number): boolean {
  return Number.isInteger(value) && value >= 0;
}

function _adjustRateLimits(
  clientLimits: Set<RateLimiter>,
  limitRule: ServerLimit[],
  removeOtherLimits: boolean,
): void {
  // destroy, unless a rule was skipped: its limiter cannot be told apart from the old ones
  if (removeOtherLimits) {
    for (const limit of clientLimits) {
      const isActive = limitRule.some((serverLimit) =>
        limit.isEqualLimit(serverLimit),
      );
      if (!isActive) {
        clientLimits.delete(limit);
        limit.destroy();
      }
    }
  }

  // compare client<>server state
  for (const limit of clientLimits) {
    const serverLimit = limitRule.find((serverLimit) =>
      limit.isEqualLimit(serverLimit),
    );
    if (!serverLimit) continue;
    const delta = serverLimit.state - limit.stack.length;
    if (delta > 0) limit.addHits(delta);
  }

  // add new
  serverLimits: for (const serverLimit of limitRule) {
    for (const limit of clientLimits) {
      if (limit.isEqualLimit(serverLimit)) continue serverLimits;
    }

    const rl = new RateLimiter(serverLimit.max, serverLimit.window);
    clientLimits.add(rl);
    rl.addHits(serverLimit.state);
  }

  // The third field of a state entry is the seconds left of a restriction
  // (https://www.pathofexile.com/developer/docs#ratelimits)
  for (const serverLimit of limitRule) {
    if (serverLimit.restriction === 0) continue;
    for (const limit of clientLimits) {
      if (limit.isEqualLimit(serverLimit)) {
        limit.restrict(serverLimit.restriction);
      }
    }
  }
}

export function preventQueueCreation(
  targets: Array<{ count: number; limiters: Iterable<RateLimiter> }>,
) {
  const estimatedMillis = Math.max(
    ...targets.map((target) => {
      const estimated = RateLimiter.estimateTime(target.count, target.limiters);
      const estimatedCleanState = RateLimiter.estimateTime(
        target.count,
        target.limiters,
        true,
      );

      // ignore if impossible to run without queue
      return estimated === estimatedCleanState ? 0 : estimated;
    }),
  );

  if (estimatedMillis >= 1500) {
    throw new Error(
      `Retry after ${Math.round(estimatedMillis / 1000)} seconds`,
    );
  }
}
