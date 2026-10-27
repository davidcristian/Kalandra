import { present } from "@specs/present";
import fs from "fs";
import path from "path";
import { beforeEach, describe, expect, it } from "vitest";
import { setupTests } from "@specs/vitest.setup";
import { init, ITEM_BY_REF } from "@/assets/data";
import { ItemCategory, ItemRarity, ParsedItem, parseClipboard } from "@/parser";
import { createVirtualItem } from "@/parser/ParsedItem";
import { __testExports, NinjaSchema } from "@/web/background/Prices";
import { getDetailsId } from "@/web/price-check/trends/getDetailsId";
import {
  ArmourHighValueRareItem,
  MagicItem,
  MetaSkillGem,
  NewExplicitTypeDefinitions,
  NormalItem,
  RareItem,
  RareMap,
  RareWithImplicit,
  TwoImplicitItem,
  UnidentifiedTier,
} from "@specs/Parser/items";

const RENDERER = path.resolve(__dirname, "../../../..");
const readText = (file: string) => fs.readFileSync(file, "utf-8");
const SCHEMA: NinjaSchema = JSON.parse(
  readText(path.join(RENDERER, "public/data/namespaceMap.json")),
);

// Takes the category from the base item, as the parser does for a unique.
function parsedUnique(refName: string) {
  const info = present(ITEM_BY_REF("UNIQUE", refName))[0];
  return createVirtualItem({
    rarity: ItemRarity.Unique,
    category: present(
      present(ITEM_BY_REF("ITEM", present(info.unique).base))[0].craftable,
    ).category,
    info,
  });
}

// Takes no rarity, as the parser does for an item whose rarity line is Currency.
function parsedCurrency(refName: string) {
  return createVirtualItem({
    category: ItemCategory.Currency,
    info: present(ITEM_BY_REF("ITEM", refName))[0],
  });
}

function findPrice(priceFile: string, item: ParsedItem) {
  const { findInDatabase, splitJsonBlob } = __testExports;
  const query = present(getDetailsId(item));
  return findInDatabase(splitJsonBlob(priceFile, SCHEMA), query)?.info;
}

const servicePriceFile = () =>
  readText(
    path.join(RENDERER, "../priceService/tests/fixtures/price_file.json"),
  );

describe("getDetailsId", () => {
  beforeEach(async () => {
    setupTests();
    await init("en");
  });

  it("finds a unique weapon in the price file the price service writes", () => {
    expect(
      findPrice(servicePriceFile(), parsedUnique("Redbeak"))?.detailsId,
    ).toBe("redbeak-shortsword");
  });

  it("finds a currency item in the price file the price service writes", () => {
    expect(
      findPrice(servicePriceFile(), parsedCurrency("Exalted Orb"))?.detailsId,
    ).toBe("exalted-orb");
  });

  it("finds a unique flask by its base type, which the price service writes as its variant", () => {
    // stash_lines in priceService/price_service/transform.py writes a line with a baseType this way.
    const priceFile = JSON.stringify({
      itemOverviews: [
        {
          type: "UniqueFlasks",
          lines: [
            {
              name: "Olroth's Resolve",
              variant: "Ultimate Life Flask",
              primaryValue: 1.5,
              detailsId: "olroths-resolve-ultimate-life-flask",
              sparkline: { totalChange: 0, data: [] },
            },
          ],
        },
      ],
    });

    expect(
      findPrice(priceFile, parsedUnique("Olroth's Resolve"))?.primaryValue,
    ).toBe(1.5);
  });

  it.each([
    [
      "a skill gem by its name",
      MetaSkillGem,
      "GEM",
      "Mirage Archer",
      undefined,
    ],
    [
      "a waystone by its tier",
      RareMap,
      "ITEM",
      "Waystone (Tier 14)",
      "T14, Gen-18",
    ],
  ])("looks up %s", (_, item, ns, name, variant) => {
    const parsed = parseClipboard(item.rawText)._unsafeUnwrap();

    expect(getDetailsId(parsed)).toEqual({ ns, name, variant });
  });

  it.each([
    ["a normal armour piece", NormalItem],
    ["a magic weapon", MagicItem],
    ["a magic ring", UnidentifiedTier],
    ["a rare weapon", RareItem],
    ["a rare armour piece", ArmourHighValueRareItem],
    ["a rare ring", RareWithImplicit],
    ["a rare amulet", NewExplicitTypeDefinitions],
    ["a rare belt", TwoImplicitItem],
  ])(
    "returns no query for %s, whose base type the price file never has",
    (_, item) => {
      const parsed = parseClipboard(item.rawText)._unsafeUnwrap();

      expect(getDetailsId(parsed)).toBeUndefined();
    },
  );
});
