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
    [
      "has a restriction that is not a number",
      { "x-rate-limit-ip-state": "1:10:x,1:60:0,1:300:0" },
    ],
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

  it("counts every hit the server reports beyond the client's own", () => {
    const limits = new Set<RateLimiter>();
    adjustRateLimits(limits, accountState("0:5:0"));

    adjustRateLimits(limits, accountState("3:5:0"));

    expect(describeLimits(limits)).toEqual([{ max: 3, window: 7, hits: 3 }]);
  });

  it("holds the set for the restriction time in the state header", async () => {
    const limits = new Set([new RateLimiter(1, 5)]);

    adjustRateLimits(
      limits,
      headersWith({ "x-rate-limit-account-state": "4:5:60" }),
    );

    expect(RateLimiter.estimateTime(1, limits)).toBe(60_000);
    let sent = false;
    void RateLimiter.waitMulti(limits).then(() => {
      sent = true;
    });
    await vi.advanceTimersByTimeAsync(59_999);
    expect(sent).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(sent).toBe(true);
  });

  it("counts the hits of a restricted set without waiting", () => {
    const limits = new Set<RateLimiter>();
    adjustRateLimits(limits, accountState("1:5:60"));

    adjustRateLimits(limits, accountState("3:5:59"));

    const [account] = limits;
    expect(account.stack.length).toBe(3);
    expect(account.queue.value).toBe(0);
  });

  it("holds every limiter in the set for the seconds in Retry-After", () => {
    const starting = new Set([new RateLimiter(1, 5)]);
    const replaced = new Set([new RateLimiter(1, 5)]);

    adjustRateLimits(starting, new Headers({ "retry-after": "30" }));
    adjustRateLimits(replaced, headersWith({ "retry-after": "45" }));

    expect(RateLimiter.estimateTime(1, starting)).toBe(30_000);
    expect(replaced.size).toBe(4);
    for (const limit of replaced) {
      expect(RateLimiter.estimateTime(1, [limit])).toBe(45_000);
    }
  });

  it("ignores a Retry-After that is not a number of seconds", () => {
    const limits = new Set([new RateLimiter(1, 5)]);
    const date = "Wed, 21 Oct 2026 07:28:00 GMT";

    adjustRateLimits(limits, new Headers({ "retry-after": date }));

    expect(RateLimiter.estimateTime(1, limits)).toBe(0);
    expect(warnings).toEqual([
      `Ignored Retry-After header "${date}": not a number of seconds`,
    ]);
  });
});

function accountState(state: string): Headers {
  return headersWith({
    "x-rate-limit-rules": "Account",
    "x-rate-limit-account-state": state,
  });
}
