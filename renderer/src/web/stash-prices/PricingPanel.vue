<template>
  <div v-if="state.counts.listings" class="mt-2 pt-1 border-t border-gray-700">
    <div>{{ progress }}</div>
    <div v-if="notPriced" class="text-gray-500">{{ notPriced }}</div>
    <div v-if="statusText" :class="statusClass">{{ statusText }}</div>
    <div v-if="mostValuable.length" class="mt-1">
      <div class="text-gray-500">{{ t(":most_valuable") }}</div>
      <div
        v-for="row of mostValuable"
        :key="row.id"
        class="flex gap-x-2 whitespace-nowrap"
      >
        <span class="truncate max-w-48">{{ row.name }}</span>
        <span class="ml-auto">~ {{ row.price }}</span>
        <span :class="row.reliabilityClass">{{ row.reliability }}</span>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import { computed, defineComponent } from "vue";
import { useNow } from "@vueuse/core";
import { useI18nNs } from "@/web/i18n";
import {
  RELIABILITY_TEXT,
  suggestedPriceText,
} from "@/web/price-check/trade/suggested-price";
import { readerReserve, type PricerStatus } from "./pricer-state";
import { useStashPricer } from "./use-stash-pricer";
import { useStashReader } from "./use-stash-reader";
import type { StashPricesWidget } from "./widget";

// The status lines; a run that waits for its next search or has nothing left shows only the progress line
const STATUS_TEXT: Partial<Record<PricerStatus, string>> = {
  "no-league": "stash_prices.pricing_no_league",
  "no-prices": "stash_prices.pricing_no_prices",
  "reading": "stash_prices.pricing_reading",
  "price-check-open": "stash_prices.pricing_price_check_open",
  "busy": "stash_prices.pricing_busy",
  "budget-reached": "stash_prices.pricing_budget_reached",
  "rate-limited": "stash_prices.pricing_rate_limited",
  "pricing": "stash_prices.pricing_item",
  "error": "stash_prices.pricing_error",
};
const SHOWN = 8;

export default defineComponent({
  props: {
    config: {
      type: Object as () => StashPricesWidget,
      required: true,
    },
  },
  setup(props) {
    const { t } = useI18nNs("stash_prices");
    const { state } = useStashPricer();
    const reader = useStashReader();
    const now = useNow({ interval: 1000 });

    const names = computed(
      () =>
        new Map(
          reader.state.listings.map((listing) => [
            listing.id,
            listing.name || listing.typeLine,
          ]),
        ),
    );

    return {
      t,
      state,
      progress: computed(() => {
        const { done, listings } = state.counts;
        if (state.nextSearchAt === null) {
          return t(":priced", { done, total: listings });
        }
        const ms = state.nextSearchAt - now.value.getTime();
        const seconds = Math.max(0, Math.ceil(ms / 1000));
        return t(":priced_next", { done, total: listings, seconds });
      }),
      notPriced: computed(() => {
        const { tooFew, cannotRead, failed } = state.counts;
        if (!tooFew && !cannotRead && !failed) return null;
        return t(":not_priced", { tooFew, cannotRead, failed });
      }),
      statusText: computed(() => {
        const key = STATUS_TEXT[state.status];
        if (!key) return null;
        return t(key, {
          error: state.error ?? "",
          name: names.value.get(state.pricing ?? "") ?? "",
          reserve: readerReserve(props.config),
        });
      }),
      statusClass: computed(() => ({
        "text-red-400": state.status === "error",
        "text-orange-400":
          state.status === "budget-reached" || state.status === "rate-limited",
      })),
      mostValuable: computed(() =>
        [...state.prices]
          .flatMap(([id, price]) =>
            price.status === "priced" ? [{ id, ...price }] : [],
          )
          .sort((a, b) => b.value - a.value)
          .slice(0, SHOWN)
          .map((row) => {
            const reliability = row.reliability
              ? RELIABILITY_TEXT[row.reliability]
              : { key: "stash_prices.estimate", class: "text-gray-500" };
            return {
              id: row.id,
              name: names.value.get(row.id) ?? row.id,
              price: suggestedPriceText({ ...row, price: row.value }).price,
              reliability: t(reliability.key),
              reliabilityClass: reliability.class,
            };
          }),
      ),
    };
  },
});
</script>
