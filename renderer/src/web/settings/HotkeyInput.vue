<template>
  <input
    @keyup="handleKeyup"
    @keydown.prevent
    :placeholder="modelValue || t('settings.no_key')"
    :title="hint && t(hint)"
    :class="{
      'placeholder-red-400': !modelValue || hint,
      'ring-1 ring-red-400': hint,
    }"
    class="rounded bg-gray-900 px-1 text-center font-poe"
  />
</template>

<script lang="ts">
import { computed, defineComponent, PropType } from "vue";
import { useI18n } from "vue-i18n";
import { KeyToCode, hotkeyToString } from "@ipc/KeyToCode";
import { hotkeyHint } from "./hotkey-conflicts";

export default defineComponent({
  emits: ["update:modelValue"],
  props: {
    modelValue: {
      type: String as PropType<string | null>,
      default: null,
    },
    noModKeys: {
      type: Boolean,
      default: false,
    },
    required: {
      type: Boolean,
      default: false,
    },
    shortcut: {
      type: String as PropType<string | null>,
      default: undefined,
    },
  },
  setup(props, ctx) {
    const { t } = useI18n();

    return {
      t,
      hint: computed(() => hotkeyHint(props.modelValue, props.shortcut)),
      handleKeyup(e: KeyboardEvent) {
        e.preventDefault();
        e.stopPropagation();

        if (e.code === "Backspace") {
          if (!props.required) {
            ctx.emit("update:modelValue", null);
          }
          return;
        }

        let { code, ctrlKey, shiftKey, altKey } = e;

        if (code.startsWith("Key")) {
          code = code.slice("Key".length);
        } else if (code.startsWith("Digit")) {
          code = code.slice("Digit".length);
        }

        if ((KeyToCode as Record<string, number>)[code]) {
          code = hotkeyToString([code], ctrlKey, shiftKey, altKey);
          // Windows reserves F12 for a debugger, and the RegisterHotKey docs say not to make it a hotkey:
          // https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-registerhotkey
          if (code.includes("F12")) return;
          if (props.noModKeys && code.includes("+")) return;
          ctx.emit("update:modelValue", code);
        }
      },
    };
  },
});
</script>
