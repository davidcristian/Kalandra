<template>
  <widget
    :config="config"
    move-handles="center"
    v-slot="{ isMoving }"
    :inline-edit="false"
    :hideable="false"
  >
    <div :class="$style.wrapper">
      <div :class="$style.timer">
        <span>{{ formatted.h }}:{{ formatted.m }}:</span
        ><span>{{ formatted.s }}</span>
      </div>
      <div v-if="!isRunning" :class="$style.paused">
        {{ t("stopwatch.paused") }}
      </div>
      <div v-if="!isMoving" :class="$style.controls">
        <button v-if="!isRunning" @click="start" :class="$style.button">
          <i class="fas fa-play"></i>
        </button>
        <button v-else @click="stop" :class="$style.button">
          <i class="fas fa-pause"></i>
        </button>
        <button @click="reset" :class="$style.button">
          <i class="fas fa-redo"></i>
        </button>
      </div>
    </div>
  </widget>
</template>

<script lang="ts">
import { defineComponent, PropType, onUnmounted } from "vue";
import { injectWidgetManager } from "@/web/overlay/injections";
import { useI18n } from "vue-i18n";
import Widget from "../overlay/Widget.vue";
import { MainProcess } from "@/web/background/IPC";
import { useStopwatch } from "./stopwatch";
import { StopwatchWidget, WidgetSpec } from "../overlay/interfaces";

export default defineComponent({
  widget: {
    type: "timer",
    instances: "multi",
    trNameKey: "stopwatch.name",
  } satisfies WidgetSpec,
  components: { Widget },
  props: {
    config: {
      type: Object as PropType<StopwatchWidget>,
      required: true,
    },
  },
  setup(props) {
    const wm = injectWidgetManager();

    if (props.config.wmFlags[0] === "uninitialized") {
      props.config.anchor = {
        pos: "cc",
        x: Math.random() * (60 - 40) + 40,
        y: Math.random() * (60 - 40) + 40,
      };
      props.config.toggleKey = null;
      props.config.resetKey = null;
      wm.show(props.config.wmId);
    }
    props.config.wmFlags = ["invisible-on-blur"];

    const hotkeyController = MainProcess.onEvent(
      "MAIN->CLIENT::widget-action",
      (e) => {
        if (e.target === `stopwatch-start-stop:${props.config.wmId}`) {
          if (isRunning.value) {
            stop();
          } else {
            start();
          }
        } else if (e.target === `stopwatch-reset:${props.config.wmId}`) {
          reset();
        }
      },
    );
    onUnmounted(() => {
      hotkeyController.abort();
    });

    const { isRunning, formatted, start, stop, reset, updateTime } =
      useStopwatch((hidden) => {
        wm.setFlag(props.config.wmId, "invisible-on-blur", hidden);
      });

    const timerId = setInterval(updateTime, 1000);
    onUnmounted(() => {
      clearInterval(timerId);
    });

    const { t } = useI18n();

    return {
      t,
      formatted,
      isRunning,
      start,
      stop,
      reset,
    };
  },
});
</script>

<style lang="postcss" module>
.timer {
  font-size: 2rem;
  line-height: 1;
  @apply font-mono;
  text-shadow: 0 1px 3px rgb(0, 0, 0);
}

.button {
  background: rgba(29, 29, 29, 0.863);
  @apply rounded;
  line-height: 1;
  width: 2rem;
  height: 2rem;
  @apply mx-1;
}

.controls {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  display: flex;
  justify-content: center;
  align-items: center;
}

.wrapper {
  @apply px-2 py-1;
  @apply rounded text-white;
  @apply bg-gray-300/30;

  &:not(:hover) {
    .controls {
      display: none;
    }
  }
}

.paused {
  position: absolute;
  top: 0;
  right: 0;
  line-height: 1;
  @apply px-2 rounded shadow;
  @apply bg-orange-700 text-white;
}
</style>
