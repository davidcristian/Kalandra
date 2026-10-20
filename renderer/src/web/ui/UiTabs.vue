<template>
  <div>
    <div class="flex mb-1 gap-px">
      <button
        v-for="(tab, index) in tabs"
        :key="tab.value"
        @click="updateTab(tab.value)"
        class="px-2 py-1 text-gray-400 leading-none"
        :class="{
          'bg-gray-900': modelValue === tab.value,
          'bg-gray-700': modelValue !== tab.value,
          'rounded-l': index === 0,
          'rounded-r': index === tabs.length - 1,
        }"
      >
        {{ tab.label }}
      </button>
    </div>

    <slot :selected="modelValue" />
  </div>
</template>

<script lang="ts">
import { defineComponent, PropType } from "vue";

export default defineComponent({
  name: "UiTabs",
  props: {
    modelValue: {
      type: String,
      required: true,
    },
    tabs: {
      type: Array as PropType<Array<{ value: string; label: string }>>,
      required: true,
    },
  },
  emits: ["update:modelValue"],
  setup(_, { emit }) {
    return {
      updateTab(tab: string) {
        emit("update:modelValue", tab);
      },
    };
  },
});
</script>

<style lang="postcss" module></style>
