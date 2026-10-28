<template>
  <div>
    <div class="text-lg mb-1">{{ t(":detection") }}</div>
    <ui-checkbox class="mb-1" v-model="captureEnabled">{{
      t(":capture_enabled")
    }}</ui-checkbox>
    <div class="italic text-gray-500 mb-4">{{ t(":capture_help") }}</div>
    <div class="flex items-center mb-1">
      <label class="flex-1">{{ t(":toggle_key") }}</label>
      <hotkey-input v-model="toggleKey" class="w-48" />
    </div>
    <div class="italic text-gray-500 mb-4">{{ t(":toggle_help") }}</div>
    <div class="flex items-center mb-1">
      <label class="flex-1">{{ t(":grid") }}</label>
      <select v-model="gridUnit" class="p-1 rounded bg-gray-700">
        <option value="px">{{ t(":grid_unit_px") }}</option>
        <option value="%">{{ t(":grid_unit_percent") }}</option>
      </select>
    </div>
    <div class="flex gap-x-4 mb-1">
      <label v-for="field of fields" :key="field.key" class="flex items-center">
        <span class="mr-1">{{ t(field.label) }}</span>
        <input
          v-model.lazy.number="field.model.value"
          type="number"
          step="0.1"
          class="rounded bg-gray-900 px-1 block w-16 font-poe text-center"
        />
      </label>
    </div>
    <div class="italic text-gray-500 mb-4">{{ t(":grid_help") }}</div>
  </div>
</template>

<script lang="ts">
import { computed, defineComponent, PropType } from "vue";
import { useI18nNs } from "@/web/i18n";
import UiCheckbox from "@/web/ui/UiCheckbox.vue";
import HotkeyInput from "../settings/HotkeyInput.vue";
import { configModelValue } from "../settings/utils";
import type { GridCorrection } from "./stash-grid";
import { clampCorrection, type StashPricesWidget } from "./widget";

type CorrectionKey = Exclude<keyof GridCorrection, "unit">;

export default defineComponent({
  components: { UiCheckbox, HotkeyInput },
  props: {
    widget: {
      type: Object as PropType<StashPricesWidget>,
      required: true,
    },
  },
  setup(props) {
    const { t } = useI18nNs("stash_prices");
    const correction = (key: CorrectionKey) =>
      computed({
        get: () => props.widget.gridCorrection[key],
        set: (value: number) => {
          props.widget.gridCorrection[key] = clampCorrection(value);
        },
      });
    const gridLeft = correction("left");
    const gridTop = correction("top");
    const gridCell = correction("cell");

    return {
      t,
      captureEnabled: configModelValue(() => props.widget, "captureEnabled"),
      toggleKey: configModelValue(() => props.widget, "toggleKey"),
      gridUnit: configModelValue(() => props.widget.gridCorrection, "unit"),
      gridLeft,
      gridTop,
      gridCell,
      fields: [
        { key: "left", label: ":grid_left", model: gridLeft },
        { key: "top", label: ":grid_top", model: gridTop },
        { key: "cell", label: ":grid_cell", model: gridCell },
      ],
    };
  },
});
</script>
