<template>
  <Widget
    :config="config"
    :removable="false"
    :inline-edit="false"
    move-handles="top-bottom"
  >
    <div
      class="min-h-10"
      :class="[
        $style['xpContainer'],
        {
          'min-w-48': config.showExp,
          'min-w-32': !config.showExp,
        },
      ]"
    >
      <input
        :class="$style['xpInput']"
        min="1"
        max="100"
        step="1"
        type="number"
        v-model.number="characterLevel"
        @mousewheel.stop
      />
      <div v-if="config.showExp">
        {{ t(":exp") }}
        {{ outsideTestData(characterLevel, areaLevel) ? "*" : "" }}:
        <span
          class="font-semibold"
          :class="{
            'text-red-600': expPenalty !== '100.0',
            'text-green-600': expPenalty === '100.0',
          }"
          >{{ expPenalty }}%</span
        >
      </div>
      <div>
        {{ t(":over") }}
        <span
          class="font-semibold"
          :class="{
            'text-red-600': overIdeal < 0,
            'text-green-600': overIdeal === 0 || overIdeal === 1,
          }"
          >{{ overIdeal }}</span
        >
      </div>
    </div>
  </Widget>
</template>

<script lang="ts">
import { computed, defineComponent, PropType } from "vue";

import Widget from "../overlay/Widget.vue";
import { WidgetSpec } from "../overlay/interfaces";
import { XpWidget } from "./widget";
import { useClientLog } from "../client-log/client-log";
import { getExpPenalty, getOverIdeal, outsideTestData } from "./xp-formula";
import { useI18nNs } from "@/web/i18n";

export default defineComponent({
  widget: {
    type: "experience-tracker",
    instances: "single",
    initInstance: (): XpWidget => {
      return {
        wmId: 0,
        wmType: "experience-tracker",
        wmTitle: "XP",
        wmWants: "hide",
        wmZorder: null,
        wmFlags: [],
        anchor: {
          pos: "bc",
          x: 68,
          y: 98,
        },
        showExp: true,
      };
    },
  } satisfies WidgetSpec,
  components: { Widget },
  props: {
    config: {
      type: Object as PropType<XpWidget>,
      required: true,
    },
  },
  setup() {
    const { t } = useI18nNs("leveling");
    const { playerLevel, setPlayerLevel, areaLevel } = useClientLog();

    const characterLevel = computed({
      get() {
        return playerLevel.value;
      },
      set(value: number) {
        setPlayerLevel(value);
      },
    });

    return {
      t,
      characterLevel,
      areaLevel,
      outsideTestData,
      expPenalty: computed(() => {
        return getExpPenalty(characterLevel.value, areaLevel.value).toFixed(1);
      }),
      overIdeal: computed(() => {
        return getOverIdeal(characterLevel.value, areaLevel.value);
      }),
    };
  },
});
</script>

<style lang="postcss" module>
.xpInput {
  @apply bg-gray-900;
  @apply text-gray-300;
  @apply text-center;
  @apply w-8;
  @apply px-1;
  @apply border border-transparent;
  @apply rounded;

  &::placeholder {
    @apply text-gray-700;
    font-size: 0.8125rem;
  }

  &:focus {
    @apply border-gray-500;
    cursor: none;
  }
}

.xpContainer {
  @apply flex flex-row;
  @apply justify-between items-center;
  @apply px-2;

  @apply rounded;
  @apply bg-gray-800;
  @apply border-4 border-gray-900;
  box-shadow:
    0 1px 3px 0 rgba(0, 0, 0, 0.75),
    0 1px 2px 0 rgba(0, 0, 0, 0.75);
}
</style>
