import fs from "fs";
import path from "path";
import { reactive } from "vue";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { IpcEvent } from "@ipc/types";
import { setupTests } from "@specs/vitest.setup";
import { init } from "@/assets/data";
import { AppConfig } from "@/web/Config";
import { Host } from "@/web/background/IPC";
import { useLeagues } from "@/web/background/Leagues";
import { DivCurrency, usePoeninja } from "@/web/background/Prices";
import { PriceCheckWidget } from "@/web/overlay/widgets";
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
const EXALTED_ORB = { ns: "ITEM", name: "Exalted Orb" };
const PUBLIC_DIR = path.resolve(__dirname, "../../public");

let widget: PriceCheckWidget;
let warnings: string[];
let sentToMain: IpcEvent[];

/** Answers each price file request with `body`, and fails an aborted request as fetch does. */
function servePriceFile(body: string, status = 200) {
  vi.mocked(Host.proxy).mockImplementation(async (_url, init) => {
    init?.signal?.throwIfAborted();
    return new Response(body, { status });
  });
}

/** Selects a league that no earlier test selected, so its price file loads at once. */
async function selectLeague(id: string) {
  useLeagues().selectedId.value = id;
  await settle();
}

/** Returns the fixture price file with one Divine Orb priced at `rate` Chaos Orbs. */
function withChaosRate(rate: number) {
  return PRICE_FILE.replace('"chaos":8.53}', `"chaos":${rate}}`);
}

beforeEach(async () => {
  setupTests();
  vi.mocked(Host.proxy).mockReset();
  await init("en");
  widget = reactive({
    ...AppConfig<PriceCheckWidget>("price-check")!,
    coreCurrency: "exalted",
  });
  AppConfig().widgets = [widget];
  warnings = [];
  vi.spyOn(console, "warn").mockImplementation((error: unknown) => {
    warnings.push(String(error));
  });
  sentToMain = [];
  vi.mocked(Host.sendEvent).mockImplementation((event) => {
    sentToMain.push(event);
  });
});

describe("usePoeninja after a change of league or core currency", () => {
  it("drops converted prices while the new league's price file downloads", async () => {
    const prices = usePoeninja();
    servePriceFile(PRICE_FILE);
    await selectLeague("Fixture League A");
    expect(prices.cachedCurrencyByQuery(EXALTED_ORB, 100)?.currency).toBe(
      "exalted",
    );

    const priceHost = new HeldRequests();
    vi.mocked(Host.proxy).mockImplementation(
      async (_url, init) => await priceHost.answer(PRICE_FILE, init?.signal),
    );
    await selectLeague("Fixture League B");
    expect(prices.cachedCurrencyByQuery(EXALTED_ORB, 100)).toBeUndefined();
  });

  it("drops converted prices when the reload after a core currency change fails", async () => {
    const prices = usePoeninja();
    servePriceFile(PRICE_FILE);
    await selectLeague("Fixture League C");
    expect(prices.cachedCurrencyByQuery(EXALTED_ORB, 100)?.currency).toBe(
      "exalted",
    );

    servePriceFile("", 404);
    widget.coreCurrency = "chaos";
    await settle();
    expect(warnings).toEqual([
      "Error: No price file for Fixture League C (404)",
    ]);
    expect(prices.cachedCurrencyByQuery(EXALTED_ORB, 100)).toBeUndefined();
  });
});

describe("usePoeninja when the price file is missing", () => {
  it("sends the error to main's log, which Settings, Debug shows", async () => {
    usePoeninja();
    servePriceFile("", 404);
    await selectLeague("Fixture League G");

    expect(sentToMain).toEqual([
      {
        name: "CLIENT->MAIN::log-entry",
        payload: {
          level: "warn",
          message:
            "Loading prices failed: No price file for Fixture League G (404)",
        },
      },
    ]);
  });
});

describe("usePoeninja with Chaos Orb as the core currency", () => {
  it("converts and labels prices in Exalted Orbs below 5 Chaos Orbs per Divine Orb", async () => {
    const prices = usePoeninja();
    widget.coreCurrency = "chaos";
    servePriceFile(withChaosRate(4.9));
    await selectLeague("Fixture League D");

    expect(prices.xchgRate.value).toBe(541.6);
    expect(prices.xchgRateCurrency.value?.id).toBe("exalted");
    const price = prices.autoCurrency(0.01);
    expect(price.currency).toBe("exalted");
    expect(price.min).toBeCloseTo(5.416);
    expect(prices.comparePrice(price, "<", prices.autoCurrency(0.02))).toBe(
      true,
    );
  });

  it("converts and labels prices in Chaos Orbs from 5 Chaos Orbs per Divine Orb", async () => {
    const prices = usePoeninja();
    widget.coreCurrency = "chaos";
    servePriceFile(withChaosRate(5));
    await selectLeague("Fixture League E");

    expect(prices.xchgRate.value).toBe(5);
    expect(prices.xchgRateCurrency.value?.id).toBe("chaos");
    const price = prices.autoCurrency(0.5);
    expect(price).toEqual({ min: 2.5, max: 2.5, currency: "chaos" });
    expect(prices.comparePrice(price, "<", prices.autoCurrency(0.6))).toBe(
      true,
    );
  });
});

describe("usePoeninja currencies", () => {
  it("name an image file that the app serves for each currency icon", async () => {
    const prices = usePoeninja();
    servePriceFile(PRICE_FILE);
    await selectLeague("Fixture League F");

    const icons = [...prices.availableCoreCurrencies.value, DivCurrency].map(
      (currency) => currency.icon,
    );
    expect(icons).toHaveLength(3);
    expect(
      icons.filter((icon) => !fs.existsSync(path.join(PUBLIC_DIR, icon))),
    ).toEqual([]);
  });
});
