<template>
  <div v-if="xchgRate" class="mb-2 flex items-baseline gap-x-2 pl-2">
    <span class="rounded px-1 text-xs bg-yellow-900 text-yellow-300">{{
      t(":experimental")
    }}</span>
    <span class="text-gray-500">{{ t(":suggested_price") }}</span>
    <span v-if="loading" class="text-gray-600">...</span>
    <ui-popover
      v-else-if="text"
      :delay="[80, null]"
      placement="bottom-start"
      boundary="#price-window"
    >
      <template #target>
        <span class="cursor-default whitespace-nowrap">
          <span class="text-gray-600 font-sans">~ </span>{{ text.price }}
          <span class="text-gray-500">({{ text.range }})</span>
          <span class="ml-1" :class="text.reliabilityClass">{{
            text.reliability
          }}</span>
        </span>
      </template>
      <template #content>
        <div class="p-2 bg-gray-800 text-gray-400" style="max-width: 18.5rem">
          {{ t(":suggested_detail", [text.sellers, text.leftOut]) }}
        </div>
      </template>
    </ui-popover>
    <span v-else class="text-gray-600">{{ t(":too_few_listings") }}</span>
  </div>
</template>

<script lang="ts">
import { computed, defineComponent, PropType } from "vue";
import { useI18nNs } from "@/web/i18n";
import UiPopover from "@/web/ui/Popover.vue";
import { usePoeninja } from "@/web/background/Prices";
import {
  PricedListing,
  Reliability,
  suggestedPriceText,
  suggestPrice,
} from "./suggested-price";

export default defineComponent({
  components: { UiPopover },
  props: {
    listings: {
      type: Array as PropType<readonly PricedListing[]>,
      required: true,
    },
    loading: {
      type: Boolean,
      required: true,
    },
  },
  setup(props) {
    const { t } = useI18nNs("trade_result");
    const { xchgRate } = usePoeninja();

    function reliabilityText(reliability: Reliability) {
      switch (reliability) {
        case "high":
          return { text: t(":reliability_high"), class: "text-green-500" };
        case "medium":
          return { text: t(":reliability_medium"), class: "text-yellow-500" };
        case "low":
          return { text: t(":reliability_low"), class: "text-orange-500" };
      }
    }

    const text = computed(() => {
      const suggested = suggestPrice(props.listings);
      if (!suggested) return null;
      const reliability = reliabilityText(suggested.reliability);
      return {
        ...suggestedPriceText(suggested),
        reliability: reliability.text,
        reliabilityClass: reliability.class,
        sellers: suggested.sellers,
        leftOut: suggested.leftOut,
      };
    });

    return { t, xchgRate, text };
  },
});
</script>
