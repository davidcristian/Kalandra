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
import { readerReserve } from "./pricer-state";
import { listingNames, pricingStatusText, progressText } from "./pricing-text";
import { useStashPricer } from "./use-stash-pricer";
import { useStashReader } from "./use-stash-reader";
import type { StashPricesWidget } from "./widget";

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

    const names = computed(() => listingNames(reader.state.listings));

    return {
      t,
      state,
      progress: computed(() =>
        progressText(state, now.value.getTime(), (key, values) =>
          t(key, values),
        ),
      ),
      notPriced: computed(() => {
        const { tooFew, cannotRead, failed } = state.counts;
        if (!tooFew && !cannotRead && !failed) return null;
        return t(":not_priced", { tooFew, cannotRead, failed });
      }),
      statusText: computed(() =>
        pricingStatusText(
          state,
          names.value,
          readerReserve(props.config),
          (key, values) => t(key, values),
        ),
      ),
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
