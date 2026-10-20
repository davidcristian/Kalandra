import { beforeEach, describe, expect, it } from "vitest";
import { setupTests } from "@specs/vitest.setup";
import { BaseType, CATALYST_TYPES, init } from "@/assets/data";
import { parseClipboard, ParsedItem } from "@/parser";
import { applyCatalyst } from "@/web/price-check/item-editor/item-editor";
import { CatalysedRing, HybridDefenceRing } from "@specs/Parser/items";

function catalyst(refName: string): BaseType {
  const found = CATALYST_TYPES.Normal.find((c) => c.refName === refName);
  if (!found) throw new Error(`No catalyst ${refName} in the item data`);
  return found;
}

function statValue(item: ParsedItem, ref: string) {
  const stat = item.statsByType.find((calc) => calc.stat.ref === ref);
  return stat?.sources[0].contributes?.value;
}

function strength(item: ParsedItem) {
  return statValue(item, "# to Strength");
}

function evasion(item: ParsedItem) {
  return statValue(item, "# to Evasion Rating");
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

describe("applyCatalyst on a modifier with two tags of one catalyst", () => {
  beforeEach(async () => {
    setupTests();
    await init("en");
  });

  it("increases the modifier once and takes the increase back on a change", () => {
    const item = parseClipboard(HybridDefenceRing.rawText)._unsafeUnwrap();
    expect(evasion(item)).toBe(143);

    applyCatalyst(item, catalyst("Carapace Catalyst"), 20);
    expect(evasion(item)).toBe(171);

    applyCatalyst(item, catalyst("Carapace Catalyst"), 30);
    expect(evasion(item)).toBe(185);

    applyCatalyst(item, catalyst("Flesh Catalyst"), 20);
    expect(evasion(item)).toBe(143);
    expect(strength(item)).toBe(12);
  });

  it("throws for a quality type that no catalyst has", () => {
    const item = parseClipboard(HybridDefenceRing.rawText)._unsafeUnwrap();
    item.qualityType = "attribute";

    expect(() =>
      applyCatalyst(item, catalyst("Carapace Catalyst"), 20),
    ).toThrow("Invalid quality type");
  });
});
