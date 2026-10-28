<template>
  <div :class="$style.layer" :style="{ fontSize: `${fontSize}px` }">
    <div
      v-if="view.cells"
      :class="$style.cells"
      :style="{
        ...box(view.cells),
        backgroundSize: `${view.cells.cell}px ${view.cells.cell}px`,
      }"
    />
    <div
      v-for="mark of marks"
      :key="mark.id"
      :class="[$style.mark, $style[mark.kind]]"
      :style="box(mark)"
    >
      <i v-if="mark.kind === 'trash'" class="fas fa-trash" />
      <span v-else-if="mark.price" :class="$style.price">{{ mark.price }}</span>
    </div>
    <div v-if="view.bar" :class="$style.bar" :style="barBox(view.bar)">
      <div
        :class="$style.fill"
        :style="{ width: `${(view.bar.share * 100).toFixed(1)}%` }"
      />
      <span :class="$style.text">{{ barText }}</span>
    </div>
  </div>
</template>

<script lang="ts">
import { computed, defineComponent } from "vue";
import { AppConfig } from "@/web/Config";
import { useI18nNs } from "@/web/i18n";
import { suggestedPriceText } from "@/web/price-check/trade/suggested-price";
import { requireWidget } from "@/web/settings/utils";
import type { Rect } from "./highlight-marks";
import { readerReserve } from "./pricer-state";
import { listingNames, pricingStatusText } from "./pricing-text";
import { useStashDetector } from "./use-stash-detector";
import { useStashHighlights } from "./use-stash-highlights";
import { useStashPricer } from "./use-stash-pricer";
import { useStashReader } from "./use-stash-reader";
import type { StashPricesWidget } from "./widget";

// The text's size in cells of a normal tab, and the smallest size that stays readable
const FONT_CELLS = 0.28;
const MIN_FONT_PX = 10;

function box(rect: Rect) {
  return {
    left: `${rect.left}px`,
    top: `${rect.top}px`,
    width: `${rect.width}px`,
    height: `${rect.height}px`,
  };
}

// A long wait reason wraps, so the bar grows down from its height
function barBox(rect: Rect) {
  return { ...box(rect), height: "auto", minHeight: `${rect.height}px` };
}

export default defineComponent({
  setup() {
    const { t } = useI18nNs("stash_prices");
    const { view } = useStashHighlights();
    const detector = useStashDetector();
    const pricer = useStashPricer();
    const reader = useStashReader();

    return {
      view,
      box,
      barBox,
      fontSize: computed(() => {
        const { grid, quad } = detector.state;
        const normalCell = quad ? grid.cell * 2 : grid.cell;
        return Math.max(MIN_FONT_PX, Math.round(normalCell * FONT_CELLS));
      }),
      marks: computed(() =>
        view.value.marks.map((mark) => ({
          ...mark,
          price:
            mark.kind === "valuable" && mark.price
              ? suggestedPriceText({ ...mark.price, price: mark.price.value })
                  .price
              : null,
        })),
      ),
      barText: computed(() => {
        const { bar } = view.value;
        const progress = t(":priced", {
          done: bar?.done ?? 0,
          total: bar?.total ?? 0,
        });
        const widget = requireWidget<StashPricesWidget>(
          "stash-prices",
          AppConfig(),
        );
        const status = pricingStatusText(
          pricer.state,
          listingNames(reader.state.listings),
          readerReserve(widget),
          (key, values) => t(key, values),
        );
        return status ? `${progress} ${status}` : progress;
      }),
    };
  },
});
</script>

<style lang="postcss" module>
.layer {
  @apply absolute inset-0 overflow-hidden;
  pointer-events: none;
}

.cells {
  @apply absolute border-r border-b border-teal-400/80;
  --line: theme("colors.teal.400 / 80%");
  background-image: linear-gradient(to right, var(--line) 1px, transparent 1px),
    linear-gradient(to bottom, var(--line) 1px, transparent 1px);
}

.mark {
  @apply absolute flex items-center justify-center;
}

.valuable {
  @apply border-2 border-yellow-400 bg-yellow-400/10;
  align-items: flex-end;
}

.trash {
  @apply border-2 border-red-600 bg-red-900/50 text-red-300;
}

.unpriced {
  @apply border border-dashed border-gray-400/80;
}

.pricing {
  @apply border border-blue-300/60;
}

.price {
  @apply w-full text-center whitespace-nowrap leading-tight;
  @apply bg-black/75 text-yellow-300;
}

.bar {
  @apply absolute flex items-center rounded overflow-hidden bg-gray-900/90;
  @apply border border-gray-600;
}

.fill {
  @apply absolute inset-y-0 left-0 bg-green-700/80;
}

.text {
  @apply relative px-2 py-0.5 leading-tight text-gray-100;
  font-size: 0.85em;
}
</style>
