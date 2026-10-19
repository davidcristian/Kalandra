import { beforeEach, describe, expect, it } from "vitest";
import { setupTests } from "@specs/vitest.setup";
import { BaseType, CATALYST_TYPES, init } from "@/assets/data";
import { parseClipboard, ParsedItem } from "@/parser";
import { applyCatalyst } from "@/web/price-check/item-editor/item-editor";
import { CatalysedRing } from "@specs/Parser/items";

function catalyst(refName: string): BaseType {
  const found = CATALYST_TYPES.Normal.find((c) => c.refName === refName);
  if (!found) throw new Error(`No catalyst ${refName} in the item data`);
  return found;
}

function strength(item: ParsedItem) {
  const stat = item.statsByType.find(
    (calc) => calc.stat.ref === "# to Strength",
  );
  return stat?.sources[0].contributes?.value;
}

describe("applyCatalyst on a catalysed ring", () => {
  beforeEach(async () => {
    setupTests();
    await init("en");
  });

  it("replaces the quality the ring has instead of adding to it", () => {
    const item = parseClipboard(CatalysedRing.rawText)._unsafeUnwrap();
    expect(strength(item)).toBe(14);

    applyCatalyst(item, catalyst("Adaptive Catalyst"), 20);
    expect(strength(item)).toBe(14);

    applyCatalyst(item, catalyst("Flesh Catalyst"), 20);
    expect(strength(item)).toBe(12);
    expect(item.qualityType).toBe("life_catalyst");
  });
});
