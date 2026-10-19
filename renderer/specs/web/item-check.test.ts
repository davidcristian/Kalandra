import { init } from "@/assets/data";
import { parseClipboard } from "@/parser";
import { __testExports } from "@/web/item-check/hotkeyable-actions";
import { NormalItem, NormalOnTradeOnlyBase } from "@specs/Parser/items";
import { setupTests } from "@specs/vitest.setup";
import { beforeEach, describe, expect, it } from "vitest";

describe("encodePoe2dbUri", () => {
  it("should encode all spaces", () => {
    const result = __testExports.encodePoe2dbUri("a b c");
    expect(result).toBe("a_b_c");
  });

  it("should remove all single quotes", () => {
    const result = __testExports.encodePoe2dbUri("a'b'c");
    expect(result).toBe("abc");
  });

  it("should do both", () => {
    const result = __testExports.encodePoe2dbUri("a'b c");
    expect(result).toBe("ab_c");
  });

  it("should leave all others unchanged", () => {
    const result = __testExports.encodePoe2dbUri("A/b-cö");
    expect(result).toBe("A/b-cö");
  });
});

describe("the poe2db page of an item", () => {
  beforeEach(async () => {
    setupTests();
    await init("en");
  });

  it("is the item's own page when the item data has no category for it", () => {
    const item = parseClipboard(NormalOnTradeOnlyBase.rawText)._unsafeUnwrap();
    expect(item.category).toBe(NormalOnTradeOnlyBase.category);

    expect(__testExports.poe2dbUrl(item)).toBe(
      "https://poe2db.tw/us/Gladiatoral_Helm",
    );
  });

  it("is the modifier calculator of the item's kind for a known base", () => {
    const item = parseClipboard(NormalItem.rawText)._unsafeUnwrap();

    expect(__testExports.poe2dbUrl(item)).toBe(
      "https://poe2db.tw/us/Helmets_str_int#ModifiersCalc",
    );
  });
});
