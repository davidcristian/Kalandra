<template>
  <div class="max-w-md p-2">
    <div class="mb-4">{{ t(":intro") }}</div>
    <ui-checkbox class="mb-4" v-model="enabled">{{
      t(":enabled")
    }}</ui-checkbox>
    <div class="mb-4">
      <div class="mb-1">{{ t(":tab_name") }}</div>
      <input
        v-model.trim="tabName"
        class="rounded bg-gray-900 px-1 block w-full font-poe"
      />
    </div>
    <div class="mb-4">
      <div class="mb-1">{{ t(":interval") }}</div>
      <div class="flex items-center">
        <input
          v-model.lazy.number="intervalMinutes"
          type="number"
          class="rounded bg-gray-900 px-1 block w-16 font-poe text-center"
        />
        <span class="ml-2">{{ t(":minutes") }}</span>
      </div>
    </div>
    <div class="mb-4">
      <div class="mb-1">{{ t(":budget") }}</div>
      <input
        v-model.lazy.number="searchBudget"
        type="number"
        class="rounded bg-gray-900 px-1 block w-16 mb-1 font-poe text-center"
      />
      <div class="italic text-gray-500">{{ t(":budget_help") }}</div>
    </div>
    <div class="mb-4 border-b min-w-full" />
    <div class="text-lg mb-1">{{ t(":setup") }}</div>
    <ol class="list-decimal pl-5 mb-4">
      <li>{{ t(":setup_tab", { name: tabName }) }}</li>
      <li>{{ t(":setup_items") }}</li>
      <li>{{ t(":setup_account") }}</li>
    </ol>
    <div v-if="!hasAccountName" class="text-orange-400">
      {{ t(":no_account") }}
    </div>
  </div>
</template>

<script lang="ts">
import { computed, defineComponent } from "vue";
import { useI18nNs } from "@/web/i18n";
import UiCheckbox from "@/web/ui/UiCheckbox.vue";
import { configModelValue, configProp, requireWidget } from "../settings/utils";
import { clampBudget, clampInterval } from "./reader-settings";
import { setStashPricesEnabled, type StashPricesWidget } from "./widget";

export default defineComponent({
  name: "stash_prices.name",
  components: { UiCheckbox },
  props: configProp<StashPricesWidget>(),
  setup(props) {
    const { t } = useI18nNs("stash_prices");
    const widget = computed(() =>
      requireWidget<StashPricesWidget>("stash-prices", props.config),
    );

    return {
      t,
      enabled: computed({
        get: () => widget.value.enabled,
        set: (value: boolean) => {
          setStashPricesEnabled(widget.value, value);
        },
      }),
      tabName: configModelValue(() => widget.value, "tabName"),
      intervalMinutes: computed({
        get: () => widget.value.intervalMinutes,
        set: (value: number) => {
          widget.value.intervalMinutes = clampInterval(value);
        },
      }),
      searchBudget: computed({
        get: () => widget.value.searchBudget,
        set: (value: number) => {
          widget.value.searchBudget = clampBudget(value);
        },
      }),
      hasAccountName: computed(() => props.config.accountName.trim() !== ""),
    };
  },
});
</script>
