import { createGlobalState } from "@vueuse/core";
import { AppConfig } from "@/web/Config";
import { useLeagues } from "@/web/background/Leagues";
import { priceCheckConfig } from "@/web/price-check/price-check-config";
import { requireWidget } from "@/web/settings/utils";
import { createStashReader } from "./stash-reader";
import type { StashPricesWidget } from "./widget";

/** Returns the app's one stash reader, which reads the stash prices widget's settings, the account name and the league. */
export const useStashReader = createGlobalState(() => {
  const leagues = useLeagues();
  return createStashReader({
    settings: () =>
      requireWidget<StashPricesWidget>("stash-prices", AppConfig()),
    accountName: () => AppConfig().accountName,
    leagueId: () => leagues.selectedId.value,
    priceCheckShown: () => priceCheckConfig().wmWants === "show",
  });
});
