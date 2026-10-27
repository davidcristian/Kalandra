import { present } from "@specs/present";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import fs from "fs";
import path from "path";
import { CLIENT_STRINGS, init } from "@/assets/data";
import { Host } from "@/web/background/IPC";
import {
  __testExports,
  DisplayItemLine,
  requestResults,
} from "@/web/price-check/trade/pathofexile-trade";
import { setupTests } from "@specs/vitest.setup";

type FetchResult = Parameters<typeof __testExports.parseFetchResult>[0];

// The color numbers of TradeNumberColors in pathofexile-trade.ts
const WHITE = 0;
const AUGMENTED = 1;
const UNMET = 2;
const SANCTIFIED = 8732;
const FETCH_URL = "www.pathofexile.com/api/trade2/fetch/";

/** A saved listing from specs/docs/fetchResponses.json. */
function savedListing(idPrefix: string): FetchResult {
  const filePath = path.resolve(__dirname, "../../../docs/fetchResponses.json");
  const data: { result: FetchResult[] } = JSON.parse(
    fs.readFileSync(filePath, "utf8"),
  );
  return present(data.result.find((result) => result.id.startsWith(idPrefix)));
}

function getFetchResult(idPrefix: string) {
  const filePath = path.resolve(__dirname, "../../../docs/fetchResponses.json");
  const data = JSON.parse(fs.readFileSync(filePath, "utf8"));
  return data.result.find((result: { id: string }) =>
    result.id.startsWith(idPrefix),
  );
}
function getTiers(lines: DisplayItemLine[] | undefined) {
  return lines?.map((line) => line.tier);
}

describe("pathofexile-trade tooltip parsing", () => {
  beforeEach(async () => {
    setupTests();
    await init("en");
  });

  it("preserves affix tiers for listing tooltip modifiers", () => {
    const displayItem = __testExports.parseFetchResult(
      getFetchResult("65c7c4e8"),
    );
    const tiers = getTiers(present(displayItem).explicitMods);

    expect(tiers).toEqual(["P2", "S3"]);
  });

  it("reuses the same affix tier for hybrid modifier lines", () => {
    const displayItem = __testExports.parseFetchResult(
      getFetchResult("ece06af2"),
    );
    const tiers = getTiers(present(displayItem).explicitMods);

    expect(tiers).toEqual(["P7", "P7", "P5", "S5", "S6"]);
  });

  it("can do many tiers to one mod", () => {
    const displayItem = __testExports.parseFetchResult(
      getFetchResult("2fa2f1ee"),
    );
    const tiers = getTiers(present(displayItem).explicitMods);

    expect(tiers).toEqual(["P2 + P5", "P6", "P5", "S4", "S4", "S4"]);
  });

  it("can do many mods from one tier", () => {
    const displayItem = __testExports.parseFetchResult(
      getFetchResult("91c9f13"),
    );
    const tiers = getTiers(present(displayItem).explicitMods);

    expect(tiers).toEqual(["P19", "S1", "S1", "S1"]);
  });
});

describe("parseFetchResult", () => {
  beforeEach(async () => {
    setupTests();
    await init("en");
  });

  it("titles a rare by its name and base, and a magic item by its full name", () => {
    const rare = present(
      __testExports.parseFetchResult(savedListing("00d17082eb")),
    );
    const magic = present(
      __testExports.parseFetchResult(savedListing("65c7c4e8e6")),
    );

    expect([rare.title, rare.rarity]).toEqual([
      ["Phoenix Brand", "Crumbling Maul"],
      "Rare",
    ]);
    expect([magic.title, magic.rarity]).toEqual([
      ["Collector's Corsair Cap of Curvation"],
      "Magic",
    ]);
  });

  it("puts a weapon's total dps above its physical and elemental dps", () => {
    const maul = present(
      __testExports.parseFetchResult(savedListing("00d17082eb")),
    );

    expect(maul.nameBlock).toEqual([
      { text: "Two Hand Mace ", value: "", color: WHITE },
      { text: "item.total_dps", value: 131.45, color: AUGMENTED },
      { text: "item.physical_dps", value: 90.2, color: AUGMENTED },
      { text: "item.elemental_dps", value: 41.25, color: WHITE },
      { text: "item.crit", value: "8.00%", color: WHITE },
      { text: "item.aps", value: "1.10", color: WHITE },
    ]);
    expect(maul.itemProps).toEqual([
      { text: "item.item_level", value: 46, color: WHITE },
      { text: "Level ", value: "38, 68 Str", color: WHITE },
    ]);
  });

  it("shows the defence of an armour from the listing's own value", () => {
    const cap = present(
      __testExports.parseFetchResult(savedListing("65c7c4e8e6")),
    );

    expect(cap.nameBlock).toEqual([
      { text: "Helmet ", value: "", color: WHITE },
      { text: "item.evasion_rating", value: 190, color: AUGMENTED },
    ]);
  });

  it("tags a corrupted listing", () => {
    const waystone = savedListing("0c8eb03c18");

    expect(waystone.item.corrupted).toBe(true);
    expect(present(__testExports.parseFetchResult(waystone)).itemTags).toEqual([
      { text: CLIENT_STRINGS.CORRUPTED, color: UNMET },
    ]);
    expect(
      present(__testExports.parseFetchResult(savedListing("00d17082eb")))
        .itemTags,
    ).toEqual([]);
  });

  it.each([
    [
      "twice corrupted",
      { corrupted: true, doubleCorrupted: true },
      [["DOUBLE_CORRUPTED", UNMET]],
    ],
    [
      "unidentified with a tier",
      { identified: false, unidentifiedTier: 3 },
      [["Unidentified (Tier 3)", UNMET]],
    ],
    [
      "unidentified and corrupted",
      { identified: false, corrupted: true },
      [
        ["ITEM_UNIDENTIFIED", UNMET],
        ["CORRUPTED", UNMET],
      ],
    ],
    [
      "mirrored and sanctified",
      { duplicated: true, sanctified: true },
      [
        ["MIRRORED", AUGMENTED],
        ["SANCTIFIED", SANCTIFIED],
      ],
    ],
  ] as const)("tags a listing that is %s", (_, flags, tags) => {
    const listing = savedListing("00d17082eb");
    Object.assign(listing.item, flags);
    const text = (key: string): string =>
      key in CLIENT_STRINGS
        ? String(CLIENT_STRINGS[key as keyof typeof CLIENT_STRINGS])
        : key;

    expect(present(__testExports.parseFetchResult(listing)).itemTags).toEqual(
      tags.map(([key, color]) => ({ text: text(key), color })),
    );
  });
});

describe("requestResults with a listing it cannot read", () => {
  let errors: unknown[];

  beforeEach(async () => {
    setupTests();
    await init("en");
    errors = [];
    vi.spyOn(console, "error").mockImplementation((error: unknown) => {
      errors.push(error);
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // One request only: the fetch rate limit holds a second one for 5 seconds
  it("keeps the listing without its tooltip, logs the error and drops gone listings", async () => {
    const good = savedListing("00d17082eb");
    const broken = savedListing("65c7c4e8e6");
    const brokenText = JSON.stringify(broken).replace(
      '"explicitMods":[',
      '"explicitMods":[null,',
    );
    vi.mocked(Host.proxy).mockImplementation(async (input) => {
      const url = String(input);
      if (!url.startsWith(FETCH_URL)) throw new Error(`No fake for ${url}`);
      return new Response(
        `{"result":[${JSON.stringify(good)},null,${brokenText}]}`,
      );
    });

    const results = await requestResults(
      "query",
      [good.id, "gone", broken.id],
      { accountName: "" },
    );

    expect(
      results.map((result) => [
        result.id,
        result.displayItem?.title,
        result.priceAmount,
        result.itemLevel,
      ]),
    ).toEqual([
      [good.id, ["Phoenix Brand", "Crumbling Maul"], 1, "46"],
      [broken.id, undefined, present(broken.listing.price).amount, "50"],
    ]);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toBeInstanceOf(TypeError);
  });
});
