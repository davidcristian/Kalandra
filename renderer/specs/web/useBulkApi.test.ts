import { beforeEach, describe, expect, it, vi } from "vitest";
import { ComputedRef, ShallowRef, shallowRef, watch } from "vue";
import { ParsedItem } from "@/parser";
import { ItemFilters } from "@/web/price-check/filters/interfaces";
import {
  BulkSearchExtended,
  useBulkApi,
  useShownRows,
} from "@/web/price-check/trade/bulk-api";
import {
  BulkSearch,
  PricingResult,
  execBulkSearch,
} from "@/web/price-check/trade/pathofexile-bulk";
import { setupTests } from "@specs/vitest.setup";
import { settle } from "./held-requests";

vi.mock("@/web/price-check/trade/pathofexile-bulk", () => ({
  execBulkSearch: vi.fn(),
}));

type Answer = PromiseWithResolvers<Array<BulkSearch | null>>;

const ITEM = { info: { refName: "Greater Chaos Orb" } } as ParsedItem;
const CHAOS_ORB = { info: { refName: "Chaos Orb" } } as ParsedItem;
const DIVINE_ORB = { info: { refName: "Divine Orb" } } as ParsedItem;

const LISTING: PricingResult = {
  id: "listing",
  relativeDate: "1 min. ago",
  exchangeAmount: 1,
  itemAmount: 40,
  stock: 400,
  accountStatus: "online",
  isMine: false,
  accountName: "seller",
  ign: "Seller",
};

/** Holds each exchange search until the test answers it, in the order they were sent. */
function holdSearches(): Answer[] {
  const held: Answer[] = [];
  vi.mocked(execBulkSearch).mockImplementation(() => {
    const answer = Promise.withResolvers<Array<BulkSearch | null>>();
    held.push(answer);
    return answer.promise;
  });
  return held;
}

function offers(
  haveTag: string,
  total: number,
  listed: PricingResult[] = [],
): BulkSearch {
  return { queryId: haveTag, haveTag, total, listed };
}

/** The first answer for a common item: no Exalted Orb offers, so that tab loads when it is shown. */
function withoutExalted(): Array<BulkSearch | null> {
  return [offers("divine", 30), null, offers("chaos", 7)];
}

function search(
  bulk: ReturnType<typeof useBulkApi>,
  league: string,
  item = ITEM,
) {
  return bulk.search(item, { trade: { league } } as ItemFilters);
}

describe("useBulkApi", () => {
  let bulk: ReturnType<typeof useBulkApi>;
  let held: Answer[];

  beforeEach(() => {
    setupTests();
    held = holdSearches();
    bulk = useBulkApi();
  });

  it("shows the error of the current search", async () => {
    const current = search(bulk, "league");
    held[0].reject(new Error("Rate limit exceeded"));
    await current;

    expect(bulk.error.value).toBe("Rate limit exceeded");
  });

  it("keeps the newer search's state when an older search fails later", async () => {
    const older = search(bulk, "older");
    const newer = search(bulk, "newer");
    held[1].resolve(withoutExalted());
    await newer;
    held[0].reject(new Error("Rate limit exceeded"));
    await older;

    expect(bulk.error.value).toBeNull();
    expect(bulk.result.value?.xchgStable.listed.value?.total).toBe(30);
  });

  it("subtracts the total of a tab loaded later from the Divine Orb tab", async () => {
    const current = search(bulk, "league");
    held[0].resolve(withoutExalted());
    await current;

    void bulk.result.value?.xchgExalted.load();
    held[1].resolve([offers("exalted", 12)]);
    await settle();

    expect(bulk.result.value?.xchgStable.listed.value?.total).toBe(18);
  });

  it("loads the Exalted Orb tab of a Divine Orb while its Divine Orb tab is empty", async () => {
    const current = search(bulk, "league", DIVINE_ORB);
    held[0].resolve([null, offers("chaos", 7)]);
    await current;

    void bulk.result.value?.xchgExalted.load();
    held[1].resolve([offers("exalted", 12)]);
    await settle();

    expect(bulk.error.value).toBeNull();
    expect(bulk.result.value?.xchgExalted.listed.value?.total).toBe(12);
  });

  it.each([
    ["fails", (answer: Answer) => answer.reject(new Error("Bad request"))],
    ["loads", (answer: Answer) => answer.resolve([offers("exalted", 12)])],
  ])(
    "keeps the newer search's state when a tab of an older search %s later",
    async (_, settleTab) => {
      const older = search(bulk, "older");
      held[0].resolve(withoutExalted());
      await older;
      void bulk.result.value?.xchgExalted.load();

      const newer = search(bulk, "newer");
      held[2].resolve(withoutExalted());
      await newer;
      settleTab(held[1]);
      await settle();

      expect(bulk.error.value).toBeNull();
      expect(bulk.result.value?.xchgStable.listed.value?.total).toBe(30);
    },
  );
});

describe("useShownRows", () => {
  let bulk: ReturnType<typeof useBulkApi>;
  let held: Answer[];
  let selected: ShallowRef<keyof BulkSearchExtended>;
  let ready: ShallowRef<boolean>;
  let rows: ComputedRef<Array<PricingResult | undefined>>;

  beforeEach(() => {
    setupTests();
    held = holdSearches();
    bulk = useBulkApi();
    selected = shallowRef("xchgChaos");
    ready = shallowRef(true);
    rows = useShownRows(bulk.result, selected, ready);
  });

  it("loads a tab that the first search left out when it is shown", async () => {
    const current = search(bulk, "league");
    held[0].resolve(withoutExalted());
    await current;
    selected.value = "xchgExalted";
    await settle();
    held[1].resolve([offers("exalted", 12, [LISTING])]);
    await settle();

    expect(rows.value).toHaveLength(8);
    expect(rows.value[0]).toEqual(LISTING);
  });

  it("loads the shown tab only once the results show", async () => {
    ready.value = false;
    selected.value = "xchgExalted";
    const current = search(bulk, "league");
    held[0].resolve(withoutExalted());
    await current;
    await settle();

    expect(held).toHaveLength(1);
    expect(rows.value[0]).toBeUndefined();

    ready.value = true;
    await settle();
    held[1].resolve([offers("exalted", 12, [LISTING])]);
    await settle();

    expect(rows.value[0]).toEqual(LISTING);
  });

  it("loads no tab that a new result replaces in the same update", async () => {
    watch(bulk.result, (result) => {
      if (result) selected.value = "xchgStable";
    });
    const current = search(bulk, "league", CHAOS_ORB);
    held[0].resolve([offers("divine", 30, [LISTING]), offers("exalted", 12)]);
    await current;
    await settle();

    expect(held).toHaveLength(1);
    expect(rows.value[0]).toEqual(LISTING);
  });
});
