<template>
  <div>
    <div class="text-lg mb-1">{{ t(":marks") }}</div>
    <div class="flex items-center mb-1">
      <span class="flex-1">{{ t(":highlight") }}</span>
      <div class="flex gap-px">
        <button
          v-for="(toggle, index) of toggles"
          :key="toggle.key"
          :aria-pressed="toggle.model.value"
          class="px-3 py-1 leading-none"
          :class="[
            toggle.model.value ? toggle.on : 'bg-gray-700 text-gray-400',
            index === 0 ? 'rounded-l' : 'rounded-r',
          ]"
          @click="toggle.model.value = !toggle.model.value"
        >
          {{ t(toggle.label) }}
        </button>
      </div>
    </div>
    <div class="italic text-gray-500 mb-4">{{ t(":highlight_help") }}</div>
    <div class="flex items-center mb-1">
      <label class="flex-1">{{ t(":threshold") }}</label>
      <input
        v-model.lazy.number="amount"
        type="number"
        min="0"
        step="0.1"
        class="rounded bg-gray-900 px-1 block w-16 mr-2 font-poe text-center"
      />
      <select v-model="currency" class="p-1 rounded bg-gray-700">
        <option
          v-for="option of currencies"
          :key="option.id"
          :value="option.id"
        >
          {{ option.name }}
        </option>
      </select>
    </div>
    <div class="italic text-gray-500 mb-4">{{ t(":threshold_help") }}</div>
  </div>
</template>

<script lang="ts">
import { computed, defineComponent, PropType } from "vue";
import { ITEM_BY_REF } from "@/assets/data";
import { useI18nNs } from "@/web/i18n";
import { configModelValue } from "../settings/utils";
import {
  clampThresholdAmount,
  type ThresholdCurrency,
} from "./highlight-marks";
import type { StashPricesWidget } from "./widget";

// The currencies a threshold can be in, by their names in the game data, which name them in the game's language
const CURRENCIES: Array<{ id: ThresholdCurrency; ref: string }> = [
  { id: "chaos", ref: "Chaos Orb" },
  { id: "exalted", ref: "Exalted Orb" },
  { id: "div", ref: "Divine Orb" },
];

export default defineComponent({
  props: {
    widget: {
      type: Object as PropType<StashPricesWidget>,
      required: true,
    },
  },
  setup(props) {
    const { t } = useI18nNs("stash_prices");

    return {
      t,
      toggles: [
        {
          key: "valuable",
          label: ":highlight_valuable",
          on: "bg-yellow-600 text-white",
          model: configModelValue(() => props.widget, "highlightValuable"),
        },
        {
          key: "trash",
          label: ":highlight_trash",
          on: "bg-red-700 text-white",
          model: configModelValue(() => props.widget, "highlightTrash"),
        },
      ],
      amount: computed({
        get: () => props.widget.trashThreshold.amount,
        set: (value: number) => {
          props.widget.trashThreshold.amount = clampThresholdAmount(value);
        },
      }),
      currency: configModelValue(() => props.widget.trashThreshold, "currency"),
      currencies: computed(() =>
        CURRENCIES.map(({ id, ref }) => ({
          id,
          name: ITEM_BY_REF("ITEM", ref)?.[0]?.name ?? ref,
        })),
      ),
    };
  },
});
</script>
