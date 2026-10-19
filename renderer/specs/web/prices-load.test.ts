import fs from "fs";
import path from "path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { setupTests } from "@specs/vitest.setup";
import { init } from "@/assets/data";
import { Host } from "@/web/background/IPC";
import { usePoeninja } from "@/web/background/Prices";
import { HeldRequests, settle } from "./held-requests";

vi.mock("@/web/background/Leagues", async () => {
  const { computed, shallowRef } = await import("vue");
  const selectedId = shallowRef("Standard");
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

describe("usePoeninja", () => {
  beforeEach(async () => {
    setupTests();
    await init("en");
  });

  it("reports the initial load until the load that replaced it ends", async () => {
    const priceHost = new HeldRequests();
    vi.mocked(Host.proxy).mockImplementation(
      async (_url, init) => await priceHost.answer(PRICE_FILE, init?.signal),
    );
    const prices = usePoeninja();

    prices.queuePricesFetch();
    await settle();
    prices.queuePricesFetch();
    await settle();
    expect(prices.initialLoading()).toBe(true);

    priceHost.release();
    await settle();
    expect(prices.initialLoading()).toBe(false);
    expect(
      prices.findPriceByQuery({ ns: "ITEM", name: "Exalted Orb" })
        ?.primaryValue,
    ).toBe(0.001846);
  });
});
