<template>
  <div v-if="enabled && xchgRate" class="mb-2 pl-2 whitespace-nowrap">
    <ui-popover
      :delay="[80, null]"
      placement="bottom-start"
      boundary="#price-window"
    >
      <template #target>
        <span class="cursor-default">
          <i class="fas fa-circle-exclamation text-yellow-500"></i>
          <span class="ml-1 text-gray-500">{{ t(":suggested_price") }}</span>
          <span v-if="loading" class="ml-2 text-gray-600">...</span>
          <template v-else-if="text">
            <span class="ml-2 text-gray-600 font-sans">~ </span>{{ text.price }}
            <span class="text-gray-500">({{ text.range }})</span>
            <span class="ml-1" :class="text.reliabilityClass">{{
              text.reliability
            }}</span>
          </template>
          <span v-else class="ml-2 text-gray-600">{{
            t(":too_few_listings")
          }}</span>
        </span>
      </template>
      <template #content>
        <div class="p-2 bg-gray-800 text-gray-400" style="max-width: 18.5rem">
          <div class="text-yellow-500">{{ t(":experimental") }}</div>
          <div v-if="text" class="mt-1">
            {{ t(":suggested_detail", [text.sellers, text.leftOut]) }}
          </div>
        </div>
      </template>
    </ui-popover>
  </div>
</template>

<script lang="ts">
import { computed, defineComponent, PropType } from "vue";
import { useI18nNs } from "@/web/i18n";
import UiPopover from "@/web/ui/Popover.vue";
import { usePoeninja } from "@/web/background/Prices";
import { suggestedPriceEnabled } from "@/web/price-check/price-check-config";
import {
  PricedListing,
  RELIABILITY_TEXT,
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

    const text = computed(() => {
      const suggested = suggestPrice(props.listings);
      if (!suggested) return null;
      const reliability = RELIABILITY_TEXT[suggested.reliability];
      return {
        ...suggestedPriceText(suggested),
        reliability: t(reliability.key),
        reliabilityClass: reliability.class,
        sellers: suggested.sellers,
        leftOut: suggested.leftOut,
      };
    });

    return { t, enabled: computed(suggestedPriceEnabled), xchgRate, text };
  },
});
</script>
