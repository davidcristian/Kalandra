import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { setupTests } from "@specs/vitest.setup";
import type { PriceCheckWidget } from "@/web/overlay/interfaces";
import { adjustRateLimits } from "@/web/price-check/trade/common";
import { RateLimiter } from "@/web/price-check/trade/RateLimiter";

// Hand-written in the format the trade site sends with a search response
const SEARCH_HEADERS = {
  "x-rate-limit-policy": "trade-search-request-limit",
  "x-rate-limit-rules": "Account,Ip",
  "x-rate-limit-account": "3:5:60",
  "x-rate-limit-account-state": "1:5:0",
  "x-rate-limit-ip": "8:10:60,15:60:300,60:300:1800",
  "x-rate-limit-ip-state": "1:10:0,1:60:0,1:300:0",
};

// Each window is longer by apiLatencySeconds, which is 2 here
const SEARCH_LIMITS = [
  { max: 3, window: 7, hits: 1 },
  { max: 8, window: 12, hits: 1 },
  { max: 15, window: 62, hits: 1 },
  { max: 60, window: 302, hits: 1 },
];

function headersWith(changes: Record<string, string | null>): Headers {
  const headers = new Headers(SEARCH_HEADERS);
  for (const [name, value] of Object.entries(changes)) {
    if (value == null) headers.delete(name);
    else headers.set(name, value);
  }
  return headers;
}

function describeLimits(limits: Set<RateLimiter>) {
  return Array.from(limits, (limit) => ({
    max: limit.max,
    window: limit.window,
    hits: limit.stack.length,
  }));
}

describe("adjustRateLimits", () => {
  let warnings: string[];

  beforeEach(() => {
    vi.useFakeTimers();
    setupTests({
      widgets: [
        { wmType: "price-check", apiLatencySeconds: 2 } as PriceCheckWidget,
      ],
    });
    warnings = [];
    vi.spyOn(console, "warn").mockImplementation((message: string) => {
      warnings.push(message);
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("replaces the starting limit with the rules in the headers", () => {
    const limits = new Set([new RateLimiter(1, 5)]);

    adjustRateLimits(limits, new Headers(SEARCH_HEADERS));

    expect(describeLimits(limits)).toEqual(SEARCH_LIMITS);
    expect(warnings).toEqual([]);
  });

  it("changes nothing for a response without x-rate-limit-rules", () => {
    const limits = new Set([new RateLimiter(1, 5)]);

    adjustRateLimits(limits, new Headers({ "content-type": "text/html" }));

    expect(describeLimits(limits)).toEqual([{ max: 1, window: 5, hits: 0 }]);
  });

  it.each([
    ["has no limit header", { "x-rate-limit-ip": null }],
    ["has no state header", { "x-rate-limit-ip-state": null }],
    ["has a limit that is not a number", { "x-rate-limit-ip": "8:ten:60" }],
    ["has a limit of 0 requests", { "x-rate-limit-ip": "0:10:60" }],
    ["has a state that is not a number", { "x-rate-limit-ip-state": "a:b:c" }],
    ["has fewer states than limits", { "x-rate-limit-ip-state": "1:10:0" }],
    ["is not a valid header name", { "x-rate-limit-rules": "Account,I p" }],
  ])(
    "keeps the current limits when a rule %s, and adds the readable rules",
    async (_, changes) => {
      const starting = new RateLimiter(1, 5);
      const limits = new Set([starting]);

      adjustRateLimits(limits, headersWith(changes));

      expect(describeLimits(limits)).toEqual([
        { max: 1, window: 5, hits: 0 },
        SEARCH_LIMITS[0],
      ]);
      expect(warnings).toHaveLength(1);
      expect(warnings[0]).toMatch(/^Skipped rate limit rule "I ?p"/);
      await expect(RateLimiter.waitMulti(limits)).resolves.toBeUndefined();
      expect(starting.stack.length).toBe(1);
    },
  );

  it("keeps the current limits when the rules header is empty", () => {
    const limits = new Set([new RateLimiter(1, 5)]);

    adjustRateLimits(limits, headersWith({ "x-rate-limit-rules": "" }));

    expect(describeLimits(limits)).toEqual([{ max: 1, window: 5, hits: 0 }]);
    expect(warnings).toEqual([
      'Skipped rate limit rule "": limit header "null", state header "null"',
    ]);
  });

  it("removes the limits of the rules the next readable response leaves out", () => {
    const limits = new Set([new RateLimiter(1, 5)]);
    adjustRateLimits(limits, headersWith({ "x-rate-limit-ip": null }));

    adjustRateLimits(
      limits,
      headersWith({
        "x-rate-limit-rules": "Account",
        "x-rate-limit-account-state": "2:5:0",
      }),
    );

    expect(describeLimits(limits)).toEqual([{ max: 3, window: 7, hits: 2 }]);
  });

  it("counts no more hits for a new rule than the rule allows", () => {
    const limits = new Set<RateLimiter>();

    adjustRateLimits(
      limits,
      headersWith({
        "x-rate-limit-rules": "Account",
        "x-rate-limit-account-state": "5:5:0",
      }),
    );

    const [account] = limits;
    expect(account.stack.length).toBe(3);
    expect(account.queue.value).toBe(0);
  });
});
