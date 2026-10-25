import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { artificialSlowdown } from "@/web/price-check/trade/artificial-slowdown";

const MS = 900;

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("artificialSlowdown", () => {
  it("is ready the given time after it is first read", () => {
    const slowdown = artificialSlowdown(MS);

    expect(slowdown.isReady.value).toBe(false);
    vi.advanceTimersByTime(MS - 1);
    expect(slowdown.isReady.value).toBe(false);
    vi.advanceTimersByTime(1);
    expect(slowdown.isReady.value).toBe(true);
  });

  it("waits again after a reset with new data, and not after one with the same data", () => {
    const slowdown = artificialSlowdown(MS);
    const listing = { id: 1 };
    slowdown.reset(listing);
    expect(slowdown.isReady.value).toBe(false);
    vi.advanceTimersByTime(MS);
    expect(slowdown.isReady.value).toBe(true);

    slowdown.reset(listing);
    expect(slowdown.isReady.value).toBe(true);

    slowdown.reset({ id: 2 });
    expect(slowdown.isReady.value).toBe(false);
    vi.advanceTimersByTime(MS);
    expect(slowdown.isReady.value).toBe(true);
  });

  it("waits again after each reset without data", () => {
    const slowdown = artificialSlowdown(MS);
    expect(slowdown.isReady.value).toBe(false);
    vi.advanceTimersByTime(MS);

    slowdown.reset();

    expect(slowdown.isReady.value).toBe(false);
  });

  it("drops the wait that a reset ends early", () => {
    const slowdown = artificialSlowdown(MS);
    expect(slowdown.isReady.value).toBe(false);
    vi.advanceTimersByTime(MS - 100);

    slowdown.reset({ id: 2 });
    expect(slowdown.isReady.value).toBe(false);
    vi.advanceTimersByTime(100);
    expect(slowdown.isReady.value).toBe(false);
    vi.advanceTimersByTime(MS - 100);
    expect(slowdown.isReady.value).toBe(true);
  });
});
