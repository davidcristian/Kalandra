<template>
  <div class="ml-6 mb-4">
    <ui-checkbox
      class="mb-1"
      :class="{ 'opacity-50': !suggestedPrice }"
      :disabled="!suggestedPrice"
      v-model="enabled"
      >{{ t(":enabled") }}</ui-checkbox
    >
    <div class="italic text-gray-500">{{ t(":enabled_note") }}</div>
  </div>
</template>

<script lang="ts">
import { computed, defineComponent } from "vue";
import { useI18nNs } from "@/web/i18n";
import type { PriceCheckWidget } from "@/web/overlay/widgets";
import UiCheckbox from "@/web/ui/UiCheckbox.vue";
import { configProp, requireWidget } from "../settings/utils";
import { setStashPricesEnabled, type StashPricesWidget } from "./widget";

/** The switch of stash prices, shown under the suggested price setting of the price check page. */
export default defineComponent({
  components: { UiCheckbox },
  props: configProp(),
  setup(props) {
    const { t } = useI18nNs("stash_prices");
    const suggestedPrice = computed(
      () =>
        requireWidget<PriceCheckWidget>("price-check", props.config)
          .suggestedPrice,
    );
    const widget = computed(() =>
      requireWidget<StashPricesWidget>("stash-prices", props.config),
    );

    return {
      t,
      suggestedPrice,
      enabled: computed({
        get: () => widget.value.enabled,
        set: (value: boolean) => {
          setStashPricesEnabled(widget.value, value && suggestedPrice.value);
        },
      }),
    };
  },
});
</script>
