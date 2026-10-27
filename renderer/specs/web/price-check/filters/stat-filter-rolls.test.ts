import { present } from "@specs/present";
import { beforeEach, describe, expect, it } from "vitest";
import { setupTests } from "@specs/vitest.setup";
import { createTestCreateOptions } from "@specs/helper";
import {
  ArmourHighValueRareItem,
  TwoImplicitItem,
  UniqueItem,
} from "@specs/Parser/items";
import { init } from "@/assets/data";
import { parseClipboard } from "@/parser";
import { createPresets } from "@/web/price-check/filters/create-presets";
import type { FilterPreset } from "@/web/price-check/filters/interfaces";
import { createTradeRequest } from "@/web/price-check/trade/pathofexile-trade";

const PSEUDO = "filters.preset_pseudo";
const BASE_ITEM = "filters.preset_base_item";
const CONST_ROLL = "filters.hide_const_roll";

function presetsOf(text: string) {
  const item = parseClipboard(text)._unsafeUnwrap();
  return { item, ...createPresets(item, createTestCreateOptions()) };
}

function preset(presets: FilterPreset[], id: string) {
  return present(presets.find((preset) => preset.id === id));
}

function statFilter(preset: FilterPreset, statRef: string) {
  const filter = preset.stats.find((filter) => filter.statRef === statRef);
  expect(filter, statRef).toBeDefined();
  return present(filter);
}

/** The value the trade search sends for a stat filter, after the user turns it on. */
function searchedValue(
  { presets, item }: ReturnType<typeof presetsOf>,
  id: string,
  statRef: string,
  tradeId: string,
) {
  const shown = preset(presets, id);
  statFilter(shown, statRef).disabled = false;
  const body = createTradeRequest(shown.filters, shown.stats, item);
  const sent = body.query.stats[0].filters.find(
    (filter) => filter.id === tradeId,
  );
  expect(sent, tradeId).toBeDefined();
  return present(sent).value;
}

describe("the stat filters of a price check", () => {
  beforeEach(async () => {
    setupTests();
    await init("en");
  });

  it("search a unique's rolls within a share of the unique's own range", () => {
    const { presets, active } = presetsOf(UniqueItem.rawText);

    expect(presets.map((preset) => preset.id)).toEqual([PSEUDO]);
    expect(active).toBe(PSEUDO);
    const pseudo = preset(presets, PSEUDO);
    const shield = statFilter(pseudo, "#% increased Energy Shield");
    expect(shield.disabled).toBe(false);
    expect(shield.hidden).toBeUndefined();
    expect(shield.roll).toMatchObject({
      value: 56,
      min: 54,
      max: undefined,
      default: { min: 54, max: 58 },
      bounds: { min: 50, max: 70 },
      isNegated: false,
    });
    expect(statFilter(pseudo, "#% to Lightning Resistance").roll).toMatchObject(
      {
        value: 26,
        min: 25,
        default: { min: 25, max: 27 },
        bounds: { min: 20, max: 30 },
      },
    );
  });

  it("search a unique roll at its maximum at that value", () => {
    const text = UniqueItem.rawText.replace(
      "56(50-70)% increased Energy Shield",
      "70(50-70)% increased Energy Shield",
    );
    const pseudo = preset(presetsOf(text).presets, PSEUDO);

    expect(statFilter(pseudo, "#% increased Energy Shield").roll).toMatchObject(
      {
        value: 70,
        min: 70,
        default: { min: 70, max: 70 },
        bounds: { min: 50, max: 70 },
      },
    );
  });

  it.each([
    "#% increased Mana Regeneration Rate while stationary",
    "#% to Maximum Lightning Resistance",
    "#% increased Mana Regeneration Rate",
  ])("hide and turn off the fixed unique stat %s", (statRef) => {
    const pseudo = preset(presetsOf(UniqueItem.rawText).presets, PSEUDO);
    const filter = statFilter(pseudo, statRef);

    expect(filter.disabled).toBe(true);
    expect(filter.hidden).toBe(CONST_ROLL);
    expect(present(filter.roll).min).toBeUndefined();
    expect(present(filter.roll).max).toBeUndefined();
    expect(present(filter.roll).bounds).toBeUndefined();
  });

  it("show a reduced roll of an increased stat as reduced and search the increased stat below its negative", () => {
    const presets = presetsOf(ArmourHighValueRareItem.rawText);
    const statRef = "#% increased Duration of Bleeding on You";
    const filter = statFilter(preset(presets.presets, PSEUDO), statRef);

    expect(filter.text).toBe("#% reduced Duration of Bleeding on You");
    expect(filter.roll).toMatchObject({
      value: 48,
      min: 46,
      max: undefined,
      default: { min: 46, max: 50 },
      isNegated: true,
      tradeInvert: true,
    });
    expect(
      searchedValue(presets, PSEUDO, statRef, "explicit.stat_1692879867"),
    ).toEqual({ min: undefined, max: -46 });
  });

  it("search a reduced roll of a stat the trade site lists as reduced above its value", () => {
    const presets = presetsOf(TwoImplicitItem.rawText);
    const statRef = "#% reduced Charm Charges used";
    const filter = statFilter(preset(presets.presets, PSEUDO), statRef);

    expect(filter.roll).toMatchObject({
      value: 14,
      min: 12,
      max: undefined,
      default: { min: 12, max: 15 },
      isNegated: true,
      tradeInvert: false,
    });
    expect(
      searchedValue(presets, PSEUDO, statRef, "implicit.stat_1570770415"),
    ).toEqual({ min: 12, max: undefined });
  });

  it("turn on the implicits in the base item tab and search 2% around them", () => {
    const base = preset(presetsOf(TwoImplicitItem.rawText).presets, BASE_ITEM);

    expect(
      base.stats.map(({ statRef, disabled }) => [statRef, disabled]),
    ).toEqual([
      ["#% reduced Charm Charges used", false],
      ["Has # Charm Slot", false],
      ["# Empty Modifier", false],
    ]);
    expect(
      statFilter(base, "#% reduced Charm Charges used").roll,
    ).toMatchObject({ value: 14, min: 13, default: { min: 13, max: 15 } });
    expect(statFilter(base, "Has # Charm Slot").roll).toMatchObject({
      value: 2,
      min: 2,
      default: { min: 2, max: 2 },
    });
  });
});
