import { beforeEach, describe, expect, it, vi } from "vitest";
import { ParsedItem } from "@/parser";
import { ItemFilters } from "@/web/price-check/filters/interfaces";
import { useBulkApi } from "@/web/price-check/trade/bulk-api";
import {
  BulkSearch,
  execBulkSearch,
} from "@/web/price-check/trade/pathofexile-bulk";
import { setupTests } from "@specs/vitest.setup";
import { settle } from "./held-requests";

vi.mock("@/web/price-check/trade/pathofexile-bulk", () => ({
  execBulkSearch: vi.fn(),
}));

type Answer = PromiseWithResolvers<Array<BulkSearch | null>>;

const ITEM = { info: { refName: "Greater Chaos Orb" } } as ParsedItem;

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

function offers(haveTag: string, total: number): BulkSearch {
  return { queryId: haveTag, haveTag, total, listed: [] };
}

/** The first answer for a common item: no Exalted Orb offers, so that tab loads when it is shown. */
function withoutExalted(): Array<BulkSearch | null> {
  return [offers("divine", 30), null, offers("chaos", 7)];
}

function search(bulk: ReturnType<typeof useBulkApi>, league: string) {
  return bulk.search(ITEM, { trade: { league } } as ItemFilters);
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

    expect(bulk.result.value?.xchgExalted.listedLazy.value).toEqual([]);
    held[1].resolve([offers("exalted", 12)]);
    await settle();

    expect(bulk.result.value?.xchgStable.listed.value?.total).toBe(18);
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
      expect(bulk.result.value?.xchgExalted.listedLazy.value).toEqual([]);

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
