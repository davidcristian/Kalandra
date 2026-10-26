import { beforeEach, describe, expect, it } from "vitest";
import { setupTests } from "@specs/vitest.setup";
import { createTestCreateOptions } from "@specs/helper";
import { NewExplicitTypeDefinitions } from "@specs/Parser/items";
import { init } from "@/assets/data";
import { ModifierType, type StatCalculated } from "@/parser/modifiers";
import { parseClipboard } from "@/parser";
import type { ParsedItem } from "@/parser";
import { createPresets } from "@/web/price-check/filters/create-presets";
import { decodeOils } from "@/web/price-check/filters/pseudo/anointments";

/** The amulet with "Allocates Cooked (enchant)", whose emotions in stats.ndjson are 8, 0 and 4. */
function amulet(enchant = "Allocates Cooked"): ParsedItem {
  const text = NewExplicitTypeDefinitions.rawText.replace(
    "Allocates Cooked",
    enchant,
  );
  return parseClipboard(text)._unsafeUnwrap();
}

function enchantOf(item: ParsedItem): StatCalculated {
  return item.statsByType.find((calc) => calc.type === ModifierType.Enchant)!;
}

function withOils(
  enchant: StatCalculated,
  oils: string | string[],
): StatCalculated {
  const [source] = enchant.sources;
  const translation = { ...source.stat.translation, oils };
  return {
    ...enchant,
    sources: [{ ...source, stat: { ...source.stat, translation } }],
  };
}

function anointment(item: ParsedItem) {
  const { presets } = createPresets(item, createTestCreateOptions());
  const filter = presets[0].stats.find(
    (stat) => stat.statRef === "Allocates #",
  );
  expect(filter).toBeDefined();
  return filter!;
}

describe("the anointment filter of an amulet", () => {
  beforeEach(async () => {
    setupTests();
    await init("en");
  });

  it("names the emotions and leaves the anointment out of the search", () => {
    const filter = anointment(amulet());

    expect(filter.oils).toEqual([
      "Concentrated Liquid Suffering",
      "Diluted Liquid Ire",
      "Liquid Envy",
    ]);
    expect(filter.hidden).toBe("filters.hide_anointment");
    expect(filter.disabled).toBe(true);
  });

  it("searches an anointment that needs a high value emotion", () => {
    const filter = anointment(amulet("Allocates Void"));

    expect(filter.oils).toEqual([
      "Concentrated Liquid Isolation",
      "Diluted Liquid Ire",
      "Liquid Disgust",
    ]);
    expect(filter.hidden).toBeUndefined();
    expect(filter.disabled).toBe(false);
  });

  it("searches the anointment of a corrupted amulet", () => {
    const item = amulet();
    item.isCorrupted = true;

    const filter = anointment(item);

    expect(filter.hidden).toBeUndefined();
    expect(filter.disabled).toBe(false);
  });

  it("names the emotions of an enchant only, not of an explicit Allocates stat", () => {
    const enchant = enchantOf(amulet());

    expect(decodeOils(enchant)).toHaveLength(3);
    expect(
      decodeOils({ ...enchant, type: ModifierType.Explicit }),
    ).toBeUndefined();
  });

  it("names the oils of data that lists them by name", () => {
    const oils = [
      "Concentrated Liquid Suffering",
      "Diluted Liquid Ire",
      "Liquid Envy",
    ];

    expect(decodeOils(withOils(enchantOf(amulet()), oils))).toEqual(oils);
  });

  it("names no oils when an index is past the end of the oil table", () => {
    expect(decodeOils(withOils(enchantOf(amulet()), "13,0,4"))).toBeUndefined();
  });

  it("names no oils when the item data lacks one of them", () => {
    const oils = ["Liquid Envy", "Liquid Courage", "Diluted Liquid Ire"];

    expect(decodeOils(withOils(enchantOf(amulet()), oils))).toBeUndefined();
  });
});
