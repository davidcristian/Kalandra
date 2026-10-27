<template>
  <div v-if="!error" class="layout-column min-h-0" style="height: auto">
    <div class="mb-2 flex pl-2">
      <div class="flex items-baseline text-gray-500 mr-2">
        <span class="mr-1">{{ t(":matched") }}</span>
        <span v-if="!list" class="text-gray-600">...</span>
        <span v-else>{{ list.total }}{{ list.inexact ? "+" : "" }}</span>
      </div>
      <online-filter
        v-if="list"
        :by-time="true"
        :filters="filters"
        api="trade"
      />
      <div class="flex-1"></div>
      <trade-links v-if="list" :get-link="makeTradeLink" />
    </div>
    <suggested-price
      v-if="!item.stackSize"
      :listings="listings"
      :loading="listingsLoading"
    />

    <div class="layout-column overflow-y-auto overflow-x-hidden">
      <table class="table-stripped w-full">
        <thead>
          <tr class="text-left">
            <th class="trade-table-heading">
              <div class="px-2">{{ t(":price") }}</div>
            </th>
            <th v-if="item.stackSize" class="trade-table-heading">
              <div class="px-2">{{ t(":stock") }}</div>
            </th>
            <th v-if="filters.itemLevel" class="trade-table-heading">
              <div class="px-2">{{ t(":item_level") }}</div>
            </th>
            <th v-if="isGem" class="trade-table-heading">
              <div class="px-2">{{ t(":gem_level") }}</div>
            </th>
            <th v-if="isGem || grantsSkill" class="trade-table-heading">
              <div class="px-2">{{ t(":gem_sockets") }}</div>
            </th>
            <th
              v-if="(filters.quality && !filters.quality.disabled) || isGem"
              class="trade-table-heading"
            >
              <div class="px-2">{{ t(":quality") }}</div>
            </th>
            <th class="trade-table-heading" :class="{ 'w-full': !showSeller }">
              <div class="pr-2 pl-4">
                <span class="ml-1" style="padding-left: 0.375rem">{{
                  t(":listed")
                }}</span>
              </div>
            </th>
            <th v-if="showSeller" class="trade-table-heading w-full">
              <div class="px-2">{{ t(":seller") }}</div>
            </th>
          </tr>
        </thead>
        <tbody style="overflow: scroll">
          <template v-for="(result, idx) in groupedResults">
            <tr v-if="!result" :key="idx">
              <td colspan="100" class="text-transparent">***</td>
            </tr>
            <trade-item
              v-else
              :key="result.id"
              :result="result"
              :item="item"
              :show-seller="showSeller"
              :item-level="filters.itemLevel"
              :quality="filters.quality"
            />
          </template>
        </tbody>
      </table>
      <!-- LIKELY PRICE FIXED -->
      <div
        v-if="isLikelyPriceFixed"
        class="p-2 border-2 border-gray-600 rounded mt-2"
      >
        <div class="flex text-gray-400 leading-none">
          <div class="mt-1">
            {{ t(":likely_price_fixed") }}
          </div>
          <div class="flex-1" />
          <div class="pl-2">
            <button class="btn" @click="execFilterExaltDivine">
              {{ t(":filter_exalt_divine") }}
              <i class="fas fa-history text-xs" />
            </button>
          </div>
        </div>
      </div>

      <!-- Extraction Value -->
      <extraction-value :item="item" :first-result="groupedResults.at(0)" />
    </div>
  </div>
  <ui-error-box v-else>
    <template #name>{{ t(":error") }}</template>
    <p>{{ t(":error_detail", [error]) }}</p>
    <div v-if="error && errorFix" class="border p-1 rounded">
      {{ errorFix }}
    </div>
    <template #actions>
      <button class="btn" @click="execSearch">{{ t("Retry") }}</button>
      <button class="btn" @click="openTradeLink">{{ t("Browser") }}</button>
    </template>
  </ui-error-box>
</template>

<script lang="ts">
import { defineComponent, computed, watch, PropType } from "vue";
import { injectShowBrowser } from "@/web/overlay/injections";
import { useI18nNs } from "@/web/i18n";
import UiErrorBox from "@/web/ui/UiErrorBox.vue";
import { createTradeRequest } from "./pathofexile-trade";
import { getTradeEndpoint } from "./common";
import { priceCheckConfig } from "@/web/price-check/price-check-config";
import { ItemFilters, StatFilter } from "../filters/interfaces";
import { ParsedItem } from "@/parser";
import { artificialSlowdown } from "./artificial-slowdown";
import OnlineFilter from "./OnlineFilter.vue";
import TradeLinks from "./TradeLinks.vue";
import TradeItem from "./TradeItem.vue";
import { useTradeApi } from "./trade-api";
import { GEM, GRANTS_REAL_SKILL } from "@/parser/meta";
import ExtractionValue from "./ExtractionValue.vue";
import SuggestedPrice from "./SuggestedPrice.vue";

const slowdown = artificialSlowdown(900);

const SHOW_RESULTS = 20;

export default defineComponent({
  components: {
    ExtractionValue,
    OnlineFilter,
    SuggestedPrice,
    TradeLinks,
    TradeItem,
    UiErrorBox,
  },
  props: {
    filters: {
      type: Object as PropType<ItemFilters>,
      required: true,
    },
    stats: {
      type: Array as PropType<StatFilter[]>,
      required: true,
    },
    item: {
      type: Object as PropType<ParsedItem>,
      required: true,
    },
  },
  setup(props) {
    const widget = computed(() => priceCheckConfig());
    watch(
      () => props.item,
      (item) => {
        slowdown.reset(item);
      },
      { immediate: true },
    );

    const { error, searchResult, groupedResults, search } = useTradeApi();

    const showBrowser = injectShowBrowser();

    const { t } = useI18nNs("trade_result");

    function makeTradeLink() {
      return searchResult.value
        ? `https://${getTradeEndpoint()}/trade2/search/poe2/${props.filters.trade.league}/${searchResult.value.id}`
        : `https://${getTradeEndpoint()}/trade2/search/poe2/${props.filters.trade.league}?q=${JSON.stringify(createTradeRequest(props.filters, props.stats, props.item))}`;
    }

    return {
      t,
      list: searchResult,
      listings: groupedResults,
      listingsLoading: computed(
        () =>
          !slowdown.isReady.value ||
          !searchResult.value ||
          (searchResult.value.result.length > 0 &&
            groupedResults.value.length === 0),
      ),
      groupedResults: computed(() => {
        if (!slowdown.isReady.value) {
          return Array<undefined>(SHOW_RESULTS);
        } else {
          return [
            ...groupedResults.value,
            ...(groupedResults.value.length < SHOW_RESULTS
              ? Array<undefined>(SHOW_RESULTS - groupedResults.value.length)
              : []),
          ];
        }
      }),
      execSearch: () => {
        void search(props.filters, props.stats, props.item); // search() sets error when it fails
      },
      execFilterExaltDivine: () => {
        props.filters.trade.currency = "exalted_divine";
      },
      error,
      errorFix: computed(() => {
        if (error.value?.startsWith("Query is too complex.")) {
          return t(":fix_complex_query");
        }

        return undefined;
      }),
      showSeller: computed(() => widget.value.showSeller),
      makeTradeLink,
      openTradeLink() {
        showBrowser(makeTradeLink());
      },
      isGem: computed(
        () => props.item.category && GEM.has(props.item.category),
      ),
      grantsSkill: computed(
        () => props.item.category && GRANTS_REAL_SKILL.has(props.item.category),
      ),
      isLikelyPriceFixed: computed(() => {
        if (groupedResults.value.length <= 15) {
          return false;
        }
        const commonCurrencyPrices = groupedResults.value.filter((res) => {
          return (
            // is a common currency
            /chaos|exalted|divine/i.test(res.priceCurrency) ||
            // is a common very low value currency (but not enhanced versions)
            ((res.priceCurrency === "aug" ||
              res.priceCurrency === "regal" ||
              res.priceCurrency === "transmute") &&
              res.priceAmount < 30)
          );
        });
        if (commonCurrencyPrices.length < 5) {
          return true;
        }

        return false;
      }),
    };
  },
});
</script>

<style lang="postcss">
.trade-table-heading {
  @apply sticky top-0;
  @apply bg-gray-800;
  @apply p-0 m-0;
  @apply whitespace-nowrap;

  & > div {
    @apply border-b border-gray-700;
  }
}

.account-status {
  width: 0.375rem;
  height: 0.375rem;
  border-radius: 100%;

  &.instantBuyout {
    /* */
  }

  &.online {
    @apply bg-pink-400;
  }

  &.offline {
    @apply bg-red-600;
  }

  &.afk {
    @apply bg-orange-500;
  }

  &.rank-2 {
    @apply bg-blue-600;
  }

  &.rank-3 {
    @apply bg-yellow-600;
  }
}
</style>
