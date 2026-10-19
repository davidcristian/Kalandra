import { computed } from "vue";
import { beforeEach, describe, expect, it } from "vitest";
import { setupTests } from "@specs/vitest.setup";
import { init, loadForLang } from "@/assets/data";
import { ItemCategory } from "@/parser/meta";
import type { EditorItem } from "@/parser/ParsedItem";
import { categoryAugments } from "@/web/price-check/item-editor/augment";
import { categoryCatalysts } from "@/web/price-check/item-editor/item-editor";

function byRefName(items: EditorItem[], refName: string) {
  const found = items.find((item) => item.refName === refName);
  if (!found) throw new Error(`No ${refName} in the list`);
  return found;
}

describe("the item editor lists after a language change", () => {
  beforeEach(async () => {
    setupTests();
    await init("en");
  });

  it("shows the augments of the current category in the new language", async () => {
    const shown = computed(() => categoryAugments(ItemCategory.Helmet));
    const greaterIron = () =>
      byRefName(shown.value.Rune.Greater, "Greater Iron Rune");
    expect(greaterIron().name).toBe("Greater Iron Rune");

    await loadForLang("de");

    expect(greaterIron().name).toBe("Große Eisen-Rune");
  });

  it("shows the catalysts of the current category in the new language", async () => {
    const shown = computed(() => categoryCatalysts(ItemCategory.Ring));
    const flesh = () => byRefName(shown.value, "Flesh Catalyst");
    expect(flesh()).toMatchObject({
      name: "Flesh Catalyst",
      displayString: "Life",
    });

    await loadForLang("de");

    expect(flesh()).toMatchObject({
      name: "Fleisch-Katalysator",
      displayString: "Leben",
    });
  });

  it("builds the list of a category once until the next load", async () => {
    const first = categoryAugments(ItemCategory.Helmet);
    expect(categoryAugments(ItemCategory.Helmet)).toBe(first);
    expect(categoryAugments(ItemCategory.Boots)).not.toBe(first);

    await loadForLang("en");

    expect(categoryAugments(ItemCategory.Helmet)).not.toBe(first);
  });

  it("lists the refined catalysts for a jewel", () => {
    const jewel = categoryCatalysts(ItemCategory.Jewel);
    const ring = categoryCatalysts(ItemCategory.Ring);

    expect(jewel.length).toBeGreaterThan(0);
    expect(jewel.map((item) => item.refName)).not.toContain("Flesh Catalyst");
    expect(byRefName(ring, "Flesh Catalyst").displayString).toBe("Life");
  });
});
