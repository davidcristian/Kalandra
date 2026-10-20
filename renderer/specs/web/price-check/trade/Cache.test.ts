import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Cache, CACHE_TTL } from "@/web/price-check/trade/Cache";

const KEY = [{ query: { status: { option: "securable" } } }, "Standard"];

describe("Cache", () => {
  let cache: Cache;

  beforeEach(() => {
    vi.useFakeTimers();
    cache = new Cache();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("keeps a value for 300 seconds by default", () => {
    cache.set(KEY, "result");

    vi.advanceTimersByTime(CACHE_TTL * 1000 - 1);
    expect(cache.get(KEY)).toBe("result");
    vi.advanceTimersByTime(1);
    expect(cache.get(KEY)).toBeUndefined();
    expect(CACHE_TTL).toBe(300);
  });

  it("finds a value by a key equal to the one it was stored with", () => {
    cache.set(KEY, "result", 10);

    expect(cache.get(structuredClone(KEY))).toBe("result");
    expect(cache.get([KEY[0], "Hardcore"])).toBeUndefined();
  });

  it("counts the time from the last write of a key", () => {
    cache.set(KEY, "old", 10);
    vi.advanceTimersByTime(6_000);
    cache.set(KEY, "new", 10);

    vi.advanceTimersByTime(9_999);
    expect(cache.get(KEY)).toBe("new");
    vi.advanceTimersByTime(1);
    expect(cache.get(KEY)).toBeUndefined();
  });

  it("keeps a value stored again after a currency change for its full time", () => {
    cache.purgeIfDifferentCurrency("exalted");
    cache.set(KEY, "in exalted", 10);
    vi.advanceTimersByTime(6_000);

    cache.purgeIfDifferentCurrency("divine");
    expect(cache.get(KEY)).toBeUndefined();
    cache.set(KEY, "in divine", 10);

    vi.advanceTimersByTime(9_999);
    expect(cache.get(KEY)).toBe("in divine");
  });

  it.each([undefined, "", "exalted"])(
    "keeps every value when the currency is %j",
    (currency) => {
      cache.purgeIfDifferentCurrency("exalted");
      cache.set(KEY, "result", 10);

      cache.purgeIfDifferentCurrency(currency);

      expect(cache.get(KEY)).toBe("result");
    },
  );
});
