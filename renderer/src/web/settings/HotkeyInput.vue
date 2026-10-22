<template>
  <input
    @keyup="handleKeyup"
    @keydown.prevent
    :placeholder="modelValue || t('settings.no_key')"
    :title="isDuplicate ? t('settings.hotkey_duplicate') : undefined"
    :class="{
      'placeholder-red-400': !modelValue || isDuplicate,
      'ring-1 ring-red-400': isDuplicate,
    }"
    class="rounded bg-gray-900 px-1 text-center font-poe"
  />
</template>

<script lang="ts">
import { computed, defineComponent, PropType } from "vue";
import { useI18n } from "vue-i18n";
import { KeyToCode, hotkeyToString } from "@ipc/KeyToCode";
import { isDuplicateInDraft } from "./hotkey-conflicts";

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
      isDuplicate: computed(() =>
        isDuplicateInDraft(props.modelValue, props.shortcut),
      ),
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
          if (code.includes("F12")) return;
          if (props.noModKeys && code.includes("+")) return;
          ctx.emit("update:modelValue", code);
        }
      },
    };
  },
});
</script>
