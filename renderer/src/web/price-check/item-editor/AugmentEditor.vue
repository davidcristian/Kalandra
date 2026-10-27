<template>
  <div v-if="item?.augmentSockets" class="p-2">
    <div class="flex flex-row justify-between">
      <div class="grid grid-cols-6 gap-2">
        <template
          v-for="(augment, index) of item.augmentSockets.augments"
          :key="`${index}+${augment?.refName}`"
        >
          <div
            class="rounded-full bg-opacity-50 border-2 border-transparent"
            :class="{
              'hover:bg-gray-700 hover:border-gray-500 cursor-pointer':
                selectedAugment && (augment === null || !augment.socketBound),
              'border-red-900 cursor-not-allowed': augment?.socketBound,
            }"
          >
            <img
              :src="
                augment ? augment.icon : '/images/augments/empty-socket.png'
              "
              :title="augment?.name"
              class="w-8 h-8"
              :onclick="() => replaceAugment(index)"
            />
          </div>
        </template>
      </div>
      <div class="flex items-center gap-x-1">
        <i class="fas fa-arrow-right text-gray-600 px-1 text-sm" />
        <item-sum-price
          :items="
            item.augmentSockets.augments.map((augment) =>
              augment ? augment.baseItem : null,
            )
          "
        />
      </div>
    </div>
    <hr class="my-2 border-gray-700" />
    <div>
      <ui-tabs v-if="displayGroups" v-model="mainTab" :tabs="tabs.main">
        <template #default="{ selected }">
          <ui-tabs
            v-if="selected === 'Rune'"
            v-model="runeTab"
            :tabs="tabs.rune"
          >
            <template #default="{ selected }">
              <augments-list
                v-if="selected === 'Lesser'"
                :augments="displayGroups.Rune.Lesser"
                v-model:selectedAugment="selectedAugment"
              />
              <augments-list
                v-else-if="selected === 'Normal'"
                :augments="displayGroups.Rune.Normal"
                v-model:selectedAugment="selectedAugment"
              />
              <augments-list
                v-else-if="selected === 'Greater'"
                :augments="displayGroups.Rune.Greater"
                v-model:selectedAugment="selectedAugment"
              />
              <augments-list
                v-else-if="selected === 'Perfect'"
                :augments="displayGroups.Rune.Perfect"
                v-model:selectedAugment="selectedAugment"
              />
              <augments-list
                v-else-if="selected === 'Other'"
                :augments="displayGroups.Rune.Other"
                v-model:selectedAugment="selectedAugment"
              />
            </template>
          </ui-tabs>
          <ui-tabs
            v-else-if="selected === 'Soul Core'"
            v-model="soulCoreTab"
            :tabs="tabs.soulCore"
          >
            <template #default="{ selected }">
              <augments-list
                v-if="selected === 'Normal'"
                :augments="displayGroups.SoulCore.Normal"
                v-model:selectedAugment="selectedAugment"
              />
              <augments-list
                v-else-if="selected === 'Special'"
                :augments="displayGroups.SoulCore.Special"
                v-model:selectedAugment="selectedAugment"
              />
            </template>
          </ui-tabs>
          <augments-list
            v-else-if="selected === 'Idol'"
            :augments="displayGroups.Idol"
            v-model:selectedAugment="selectedAugment"
          />
          <augments-list
            v-else-if="selected === 'Legacy'"
            :augments="displayGroups.Legacy"
            v-model:selectedAugment="selectedAugment"
          />
          <augments-list
            v-else-if="selected === 'Other'"
            :augments="displayGroups.Other"
            v-model:selectedAugment="selectedAugment"
          />
        </template>
      </ui-tabs>
    </div>
    <hr class="my-2 border-gray-700" />
    <div class="flex flex-row justify-between">
      <div class="flex flex-row gap-1">
        <div>{{ t(":save_type") }}</div>
        <select v-model="saveType" class="p-1 rounded bg-gray-700 w-28">
          <option value="class">
            {{ item.category ?? t(":unknown_category") }}
          </option>
          <option
            v-if="item.category === 'Wand' || item.category === 'Staff'"
            value="casterWeapon"
          >
            {{ t(":caster_weapon") }}
          </option>
          <option v-if="isMartialWeapon" value="martialWeapon">
            {{ t(":martial_weapon") }}
          </option>
          <option v-if="isArmour" value="armour">{{ t(":armour") }}</option>
          <option value="all">{{ t(":all") }}</option>
        </select>
      </div>
      <div class="flex flex-row gap-1">
        <button
          @click="handleClear"
          class="btn hover:bg-red-800 active:bg-gray-900"
        >
          {{ t(":clear") }}
        </button>

        <button
          @click="handleSave"
          class="btn hover:bg-green-800 active:bg-gray-900"
        >
          {{ t(":save") }}
        </button>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import { ITEM_BY_REF } from "@/assets/data";
import { ItemCategory, ParsedItem } from "@/parser";
import { computed, defineComponent, PropType, shallowRef, watch } from "vue";
import ItemSumPrice from "@/web/ui/ItemSumPrice.vue";
import UiTabs from "@/web/ui/UiTabs.vue";
import AugmentsList from "./AugmentsList.vue";
import { categoryAugments } from "./augment";
import { augmentTabs } from "./augment-tabs";
import { priceCheckConfig } from "@/web/price-check/price-check-config";
import { EditorItem } from "@/parser/ParsedItem";
import { buildEditorItems, useAugment } from "@/parser/augment-builder";
import { AugmentSaveType, augmentSaveKey } from "./item-editor";
import { useI18nNs } from "@/web/i18n";
import { ARMOUR, MARTIAL_WEAPON } from "@/parser/meta";

export default defineComponent({
  props: {
    item: {
      type: Object as PropType<ParsedItem>,
    },
  },
  components: {
    AugmentsList,
    ItemSumPrice,
    UiTabs,
  },
  setup(props) {
    const mainTab = shallowRef("Rune");
    const runeTab = shallowRef("Greater");
    const soulCoreTab = shallowRef("Normal");

    const saveType = shallowRef<AugmentSaveType>(AugmentSaveType.Class);

    const selectedAugment = shallowRef<EditorItem | undefined>();
    function resetSelectedAugment() {
      const rune = ITEM_BY_REF("ITEM", "Greater Iron Rune")?.[0];
      selectedAugment.value = rune
        ? buildEditorItems(
            [rune],
            props.item?.category ?? ItemCategory.Unknown,
          )[0]
        : undefined;
    }
    resetSelectedAugment();

    const displayGroups = computed(() =>
      props.item?.category ? categoryAugments(props.item.category) : null,
    );
    watch(displayGroups, resetSelectedAugment);
    const savedConfig = computed(() => priceCheckConfig().savedAugments);

    function handleSave() {
      const s = augmentSaveKey(saveType.value, props.item?.category);
      savedConfig.value[s] =
        props.item?.augmentSockets?.augments.map((a) => a?.refName ?? null) ??
        [];
    }
    function handleClear() {
      const s = augmentSaveKey(saveType.value, props.item?.category);
      savedConfig.value[s] = [];
    }

    const { t } = useI18nNs("item_editor");
    const tabs = computed(() => augmentTabs(t));

    return {
      t,
      tabs,
      mainTab,
      runeTab,
      soulCoreTab,
      selectedAugment,
      displayGroups,
      saveType,
      replaceAugment: (index: number) => {
        if (
          !props.item?.augmentSockets ||
          !selectedAugment.value ||
          props.item.augmentSockets.augments[index]?.socketBound
        )
          return;

        useAugment(props.item, selectedAugment.value, index);
      },
      selectAugment: (augment: EditorItem) => {
        selectedAugment.value = augment;
      },
      handleSave,
      handleClear,
      isMartialWeapon: computed(
        () =>
          props.item &&
          props.item.category &&
          MARTIAL_WEAPON.has(props.item.category),
      ),
      isArmour: computed(
        () =>
          props.item && props.item.category && ARMOUR.has(props.item.category),
      ),
    };
  },
});
</script>

<style lang="postcss" module>
.golden {
  color: #e4c29a;
}
</style>
