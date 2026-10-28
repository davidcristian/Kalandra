<template>
  <div class="mt-1" :class="{ 'text-gray-500': !state.open }" :title="gridText">
    {{ text }}
  </div>
</template>

<script lang="ts">
import { computed, defineComponent } from "vue";
import { useI18nNs } from "@/web/i18n";
import type { CaptureStatus } from "./stash-detector";
import { useStashDetector } from "./use-stash-detector";

const CAPTURE_TEXT: Record<CaptureStatus, string> = {
  "browser": "stash_prices.capture_browser",
  "not-windows": "stash_prices.capture_not_windows",
  "off": "stash_prices.capture_off",
  "few-items": "stash_prices.capture_few_items",
  "paused": "stash_prices.capture_paused",
  "starting": "stash_prices.capture_starting",
  "running": "stash_prices.capture_running",
  "failed": "stash_prices.capture_failed",
};

const percent = (share: number) => Math.round(share * 100);

export default defineComponent({
  setup() {
    const { t } = useI18nNs("stash_prices");
    const { state } = useStashDetector();

    const seenText = computed(() => {
      if (state.source === "hotkey") {
        return t(state.open ? ":tab_shown" : ":tab_hidden");
      }
      return t(state.open ? ":tab_seen" : ":tab_not_seen");
    });
    const captureText = computed(() => {
      if (state.capture === "running" && state.match === null) {
        return t(":capture_starting");
      }
      return t(CAPTURE_TEXT[state.capture], {
        error: state.error ?? "",
        items: percent(state.match?.items ?? 0),
        cells: percent(state.match?.cells ?? 0),
      });
    });

    return {
      state,
      text: computed(() => `${seenText.value} ${captureText.value}`),
      // In pixels of the game window, as a screenshot measures them
      gridText: computed(() => {
        const scale = window.devicePixelRatio;
        const round = (value: number) => Math.round(value * scale * 10) / 10;
        return t(":grid_at", {
          left: round(state.grid.left),
          top: round(state.grid.top),
          cell: round(state.grid.cell),
        });
      }),
    };
  },
});
</script>
