import fs from "fs";
import path from "path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { setupTests } from "@specs/vitest.setup";
import { init } from "@/assets/data";
import { Host } from "@/web/background/IPC";
import { useLeagues } from "@/web/background/Leagues";
import { usePoeninja } from "@/web/background/Prices";
import { settle } from "./held-requests";

vi.mock("@/web/background/Leagues", async () => {
  const { computed, shallowRef } = await import("vue");
  const selectedId = shallowRef<string | undefined>("Standard");
  const selected = computed(() => ({
    id: selectedId.value,
    realm: "pc-ggg",
    isPopular: true,
  }));
  return { useLeagues: () => ({ selectedId, selected }) };
});

const PRICE_FILE = fs.readFileSync(
  path.resolve(
    __dirname,
    "../../../priceService/tests/fixtures/price_file.json",
  ),
  "utf-8",
);

describe("findPriceByQuery", () => {
  beforeEach(async () => {
    setupTests();
    await init("en");
  });

  it("links a price to poe.ninja in the selected league, and finds none without a league", async () => {
    vi.mocked(Host.proxy).mockImplementation(
      async () => await Promise.resolve(new Response(PRICE_FILE)),
    );
    const prices = usePoeninja();
    prices.queuePricesFetch();
    await settle();
    const query = { ns: "ITEM", name: "Exalted Orb" } as const;

    expect(prices.findPriceByQuery(query)?.url).toContain(
      "/poe2/economy/standard/",
    );
    useLeagues().selectedId.value = undefined;
    expect(prices.findPriceByQuery(query)).toBeNull();
  });
});
