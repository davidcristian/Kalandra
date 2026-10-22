<template>
  <div class="max-w-md p-2">
    <div class="mb-4">{{ t("Recording settings") }}</div>
    <ui-checkbox class="mb-2" v-model="keepExplicit">{{
      t("keep explicit mods")
    }}</ui-checkbox>
    <ui-checkbox class="mb-2" v-model="keepImplicit">{{
      t("keep implicit mods")
    }}</ui-checkbox>
    <ui-checkbox class="mb-2" v-model="keepEnchant">{{
      t("keep enchant mods")
    }}</ui-checkbox>
    <ui-checkbox class="mb-2" v-model="keepAugment">{{
      t("keep augment mods")
    }}</ui-checkbox>
  </div>
</template>

<script lang="ts">
import { defineComponent, computed, PropType } from "vue";
import { useI18n } from "vue-i18n";
import UiCheckbox from "@/web/ui/UiCheckbox.vue";
import { ColumnOpts } from "./widget";
import { configModelValue } from "../settings/utils";

export default defineComponent({
  emits: [],
  components: { UiCheckbox },
  props: {
    selectedProfile: {
      type: String,
      required: true,
    },
    profiles: {
      type: Object as PropType<Record<string, ColumnOpts>>,
      required: true,
    },
  },
  setup(props) {
    const { t } = useI18n();

    const selectedProfile = computed(
      () => props.profiles[props.selectedProfile],
    );

    return {
      t,
      keepExplicit: configModelValue(
        () => selectedProfile.value.keep,
        "explicit",
      ),
      keepImplicit: configModelValue(
        () => selectedProfile.value.keep,
        "implicit",
      ),
      keepEnchant: configModelValue(
        () => selectedProfile.value.keep,
        "enchant",
      ),
      keepAugment: configModelValue(
        () => selectedProfile.value.keep,
        "augment",
      ),
    };
  },
});
</script>

<style lang="postcss" module></style>
