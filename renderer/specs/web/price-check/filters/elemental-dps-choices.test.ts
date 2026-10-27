import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createSSRApp, type ComponentPublicInstance } from "vue";
import { renderToString } from "vue/server-renderer";
import { present } from "@specs/present";
import { setupTests } from "@specs/vitest.setup";
import { createTestCreateOptions } from "@specs/helper";
import { ItemAllTheModifierTypes } from "@specs/Parser/items";
import { init as initData } from "@/assets/data";
import { parseClipboard } from "@/parser";
import { init as initI18n } from "@/web/i18n";
import FilterModifierItemIsElemental from "@/web/price-check/filters/FilterModifierItemIsElemental.vue";
import { createPresets } from "@/web/price-check/filters/create-presets";
import {
  FilterTag,
  ItemIsElementalModifier,
  type StatFilter,
  type StatFilterRoll,
} from "@/web/price-check/filters/interfaces";

type ChoicesInstance = InstanceType<typeof FilterModifierItemIsElemental>;

const ANY = "item.has_elemental_affix";
const FIRE = "item.has_elemental_fire_affix";
const COLD = "item.has_elemental_cold_affix";
const LIGHTNING = "item.has_elemental_lightning_affix";

let i18n: Awaited<ReturnType<typeof initI18n>>;

beforeAll(async () => {
  setupTests();
  vi.stubGlobal("document", { documentElement: { lang: "" } });
  await initData("en");
  i18n = await initI18n("en");
});

afterAll(() => {
  vi.unstubAllGlobals();
});

function roll(value: number): StatFilterRoll {
  return {
    value,
    min: value,
    max: value + 10,
    default: { min: value, max: value + 10 },
    dp: false,
    isNegated: false,
  };
}

function elementalFilter(
  elementalInfo: Record<string, StatFilterRoll>,
): StatFilter {
  return {
    tradeId: ["item.elemental_dps"],
    statRef: "Elemental DPS: #",
    text: "Elemental DPS: #",
    tag: FilterTag.Property,
    sources: [],
    roll: roll(1),
    option: { value: ItemIsElementalModifier.Any },
    disabled: true,
    additionalInfo: { elementalInfo },
  };
}

/** Renders the element choices of the filter and returns the text of each button and the component instance. */
async function render(filter: StatFilter) {
  let choices: ChoicesInstance | undefined;
  const app = createSSRApp(FilterModifierItemIsElemental, { filter });
  app.use(i18n);
  app.mixin({
    created(this: ComponentPublicInstance) {
      if ("options" in this) choices = this as ChoicesInstance;
    },
  });
  const html = await renderToString(app);
  const buttons = [...html.matchAll(/<button[^>]*>(.*?)<\/button>/g)].map(
    ([, text]) => text.trim(),
  );
  return { buttons, options: present(present(choices).options) };
}

describe("the element choices of the Elemental DPS filter", () => {
  it.each([
    ["Any", ItemIsElementalModifier.Any, ANY],
    ["Fire", ItemIsElementalModifier.Fire, FIRE],
    ["Cold", ItemIsElementalModifier.Cold, COLD],
    ["Lightning", ItemIsElementalModifier.Lightning, LIGHTNING],
  ])(
    "shows the %s choice for its roll and searches for that roll",
    async (text, element, id) => {
      const elementRoll = roll(40);
      const filter = elementalFilter({ [id]: elementRoll });

      const { buttons, options } = await render(filter);
      options[0].select();

      expect(buttons).toEqual([text]);
      expect(filter.option?.value).toBe(element);
      expect(filter.disabled).toBe(false);
      expect(filter.roll).toBe(elementRoll);
      expect(filter.roll).toMatchObject({ min: 40, max: 50 });
    },
  );

  it("searches for the roll of a right clicked element without a range", async () => {
    const coldRoll = roll(40);
    const filter = elementalFilter({ [ANY]: roll(60), [COLD]: coldRoll });

    const { buttons, options } = await render(filter);
    options[1].context();

    expect(buttons).toEqual(["Any", "Cold"]);
    expect(filter.option?.value).toBe(ItemIsElementalModifier.Cold);
    expect(filter.roll).toBe(coldRoll);
    expect(filter.roll).toMatchObject({ min: "", max: "" });
  });

  it("shows no choice for another filter", async () => {
    const filter = elementalFilter({ [ANY]: roll(60), [FIRE]: roll(40) });
    filter.tradeId = ["item.physical_dps"];

    const html = await renderToString(
      createSSRApp(FilterModifierItemIsElemental, { filter }).use(i18n),
    );

    expect(html).not.toContain("<button");
  });

  it("shows the elements of a parsed weapon", async () => {
    const item = parseClipboard(
      ItemAllTheModifierTypes.rawText,
    )._unsafeUnwrap();
    const [preset] = createPresets(item, createTestCreateOptions()).presets;
    const filter = present(
      preset.stats.find((stat) => stat.tradeId[0] === "item.elemental_dps"),
    );

    const { buttons } = await render(filter);

    expect(buttons).toEqual(["Any", "Lightning"]);
  });
});
