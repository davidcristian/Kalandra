import { createGlobalState } from "@vueuse/core";
import { watch } from "vue";
import { AppConfig } from "@/web/Config";
import { useLeagues } from "@/web/background/Leagues";
import { priceCheckConfig } from "@/web/price-check/price-check-config";
import { requireWidget } from "@/web/settings/utils";
import { createStashPricer } from "./stash-pricer";
import { useStashReader } from "./use-stash-reader";
import type { StashPricesWidget } from "./widget";

/** Returns the app's one stash pricer, which prices the listings of the app's one reader while it runs. */
export const useStashPricer = createGlobalState(() => {
  const reader = useStashReader();
  const leagues = useLeagues();
  const pricer = createStashPricer({
    settings: () =>
      requireWidget<StashPricesWidget>("stash-prices", AppConfig()),
    listings: () => reader.state.listings,
    leagueId: () => leagues.selectedId.value,
    accountName: () => AppConfig().accountName,
    priceCheckShown: () => priceCheckConfig().wmWants === "show",
    readerChecking: () => reader.state.status === "checking",
  });
  // The reader replaces its list on each change, and empties it when it stops
  watch(
    () => reader.state.listings,
    () => {
      pricer.sync();
    },
    { immediate: true },
  );
  return pricer;
});
