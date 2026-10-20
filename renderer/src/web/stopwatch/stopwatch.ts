import { computed, ref } from "vue";
import { Duration } from "luxon";

/** Keeps a stopwatch's time, and calls `setHidden` with whether it closes with the overlay. */
export function useStopwatch(setHidden: (hidden: boolean) => void) {
  const isRunning = ref(false);
  const millis = ref(0);
  let prevTick = 0;

  const formatted = computed(() => {
    const dur = Duration.fromMillis(millis.value).shiftTo(
      "hours",
      "minutes",
      "seconds",
    );

    return {
      h: String(dur.hours).padStart(2, "0"),
      m: String(dur.minutes).padStart(2, "0"),
      s: String(Math.floor(dur.seconds)).padStart(2, "0"),
    };
  });

  function start() {
    isRunning.value = true;
    prevTick = Date.now();
    setHidden(false);
  }
  function stop() {
    updateTime();
    isRunning.value = false;
    if (millis.value < 1000) {
      setHidden(true);
    }
  }
  function reset() {
    prevTick = Date.now();
    millis.value = 0;
    if (!isRunning.value) {
      setHidden(true);
    }
  }
  function updateTime() {
    if (isRunning.value) {
      const now = Date.now();
      millis.value += now - prevTick;
      prevTick = now;
    }
  }

  return { isRunning, formatted, start, stop, reset, updateTime };
}
