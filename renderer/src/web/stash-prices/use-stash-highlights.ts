import { createGlobalState } from "@vueuse/core";
import { computed } from "vue";
import { AppConfig } from "@/web/Config";
import { usePoeninja } from "@/web/background/Prices";
import { requireWidget } from "@/web/settings/utils";
import { highlightView, thresholdInDivine } from "./highlight-marks";
import { useStashDetector } from "./use-stash-detector";
import { useStashPricer } from "./use-stash-pricer";
import { useStashReader } from "./use-stash-reader";
import type { StashPricesWidget } from "./widget";

/**
 * Returns the app's highlights over the stash tab: what the layer draws, and whether it draws anything, which
 * `OverlayWindow.vue` counts as something to show while the game is active.
 */
export const useStashHighlights = createGlobalState(() => {
  const reader = useStashReader();
  const pricer = useStashPricer();
  const detector = useStashDetector();
  const poeninja = usePoeninja();
  const widget = () =>
    requireWidget<StashPricesWidget>("stash-prices", AppConfig());

  const threshold = computed(() => {
    const { trashThreshold } = widget();
    // findPriceByQuery is not reactive, so this reads the load time, and the rate that a league change clears
    if (
      (!poeninja.loadedAt.value || poeninja.xchgRate.value === undefined) &&
      trashThreshold.currency !== "div"
    ) {
      return null;
    }
    return thresholdInDivine(
      trashThreshold,
      (name) => poeninja.findPriceByQuery({ ns: "ITEM", name })?.primaryValue,
    );
  });

  const view = computed(() =>
    highlightView({
      open: detector.state.open,
      quad: detector.state.quad,
      grid: detector.state.grid,
      listings: reader.state.listings,
      prices: pricer.state.prices,
      counts: pricer.state.counts,
      threshold: threshold.value,
      toggles: {
        valuable: widget().highlightValuable,
        trash: widget().highlightTrash,
      },
      alignmentView: widget().alignmentView,
    }),
  );

  const shown = computed(
    () => widget().enabled && (detector.state.open || widget().alignmentView),
  );

  return { threshold, view, shown };
});
