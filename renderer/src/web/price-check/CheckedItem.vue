<template>
  <div v-if="noUniqueSelection" class="p-4 layout-column min-h-0">
    <filter-name :filters="itemFilters" :item="item" />
    <price-trend :item="item" :filters="itemFilters" />
    <filters-block
      ref="filtersComponent"
      :filters="itemFilters"
      :stats="itemStats"
      :item="item"
      :presets="presets"
      @preset="selectPreset"
      @submit="doSearch = true"
    />
    <trade-listing
      v-if="tradeAPI === 'trade' && doSearch"
      ref="tradeService"
      :filters="itemFilters"
      :stats="itemStats"
      :item="item"
    />
    <trade-bulk
      v-if="tradeAPI === 'bulk' && doSearch"
      ref="tradeService"
      :filters="itemFilters"
      :item="item"
    />
    <div v-if="!doSearch" class="flex justify-between items-center">
      <div class="flex w-40" @mouseenter="handleSearchMouseenter">
        <button class="btn" @click="doSearch = true" style="min-width: 5rem">
          {{ t("Search") }}
        </button>
      </div>
      <div class="flex flex-row gap-1">
        <trade-links v-if="tradeAPI === 'trade'" :get-link="makeTradeLink" />
      </div>
    </div>
    <stack-value :filters="itemFilters" :item="item" />
    <div v-if="showSupportLinks" class="mt-auto border border-dashed p-2">
      <!-- <div class="mb-1">
        {{ t("Support development on") }}
        <a
          href="https://patreon.com/awakened_poe_trade"
          class="inline-flex align-middle animate__animated animate__fadeInRight"
          target="_blank"
          ><img class="inline h-5" src="/images/Patreon.svg"
        /></a>
      </div> -->
      <i18n-t keypath="app.thanks_3rd_party" tag="div">
        <a
          href="https://poe.ninja/support"
          target="_blank"
          class="bg-gray-900 px-1 rounded"
          >poe.ninja</a
        >
      </i18n-t>
    </div>
    <tip v-else-if="showTip" :selected="showTip" />
  </div>
</template>

<script lang="ts">
import {
  defineComponent,
  PropType,
  watch,
  ref,
  nextTick,
  computed,
  ComponentPublicInstance,
} from "vue";
import { useI18n } from "vue-i18n";
import { ItemRarity, ItemCategory, ParsedItem } from "@/parser";
import TradeListing from "./trade/TradeListing.vue";
import TradeBulk from "./trade/TradeBulk.vue";
import TradeLinks from "./trade/TradeLinks.vue";
import { apiToSatisfySearch, getTradeEndpoint } from "./trade/common";
import PriceTrend from "./trends/PriceTrend.vue";
import FiltersBlock from "./filters/FiltersBlock.vue";
import { createPresets } from "./filters/create-presets";
import StackValue from "./stack-value/StackValue.vue";
import FilterName from "./filters/FilterName.vue";
import Tip from "../help/Tip.vue";
import {
  CATEGORY_TO_TRADE_ID,
  createTradeRequest,
} from "./trade/pathofexile-trade";
import { AppConfig } from "@/web/Config";
import { priceCheckConfig } from "@/web/price-check/price-check-config";
import { useLeagues } from "@/web/background/Leagues";
import { createTipSchedule } from "../help/tips";

let _showSupportLinksCounter = 0;
const tipSchedule = createTipSchedule(15);

export default defineComponent({
  name: "CheckedItem",
  components: {
    TradeListing,
    TradeBulk,
    TradeLinks,
    PriceTrend,
    FiltersBlock,
    FilterName,
    StackValue,
    Tip,
  },
  props: {
    item: {
      type: Object as PropType<ParsedItem>,
      required: true,
    },
    advancedCheck: {
      type: Boolean,
      required: true,
    },
  },
  setup(props) {
    const widget = computed(() => priceCheckConfig());
    const leagues = useLeagues();

    const presets = ref<ReturnType<typeof createPresets> | null>(null);
    const activePreset = computed(() => {
      const preset = presets.value?.presets.find(
        (preset) => preset.id === presets.value?.active,
      );
      if (!preset) throw new Error("The item has no active filter preset");
      return preset;
    });
    const itemFilters = computed(() => activePreset.value.filters);
    const itemStats = computed(() => activePreset.value.stats);
    const doSearch = ref(false);
    const tradeAPI = ref<"trade" | "bulk">("bulk");

    // TradeListing.vue OR TradeBulk.vue
    const tradeService = ref<{ execSearch(): void } | null>(null);
    // FiltersBlock.vue
    const filtersComponent = ref<ComponentPublicInstance | null>(null);

    watch(
      () => props.item,
      (item, prevItem) => {
        const prevCurrency =
          presets.value != null ? itemFilters.value.trade.currency : undefined;
        const prevListingType =
          presets.value != null
            ? itemFilters.value.trade.listingType
            : undefined;

        presets.value = createPresets(item, {
          league: leagues.selectedId.value ?? "",
          collapseListings: widget.value.collapseListings,
          activateStockFilter: widget.value.activateStockFilter,
          searchStatRange: widget.value.searchStatRange,
          useEn:
            (AppConfig().language === "cmn-Hant" &&
              AppConfig().realm === "pc-ggg") ||
            AppConfig().preferredTradeSite === "www",
          currency:
            widget.value.rememberCurrency ||
            (prevItem &&
              item.info.namespace === prevItem.info.namespace &&
              item.info.refName === prevItem.info.refName)
              ? prevCurrency
              : undefined,
          listingType: widget.value.rememberListingType
            ? prevListingType
            : undefined,
          defaultAllSelected: widget.value.defaultAllSelected,
        });

        if (
          (!props.advancedCheck && !widget.value.smartInitialSearch) ||
          (props.advancedCheck && !widget.value.lockedInitialSearch)
        ) {
          doSearch.value = false;
        } else {
          doSearch.value = Boolean(
            item.rarity === ItemRarity.Unique ||
              item.category === ItemCategory.Charm ||
              item.category === undefined ||
              !CATEGORY_TO_TRADE_ID.has(item.category) ||
              item.isUnidentified ||
              item.isVeiled,
          );
        }

        tradeAPI.value = apiToSatisfySearch(
          props.item,
          itemStats.value,
          itemFilters.value,
        );

        if (tradeAPI.value === "bulk") {
          itemFilters.value.trade.listingType = "online";
        }
      },
      { immediate: true, deep: true },
    );

    watch(
      () => [props.item, doSearch.value],
      () => {
        if (doSearch.value === false) return;

        tradeAPI.value = apiToSatisfySearch(
          props.item,
          itemStats.value,
          itemFilters.value,
        );

        // NOTE: child `trade-xxx` component renders/receives props on nextTick
        void nextTick(() => {
          if (tradeService.value) {
            tradeService.value.execSearch();
          }
        }); // Nothing waits for the search to start
      },
      { deep: false, immediate: true },
    );

    watch(
      () => [props.item, doSearch.value, itemStats.value, itemFilters.value],
      (curr, prev) => {
        const cItem = curr[0];
        const pItem = prev[0];
        const cIntaracted = curr[1];
        const pIntaracted = prev[1];

        if (cItem === pItem && cIntaracted === true && pIntaracted === true) {
          // force user to press Search button on change
          doSearch.value = false;
        }
      },
      { deep: true },
    );

    watch(
      () => [props.item, JSON.stringify(itemFilters.value.trade)],
      (curr, prev) => {
        const cItem = curr[0];
        const pItem = prev[0];
        const cTrade = curr[1];
        const pTrade = prev[1];

        if (cItem === pItem && cTrade !== pTrade) {
          void nextTick(() => {
            doSearch.value = true;
          }); // Nothing waits for the flag to change
        }
      },
      { deep: false },
    );

    const noUniqueSelection = computed(() => {
      return !(
        props.item.rarity === ItemRarity.Unique &&
        props.item.isUnidentified &&
        props.item.info.unique == null
      );
    });

    function handleSearchMouseenter(e: MouseEvent) {
      if (
        filtersComponent.value &&
        (filtersComponent.value.$el as HTMLElement).contains(
          e.relatedTarget as HTMLElement,
        )
      ) {
        doSearch.value = true;

        if (document.activeElement instanceof HTMLElement) {
          document.activeElement.blur();
        }
      }
    }

    const showSupportLinks = ref(false);
    const showTip = ref(0);
    watch(
      () => [props.item, doSearch.value],
      ([cItem, cInteracted], [pItem]) => {
        if (
          _showSupportLinksCounter >= 13 &&
          (!cInteracted || tradeAPI.value === "bulk")
        ) {
          showSupportLinks.value = true;
          _showSupportLinksCounter = 0;
        } else {
          showSupportLinks.value = false;
          showTip.value = tipSchedule.next(
            AppConfig().tipsFrequency,
            cItem !== pItem,
            Boolean(cInteracted),
          );

          if (cItem !== pItem) {
            _showSupportLinksCounter += 1;
          }
        }
      },
    );

    const { t } = useI18n();

    return {
      t,
      itemFilters,
      itemStats,
      doSearch,
      tradeAPI,
      tradeService,
      filtersComponent,
      showTip,
      noUniqueSelection,
      handleSearchMouseenter,
      showSupportLinks,
      presets: computed(
        () =>
          presets.value?.presets.map((preset) => ({
            id: preset.id,
            active: preset.id === presets.value?.active,
          })) ?? [],
      ),
      selectPreset(id: string) {
        if (presets.value) presets.value.active = id;
      },
      makeTradeLink() {
        return `https://${getTradeEndpoint()}/trade2/search/poe2/${itemFilters.value.trade.league}?q=${JSON.stringify(createTradeRequest(itemFilters.value, itemStats.value, props.item))}`;
      },
    };
  },
});
</script>
