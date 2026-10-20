import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useStopwatch } from "@/web/stopwatch/stopwatch";

let hidden: boolean | undefined;
let stopwatch: ReturnType<typeof useStopwatch>;

function shown() {
  const { h, m, s } = stopwatch.formatted.value;
  return `${h}:${m}:${s}`;
}

/** Moves the clock forward and runs the widget's tick, as its one second interval does. */
function wait(ms: number) {
  vi.advanceTimersByTime(ms);
  stopwatch.updateTime();
}

beforeEach(() => {
  vi.useFakeTimers();
  hidden = undefined;
  stopwatch = useStopwatch((value) => {
    hidden = value;
  });
});

afterEach(() => {
  vi.useRealTimers();
});

describe("useStopwatch", () => {
  it("counts the time while it runs", () => {
    stopwatch.start();
    wait(3_725_000);

    expect(shown()).toBe("01:02:05");
    expect(hidden).toBe(false);
  });

  it("shows zero after a reset while it runs, and counts on from there", () => {
    stopwatch.start();
    wait(5000);

    stopwatch.reset();
    expect(shown()).toBe("00:00:00");
    expect(stopwatch.isRunning.value).toBe(true);
    expect(hidden).toBe(false);

    wait(2000);
    expect(shown()).toBe("00:00:02");
  });

  it("stays on screen when paused at one second or more", () => {
    stopwatch.start();
    wait(1000);
    stopwatch.stop();

    expect(stopwatch.isRunning.value).toBe(false);
    expect(hidden).toBe(false);
    wait(5000);
    expect(shown()).toBe("00:00:01");
  });

  it("closes with the overlay when paused under one second or reset while paused", () => {
    stopwatch.start();
    wait(999);
    stopwatch.stop();
    expect(hidden).toBe(true);

    stopwatch.start();
    wait(4000);
    stopwatch.stop();
    expect(hidden).toBe(false);
    stopwatch.reset();
    expect(shown()).toBe("00:00:00");
    expect(hidden).toBe(true);
  });
});
