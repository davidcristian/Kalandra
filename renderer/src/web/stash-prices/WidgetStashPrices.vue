<template>
  <Widget
    :config="config"
    :removable="false"
    :inline-edit="false"
    move-handles="corners"
  >
    <div :class="$style.panel">
      <div class="font-semibold mb-1">
        {{ t(":tab", { name: config.tabName }) }}
      </div>
      <div>{{ t(":items_in_tab", { count: state.listings.length }) }}</div>
      <div>{{ t(":last_check", { time: lastCheck }) }}</div>
      <div v-if="nextCheck">{{ t(":next_check", { time: nextCheck }) }}</div>
      <div>{{ t(":searches", { count: searches, budget }) }}</div>
      <div v-if="onlyNewest" class="text-orange-400">
        {{ t(":only_newest", { read: state.read, total: state.total }) }}
      </div>
      <div :class="statusClass" class="mt-1">{{ statusText }}</div>
      <pricing-panel :config="config" />
      <button
        class="btn mt-2"
        :disabled="state.status === 'checking'"
        @click="checkNow"
      >
        {{ t(":check_now") }}
      </button>
    </div>
  </Widget>
</template>

<script lang="ts">
import { computed, defineComponent, PropType, watch } from "vue";
import { DateTime } from "luxon";
import Widget from "../overlay/Widget.vue";
import PricingPanel from "./PricingPanel.vue";
import type { WidgetSpec } from "../overlay/interfaces";
import { AppConfig } from "@/web/Config";
import { useLeagues } from "@/web/background/Leagues";
import { useI18nNs } from "@/web/i18n";
import { RATE_LIMIT_RULES } from "@/web/price-check/trade/common";
import { clampBudget } from "./reader-settings";
import type { ReaderStatus } from "./stash-reader";
import { threeHourSearchCount } from "./stash-requests";
import { useStashPricer } from "./use-stash-pricer";
import { useStashReader } from "./use-stash-reader";
import { stashPricesDefault, type StashPricesWidget } from "./widget";

const STATUS_TEXT: Record<ReaderStatus, string> = {
  "off": "stash_prices.status_off",
  "no-account": "stash_prices.status_no_account",
  "no-league": "stash_prices.status_no_league",
  "price-check-open": "stash_prices.status_price_check_open",
  "busy": "stash_prices.status_busy",
  "budget-reached": "stash_prices.status_budget_reached",
  "rate-limited": "stash_prices.status_rate_limited",
  "checking": "stash_prices.status_checking",
  "waiting": "stash_prices.status_waiting",
  "error": "stash_prices.status_error",
};

function clockTime(millis: number): string {
  return DateTime.fromMillis(millis).toLocaleString(DateTime.TIME_SIMPLE);
}

export default defineComponent({
  widget: {
    type: "stash-prices",
    instances: "single",
    initInstance: stashPricesDefault,
  } satisfies WidgetSpec,
  components: { Widget, PricingPanel },
  props: {
    config: {
      type: Object as PropType<StashPricesWidget>,
      required: true,
    },
  },
  setup(props) {
    const { t } = useI18nNs("stash_prices");
    const reader = useStashReader();
    // The pricer follows the reader's listings from here on
    useStashPricer();
    const leagues = useLeagues();
    const { state } = reader;

    // OverlayWindow.vue mounts every widget at start, so the reader runs while the panel is hidden
    watch(
      () => [
        props.config.enabled,
        props.config.tabName,
        props.config.intervalMinutes,
        props.config.searchBudget,
        AppConfig().accountName,
        leagues.selectedId.value,
      ],
      () => {
        reader.refresh();
      },
      { immediate: true },
    );

    return {
      t,
      state,
      lastCheck: computed(() =>
        state.lastCheckAt === null ? t(":never") : clockTime(state.lastCheckAt),
      ),
      nextCheck: computed(() =>
        state.nextCheckAt === null ? null : clockTime(state.nextCheckAt),
      ),
      searches: computed(
        () => threeHourSearchCount(RATE_LIMIT_RULES.SEARCH) ?? "?",
      ),
      budget: computed(() => clampBudget(props.config.searchBudget)),
      onlyNewest: computed(
        () => state.total !== null && state.total > state.read,
      ),
      statusText: computed(() =>
        t(STATUS_TEXT[state.status], { error: state.error ?? "" }),
      ),
      statusClass: computed(() => ({
        "text-red-400": state.status === "error",
        "text-orange-400":
          state.status === "budget-reached" ||
          state.status === "rate-limited" ||
          state.status === "no-account",
        "text-gray-500": state.status === "off",
      })),
      checkNow() {
        void reader.checkNow();
      },
    };
  },
});
</script>

<style lang="postcss" module>
.panel {
  @apply flex flex-col;
  @apply p-2 min-w-64;
  @apply rounded;
  @apply bg-gray-800 text-gray-200;
  @apply border-4 border-gray-900;
}
</style>
