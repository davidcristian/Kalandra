import { beforeEach, describe, expect, it } from "vitest";
import { setupTests } from "@specs/vitest.setup";
import { createTestItem } from "@specs/helper";
import { init } from "@/assets/data";
import { parseClipboard } from "@/parser";
import { ItemCategory } from "@/parser/meta";
import { __testExports } from "@/parser/Parser";
import { CatalysedRing } from "./items";

describe("jewellery quality", () => {
  beforeEach(async () => {
    setupTests();
    await init("en");
  });

  it("reads the quality and catalyst of a catalysed ring", () => {
    const item = parseClipboard(CatalysedRing.rawText)._unsafeUnwrap();

    expect(item.quality).toBe(CatalysedRing.quality);
    expect(item.qualityType).toBe(CatalysedRing.qualityType);
    expect(item.unknownModifiers).toEqual([]);
  });

  it.each([
    [
      ItemCategory.Jewel,
      "Quality (Attack Modifiers): +20% (augmented)",
      20,
      "attack_catalyst",
    ],
    [ItemCategory.Amulet, "Quality: +20% (augmented)", 20, undefined],
    [
      ItemCategory.Ring,
      "Quality (Unknown Modifiers): +30% (augmented)",
      30,
      undefined,
    ],
  ])(
    "reads the quality line of a %s: %s",
    (category, line, quality, qualityType) => {
      const item = { ...createTestItem(), category };

      const res = __testExports.parseJewelery([line], item);

      expect(res).toBe("SECTION_PARSED");
      expect(item.quality).toBe(quality);
      expect(item.qualityType).toBe(qualityType);
    },
  );

  it.each([["Quality (Attribute Modifiers)"], ["Quality: none"]])(
    "leaves a quality line without a value for the other parsers: %s",
    (line) => {
      const item = { ...createTestItem(), category: ItemCategory.Ring };

      const res = __testExports.parseJewelery([line], item);

      expect(res).toBe("SECTION_SKIPPED");
      expect(item.quality).toBeUndefined();
    },
  );
});
