import { beforeEach, describe, expect, it } from "vitest";
import { setupTests } from "@specs/vitest.setup";
import { createTestCreateOptions } from "@specs/helper";
import {
  MagicJewel,
  RareJewel,
  RareMap,
  RareWithImplicit,
  TestItem,
} from "@specs/Parser/items";
import { init } from "@/assets/data";
import { parseClipboard } from "@/parser";
import { createPresets } from "@/web/price-check/filters/create-presets";

const PSEUDO = "filters.preset_pseudo";
const BASE_ITEM = "filters.preset_base_item";

describe("createPresets base item tab", () => {
  beforeEach(async () => {
    setupTests();
    await init("en");
  });

  it.each([
    ["rare waystone", false, RareMap, 80],
    ["rare jewel", false, RareJewel, 79],
    ["magic jewel", true, MagicJewel, 79],
    ["rare ring of a high item level", true, RareWithImplicit, 79],
  ])(
    "gives a %s the Base item tab: %s",
    (_, baseItem: boolean, testItem: TestItem, itemLevel: number) => {
      const item = parseClipboard(testItem.rawText)._unsafeUnwrap();
      expect(item.category).toBe(testItem.category);
      expect(item.itemLevel).toBe(itemLevel);

      const { presets, active } = createPresets(
        item,
        createTestCreateOptions(),
      );

      expect(presets.map((preset) => preset.id)).toEqual(
        baseItem ? [PSEUDO, BASE_ITEM] : [PSEUDO],
      );
      expect(active).toBe(PSEUDO);
    },
  );
});
