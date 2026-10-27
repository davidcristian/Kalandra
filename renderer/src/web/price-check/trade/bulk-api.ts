import { ParsedItem } from "@/parser";
import { AppConfig } from "@/web/Config";
import {
  Ref,
  ShallowRef,
  computed,
  shallowReactive,
  shallowRef,
  watch,
} from "vue";
import { ItemFilters } from "../filters/interfaces";
import { BulkSearch, execBulkSearch, PricingResult } from "./pathofexile-bulk";

export interface BulkTab {
  listed: ShallowRef<BulkSearch | null>;
  load: () => Promise<void>;
}

export type BulkSearchExtended = Record<
  "xchgExalted" | "xchgChaos" | "xchgStable",
  BulkTab
>;

const SHOWN_ROWS = 8;

export function useBulkApi() {
  let searchId = 0;
  const error = shallowRef<string | null>(null);
  const result = shallowRef<BulkSearchExtended | null>(null);

  async function search(item: ParsedItem, filters: ItemFilters) {
    searchId += 1;
    const _searchId = searchId;
    try {
      error.value = null;
      result.value = null;

      // override, because at league start many players set wrong price, and this breaks optimistic search
      let have;
      switch (item.info.refName) {
        case "Exalted Orb":
          have = ["divine", "chaos"];
          break;
        case "Chaos Orb":
          have = ["divine", "exalted"];
          break;
        case "Divine Orb":
          have = ["exalted", "chaos"];
          break;
        default:
          have = ["divine", "exalted", "chaos"];
          break;
      }

      const optimisticSearch = await execBulkSearch(item, filters, have, {
        accountName: AppConfig().accountName,
      });
      if (_searchId === searchId) {
        result.value = {
          xchgStable: getResultsByHave(
            item,
            filters,
            optimisticSearch,
            "divine",
            _searchId,
          ),
          xchgExalted: getResultsByHave(
            item,
            filters,
            optimisticSearch,
            "exalted",
            _searchId,
          ),
          xchgChaos: getResultsByHave(
            item,
            filters,
            optimisticSearch,
            "chaos",
            _searchId,
          ),
        };
      }
    } catch (err) {
      if (_searchId === searchId) {
        error.value = (err as Error).message;
      }
    }
  }

  function getResultsByHave(
    item: ParsedItem,
    filters: ItemFilters,
    preloaded: Array<BulkSearch | null>,
    have: "divine" | "exalted" | "chaos",
    _searchId: number,
  ): BulkTab {
    const preloadedResult = preloaded.find((res) => res?.haveTag === have);
    const _result = shallowRef(
      preloadedResult ? shallowReactive(preloadedResult) : null,
    );
    let requested: boolean = _result.value != null;

    async function load() {
      if (requested) return;
      requested = true;
      try {
        const [loaded] = await execBulkSearch(item, filters, [have], {
          accountName: AppConfig().accountName,
        });
        if (!loaded) return;
        _result.value = shallowReactive(loaded);
        if (_searchId !== searchId) return;
        const otherHave =
          have === "divine"
            ? result.value?.xchgExalted.listed.value
            : result.value?.xchgStable.listed.value;
        // fix best guess we did while making optimistic search
        if (otherHave) otherHave.total -= _result.value.total;
      } catch (err) {
        if (_searchId === searchId) {
          error.value = (err as Error).message;
        }
      }
    }

    return { listed: _result, load };
  }

  return { error, result, search };
}

/** Returns the rows of the shown tab, and loads the tab when the first search left it out. */
export function useShownRows(
  result: Readonly<Ref<BulkSearchExtended | null>>,
  selected: Readonly<Ref<keyof BulkSearchExtended>>,
  ready: Readonly<Ref<boolean>>,
) {
  const shown = computed(() =>
    ready.value ? result.value?.[selected.value] : undefined,
  );
  // Runs after the window updates, so a new result's tab is selected before it loads
  watch(shown, (tab) => tab?.load(), { flush: "post" });

  return computed(() => {
    const rows = new Array<PricingResult | undefined>(SHOWN_ROWS);
    const listed = shown.value?.listed.value?.listed ?? [];
    rows.splice(0, listed.length, ...listed);
    return rows;
  });
}
