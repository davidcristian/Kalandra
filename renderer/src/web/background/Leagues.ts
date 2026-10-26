import { computed, shallowRef, readonly } from "vue";
import { createGlobalState } from "@vueuse/core";
import { AppConfig, poeWebApi } from "@/web/Config";
import { Host } from "./IPC";
import { readTradeData } from "@/web/price-check/trade/trade-response";

interface TradeLeague {
  id: string;
  text: string;
}

export const useLeagues = createGlobalState(() => {
  const isLoading = shallowRef(false);
  const error = shallowRef<string | null>(null);
  const tradeLeagues = shallowRef<TradeLeague[]>([]);

  const selectedId = computed<string | undefined>({
    get() {
      return tradeLeagues.value.length ? AppConfig().leagueId : undefined;
    },
    set(id) {
      AppConfig().leagueId = id;
    },
  });

  const selected = computed(() => {
    const { leagueId } = AppConfig();
    if (!leagueId) return undefined;
    const listed = tradeLeagues.value.some((league) => league.id === leagueId);
    return {
      id: leagueId,
      realm: AppConfig().realm,
      isPopular: listed && !isPrivateLeague(leagueId),
    };
  });

  async function load() {
    isLoading.value = true;
    error.value = null;

    try {
      // TODO: swap back to /api/leagues?realm=poe2 when available (allows detection of Hardcore leagues)
      const response = await Host.proxy(
        `${poeWebApi()}/api/trade2/data/leagues`,
      );
      const leagues = await readTradeData<{ result: TradeLeague[] }>(response);
      tradeLeagues.value = leagues.result.map(({ id, text }) => ({ id, text }));

      const leagueIsAlive = tradeLeagues.value.some(
        (league) => league.id === selectedId.value,
      );
      if (!leagueIsAlive && !isPrivateLeague(selectedId.value ?? "")) {
        if (tradeLeagues.value.length > 2) {
          const TMP_CHALLENGE = 2;
          selectedId.value = tradeLeagues.value[TMP_CHALLENGE].id;
        } else {
          const STANDARD = 0;
          selectedId.value = tradeLeagues.value[STANDARD].id;
        }
      }
    } catch (e) {
      console.warn("Cannot load the trade leagues:", e);
      error.value = (e as Error).message;
    } finally {
      isLoading.value = false;
    }
  }

  return {
    isLoading,
    error,
    selectedId,
    selected,
    list: readonly(tradeLeagues),
    load,
  };
});

function isPrivateLeague(id: string) {
  return /\(PL\d+\)$/.test(id);
}
