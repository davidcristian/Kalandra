import { ParsedItem } from "@/parser";
import { AppConfig } from "@/web/Config";
import { Ref, ComputedRef, shallowRef, shallowReactive, computed } from "vue";
import { ItemFilters } from "../filters/interfaces";
import { BulkSearch, execBulkSearch, PricingResult } from "./pathofexile-bulk";

export function useBulkApi() {
  type BulkSearchExtended = Record<
    "xchgExalted" | "xchgChaos" | "xchgStable",
    {
      listed: Ref<BulkSearch | null>;
      listedLazy: ComputedRef<PricingResult[]>;
    }
  >;

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
  ) {
    const _result = shallowRef(
      preloaded.some((res) => res?.haveTag === have)
        ? shallowReactive(preloaded.find((res) => res?.haveTag === have)!)
        : null,
    );
    const items = shallowRef<PricingResult[]>(_result.value?.listed ?? []);
    let requested: boolean = _result.value != null;

    const listedLazy = computed(() => {
      if (!requested) {
        (async function () {
          try {
            requested = true;
            _result.value = shallowReactive(
              (
                await execBulkSearch(item, filters, [have], {
                  accountName: AppConfig().accountName,
                })
              )[0]!,
            );
            items.value = _result.value.listed;
            if (_searchId !== searchId) return;
            const otherHave =
              have === "divine"
                ? result.value?.xchgExalted?.listed.value
                : result.value?.xchgStable?.listed.value;
            // fix best guess we did while making optimistic search
            otherHave!.total -= _result.value.total;
          } catch (err) {
            if (_searchId === searchId) {
              error.value = (err as Error).message;
            }
          }
        })();
      }

      return items.value;
    });

    return { listed: _result, listedLazy };
  }

  return { error, result, search };
}
