<template>
  <div v-if="active" class="p-2">
    <div class="flex flex-row justify-between content-center">
      <div class="flex flex-row gap-x-2">
        <div class="flex gap-px items-center mx-2">
          <button
            v-for="(value, index) in amountOptions"
            :key="value"
            @click="selectedAmount = value"
            class="px-2 py-1 text-gray-400 leading-none h-6"
            :class="{
              'bg-gray-900': selectedAmount === value,
              'bg-gray-700': selectedAmount !== value,
              'rounded-l': index === 0,
              'rounded-r': index === amountOptions.length - 1,
            }"
          >
            {{ value }}
          </button>
        </div>
      </div>
      <div class="flex items-center gap-x-1">
        <!-- price of augments -->
        <item-quick-price
          :item-img="selectedCatalyst?.icon"
          :show-img="selectedCatalyst !== undefined"
          :price="totalPrice"
        />
      </div>
    </div>
    <hr class="my-2 border-gray-700" />
    <div>
      <div class="overflow-y-auto max-h-96">
        <item-editor-item
          v-for="item in result"
          :key="item.displayString"
          :item="item"
          :selected="item.refName === selectedCatalyst?.refName"
          class="m-1"
          @click="selectCatalyst(item)"
        />
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import { BaseType } from "@/assets/data";
import { ItemCategory, ParsedItem } from "@/parser";
import { ItemEditorType } from "@/parser/meta";
import { EditorItem, itemIsModifiable } from "@/parser/ParsedItem";
import { computed, defineComponent, PropType, shallowRef, watch } from "vue";
import {
  applyCatalyst,
  catalystCost,
  categoryCatalysts,
  getItemEditorType,
} from "./item-editor";
import ItemQuickPrice from "@/web/ui/ItemQuickPrice.vue";
import { usePoeninja } from "@/web/background/Prices";
import ItemEditorItem from "./ItemEditorItem.vue";

export default defineComponent({
  props: {
    item: {
      type: Object as PropType<ParsedItem>,
    },
  },
  components: {
    ItemQuickPrice,
    ItemEditorItem,
  },
  setup(props) {
    const { findPriceByQuery, autoCurrency } = usePoeninja();

    const selectedCatalyst = shallowRef<BaseType | undefined>(undefined);
    const selectedAmount = shallowRef<0 | 20 | 30 | 40 | 50 | 60 | 70>(20);
    const amountOptions = shallowRef<Array<0 | 20 | 30 | 40 | 50 | 60 | 70>>([
      0, 20, 30, 40, 50,
    ]);
    const totalPrice = shallowRef<{
      min: number;
      max: number;
      currency: string;
    }>({
      min: 0,
      max: 0,
      currency: "ex",
    });

    const result = computed(() =>
      props.item?.category &&
      getItemEditorType(props.item) === ItemEditorType.Catalyst
        ? categoryCatalysts(props.item.category)
        : [],
    );

    watch(
      () => props.item,
      (newItem) => {
        if (newItem) {
          selectedCatalyst.value = undefined;
          totalPrice.value = { min: 0, max: 0, currency: "ex" };

          if (newItem.info.refName === "Breach Ring") {
            selectedAmount.value = 40;
            amountOptions.value = [0, 20, 30, 40, 50, 60, 70];
          } else if (newItem.category === ItemCategory.Jewel) {
            selectedAmount.value = 20;
            amountOptions.value = [0, 20];
          } else {
            selectedAmount.value = 20;
            amountOptions.value = [0, 20, 30, 40, 50];
          }
        }
      },
      { immediate: true },
    );

    watch(
      () => [selectedAmount.value, selectedCatalyst.value],
      () => {
        if (!selectedCatalyst.value || !props.item) return;
        applyCatalyst(props.item, selectedCatalyst.value, selectedAmount.value);

        const cost = catalystCost(
          selectedCatalyst.value,
          selectedAmount.value,
          findPriceByQuery,
        );

        if (cost === undefined) {
          totalPrice.value = { min: 0, max: 0, currency: "ex" };
          return;
        }

        totalPrice.value = autoCurrency(cost);
      },
    );

    return {
      selectedCatalyst,
      selectedAmount,
      amountOptions,
      result,
      totalPrice,
      selectCatalyst(item: EditorItem) {
        selectedCatalyst.value = item.baseItem;
      },
      active: computed(() => {
        return (
          props.item &&
          itemIsModifiable(props.item) &&
          getItemEditorType(props.item) === ItemEditorType.Catalyst
        );
      }),
    };
  },
});
</script>

<style lang="postcss" module></style>
