<template>
  <div v-if="result" :class="[$style['wrapper'], $style[clickPosition]]">
    <div class="flex-1 p-2 w-1/2">
      <div
        v-for="item in result.related"
        :key="item.name"
        :class="{ 'bg-gray-700': item.highlight }"
        class="rounded px-1"
      >
        <item-quick-price
          currency-text
          fraction
          class="text-base"
          :price="item.price"
          :item-img="item.icon"
        />
        <div
          class="text-left text-gray-600 mb-1 whitespace-nowrap overflow-hidden"
        >
          {{ item.name }}
        </div>
      </div>
    </div>
    <div v-if="result.items.length" class="flex-1 p-2 w-1/2">
      <div v-for="item in result.items" :key="item.name">
        <item-quick-price
          currency-text
          fraction
          class="text-base"
          :price="item.price"
          :item-img="item.icon"
        />
        <div
          class="text-left text-gray-600 mb-1 whitespace-nowrap overflow-hidden"
        >
          {{ item.name }}
        </div>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import { computed, defineComponent, PropType } from "vue";
import { usePoeninja } from "@/web/background/Prices";
import { getDetailsId } from "../trends/getDetailsId";
import { ParsedItem } from "@/parser";
import ItemQuickPrice from "@/web/ui/ItemQuickPrice.vue";
import {
  buildRelatedItems,
  findItemByQueryId,
  splitQueryId,
} from "./related-items";

const { findPriceByQuery, autoCurrency, ITEM_DROP } = usePoeninja();

function findPriceByQueryId(queryId: string) {
  const priceEntry = findPriceByQuery(splitQueryId(queryId));
  if (priceEntry) {
    return autoCurrency(priceEntry.primaryValue);
  }
}

function getItemPrices(queryId: string) {
  return buildRelatedItems(
    queryId,
    ITEM_DROP.value,
    findItemByQueryId,
    findPriceByQueryId,
  );
}

export default defineComponent({
  components: { ItemQuickPrice },
  props: {
    item: {
      type: Object as PropType<ParsedItem | null>,
      default: null,
    },
    clickPosition: {
      type: String,
      required: true,
    },
  },
  setup(props) {
    const result = computed(() => {
      if (!props.item) return;

      const queryId = getDetailsId(props.item);
      if (!queryId) return;

      return getItemPrices(
        `${queryId.ns}::${queryId.name}${queryId.variant ? ` // ${queryId.variant}` : ""}`,
      );
    });

    return { result };
  },
});
</script>

<style lang="postcss" module>
.wrapper {
  display: flex;
  @apply bg-gray-800 text-gray-400 mt-6;
  @apply border border-gray-900;
  border-width: 0.25rem;
  max-width: min(100%, 24rem);
}

.inventory {
  @apply rounded-l-lg;
  box-shadow: inset -0.5rem 0 0.5rem -0.5rem rgb(0 0 0 / 70%);
  border-right: none;
}

.stash {
  @apply rounded-r-lg;
  box-shadow: inset 0.5rem 0 0.5rem -0.5rem rgb(0 0 0 / 70%);
  border-left: none;
}
</style>
