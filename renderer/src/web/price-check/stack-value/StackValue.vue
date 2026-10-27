<template>
  <div
    v-if="value"
    class="p-2 border-dashed border border-gray-600 rounded mt-2"
  >
    <div class="flex text-gray-400 leading-none">
      <div class="w-1/2">
        {{ t("trade_result.you_have") }} <span class="font-sans">×</span>
        {{ value.have.amount }}
        <i class="fas fa-arrow-right text-gray-600 px-1 text-xs"></i>
        {{ value.have.price }}
      </div>
      <div class="w-1/2 pl-2" v-if="value.oneStack">
        {{ t("trade_result.stack") }} <span class="font-sans">×</span>
        {{ value.oneStack.amount }}
        <i class="fas fa-arrow-right text-gray-600 px-1 text-xs"></i>
        {{ value.oneStack.price }}
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent, PropType, computed } from "vue";
import { useI18n } from "vue-i18n";
import { usePoeninja, displayRounding } from "@/web/background/Prices";
import { getDetailsId } from "../trends/getDetailsId";
import { ParsedItem } from "@/parser";
import { ItemFilters } from "../filters/interfaces";

export default defineComponent({
  props: {
    filters: {
      type: Object as PropType<ItemFilters>,
      required: true,
    },
    item: {
      type: Object as PropType<ParsedItem>,
      required: true,
    },
  },
  setup(props) {
    const { findPriceByQuery, autoCurrency } = usePoeninja();

    const { t } = useI18n();

    return {
      t,
      value: computed(() => {
        const id = getDetailsId(props.item);
        const one = id ? findPriceByQuery(id) : null;
        const stackSize = props.filters.stackSize;
        if (!one || !stackSize) return null;

        const getPriceFor = (n: number) => {
          const price = autoCurrency(n * one.primaryValue);
          return `${displayRounding(price.min)} ${price.currency}`;
        };
        return {
          have: {
            amount: stackSize.value,
            price: getPriceFor(stackSize.value),
          },
          oneStack: props.item.stackSize
            ? {
                amount: props.item.stackSize.max,
                price: getPriceFor(props.item.stackSize.max),
              }
            : null,
        };
      }),
    };
  },
});
</script>
