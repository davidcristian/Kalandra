import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { preventQueueCreation } from "@/web/price-check/trade/common";
import { RateLimiter } from "@/web/price-check/trade/RateLimiter";

function track(request: Promise<void>) {
  const state = { sent: false };
  void request.then(() => {
    state.sent = true;
  });
  return state;
}

describe("RateLimiter", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("holds a request until the window of the oldest request ends", async () => {
    const limiter = new RateLimiter(1, 5);
    await limiter.wait();

    const request = track(limiter.wait());

    await vi.advanceTimersByTimeAsync(4_999);
    expect(request.sent).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(request.sent).toBe(true);
  });

  it("holds every request until a restriction ends", async () => {
    const limiter = new RateLimiter(10, 5);
    limiter.restrict(60);

    const request = track(RateLimiter.waitMulti([limiter]));

    await vi.advanceTimersByTimeAsync(59_999);
    expect(request.sent).toBe(false);
    expect(limiter.queue.value).toBe(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(request.sent).toBe(true);
    expect(limiter.isRestricted).toBe(false);
    expect(limiter.stack.length).toBe(1);
  });

  it("holds a request when a limiter is restricted while it waits on another", async () => {
    const restricted = new RateLimiter(10, 5);
    const full = new RateLimiter(1, 5);
    await full.wait();
    const request = track(RateLimiter.waitMulti([restricted, full]));

    await vi.advanceTimersByTimeAsync(1_000);
    restricted.restrict(60);
    await vi.advanceTimersByTimeAsync(4_000);
    expect(request.sent).toBe(false);
    await vi.advanceTimersByTimeAsync(56_000);
    expect(request.sent).toBe(true);
  });

  it("keeps a longer restriction when a shorter one follows", () => {
    const limiter = new RateLimiter(10, 5);

    limiter.restrict(60);
    limiter.restrict(10);
    expect(RateLimiter.estimateTime(1, [limiter])).toBe(60_000);

    limiter.restrict(90);
    expect(RateLimiter.estimateTime(1, [limiter])).toBe(90_000);
  });

  it("adds a restriction to the estimate, and preventQueueCreation reports it", () => {
    const limiter = new RateLimiter(10, 5);
    limiter.restrict(30);

    expect(RateLimiter.estimateTime(1, [limiter])).toBe(30_000);
    expect(RateLimiter.estimateTime(1, [limiter], true)).toBe(0);
    expect(() =>
      preventQueueCreation([{ count: 1, limiters: [limiter] }]),
    ).toThrow("Retry after 30 seconds");
  });

  it("lets preventQueueCreation pass a request that needs no wait", () => {
    const limiter = new RateLimiter(2, 5);

    expect(() =>
      preventQueueCreation([{ count: 1, limiters: [limiter] }]),
    ).not.toThrow();
  });

  it("counts reported hits without waiting, up to the free slots", () => {
    const limiter = new RateLimiter(3, 5);
    limiter.restrict(60);

    limiter.addHits(2);
    limiter.addHits(2);

    expect(limiter.stack.length).toBe(3);
    expect(limiter.queue.value).toBe(0);
  });

  it("moves a request held by a restriction to the limiter that replaces it", async () => {
    const old = new RateLimiter(10, 5);
    const replacement = new RateLimiter(10, 5);
    const limits = new Set([old]);
    await old.wait();
    old.restrict(60);
    const request = track(RateLimiter.waitMulti(limits));
    await vi.advanceTimersByTimeAsync(0);

    limits.delete(old);
    limits.add(replacement);
    old.destroy();
    await vi.advanceTimersByTimeAsync(0);

    expect(request.sent).toBe(true);
    expect(replacement.stack.length).toBe(1);
  });

  it("sends a request, and logs that a limiter destroyed after the wait did not count it", async () => {
    const warnings: string[] = [];
    vi.spyOn(console, "warn").mockImplementation((text: string) => {
      warnings.push(text);
    });
    const removed = new RateLimiter(10, 5);
    const kept = new RateLimiter(10, 5);

    const request = RateLimiter.waitMulti([removed, kept]);
    removed.destroy();
    await request;

    expect(removed.stack.length).toBe(0);
    expect(kept.stack.length).toBe(1);
    expect(warnings).toEqual([
      "Did not count a request against a removed rate limit:",
    ]);
  });

  it("restricts nothing once destroyed", () => {
    const limiter = new RateLimiter(10, 5);
    limiter.destroy();

    limiter.restrict(60);

    expect(limiter.isRestricted).toBe(false);
  });
});
