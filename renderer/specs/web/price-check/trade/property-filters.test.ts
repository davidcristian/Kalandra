import { present } from "@specs/present";
import { beforeEach, describe, expect, it } from "vitest";
import { setupTests } from "@specs/vitest.setup";
import { createTestCreateOptions } from "@specs/helper";
import {
  ArmourHighValueRareItem,
  ItemAllTheModifierTypes,
  RareMap,
  RareMapFakeAllProps,
  SpectreIncSpirit,
  TestItem,
} from "@specs/Parser/items";
import { init } from "@/assets/data";
import { parseClipboard, type ParsedItem } from "@/parser";
import {
  INTERNAL_TRADE_IDS,
  ItemIsElementalModifier,
} from "@/web/price-check/filters/interfaces";
import type { StatFilter } from "@/web/price-check/filters/interfaces";
import { createPresets } from "@/web/price-check/filters/create-presets";
import { createTradeRequest } from "@/web/price-check/trade/pathofexile-trade";

const FIRE = "stat_709508406";
const COLD = "stat_1037193709";
const LIGHTNING = "stat_3336890334";

/** The search of an item, parsed first when it is a `TestItem`, with its property filters on after `change` edits them. */
function search(
  item: TestItem | ParsedItem,
  change?: (props: StatFilter[]) => void,
) {
  const parsed =
    item instanceof TestItem
      ? parseClipboard(item.rawText)._unsafeUnwrap()
      : item;
  const [preset] = createPresets(parsed, createTestCreateOptions()).presets;
  const props = preset.stats.filter(
    (stat) =>
      INTERNAL_TRADE_IDS.includes(stat.tradeId[0]) &&
      stat.tradeId[0] !== "item.has_empty_modifier",
  );
  for (const prop of props) prop.disabled = false;
  change?.(props);
  return createTradeRequest(preset.filters, preset.stats, parsed).query;
}

function prop(props: StatFilter[], tradeId: string) {
  const found = props.find((stat) => stat.tradeId[0] === tradeId);
  expect(found, tradeId).toBeDefined();
  return present(found);
}

describe("the item property filters of a trade search", () => {
  beforeEach(async () => {
    setupTests();
    await init("en");
  });

  it("sends the armour of a body armour", () => {
    const query = search(ArmourHighValueRareItem);

    expect(query.filters.equipment_filters?.filters).toMatchObject({
      ar: { min: 2927 },
    });
  });

  it("sends the damage, speed, critical hit chance and reload time of a crossbow", () => {
    const query = search(ItemAllTheModifierTypes);

    expect(query.filters.equipment_filters?.filters).toMatchObject({
      dps: { min: 500 },
      edps: { min: 240 },
      pdps: { min: 268 },
      aps: { min: 1.87 },
      crit: { min: 5 },
      reload_time: { max: 0.93 },
    });
  });

  it("sends the spirit of a sceptre", () => {
    const query = search(SpectreIncSpirit);

    expect(query.filters.equipment_filters?.filters).toMatchObject({
      spirit: { min: 151 },
    });
  });

  it("sends the properties of a Waystone", () => {
    expect(search(RareMap).filters.map_filters?.filters).toMatchObject({
      map_revives: { min: 2 },
      map_packsize: { min: 34 },
      map_rare_monsters: { min: 28 },
      map_bonus: { min: 75 },
    });
    expect(
      search(RareMapFakeAllProps).filters.map_filters?.filters,
    ).toMatchObject({ map_iir: { min: 17 } });
  });

  it("sends the Monster Rarity and Monster Effectiveness of a Waystone with the trade site's ids", () => {
    const current = new TestItem(
      RareMapFakeAllProps.rawText
        .replace("Magic Monsters: +30% (augmented)\n", "")
        .replace("Rare Monsters: +71% (augmented)\n", ""),
    );

    expect(search(current).filters.map_filters?.filters).toMatchObject({
      map_rare_monsters: { min: 32 },
      map_magic_monsters: { min: 45 },
    });
  });

  it("sends the maximum the user sets", () => {
    const query = search(ArmourHighValueRareItem, (props) => {
      present(prop(props, "item.armour").roll).max = 3000;
    });

    expect(query.filters.equipment_filters?.filters.ar).toEqual({
      min: 2927,
      max: 3000,
    });
  });

  it("sends the maximum the user sets on each property of a Waystone", () => {
    const setMaximum = (props: StatFilter[]) => {
      for (const filter of props) {
        if (filter.roll) filter.roll.max = 500;
      }
    };
    const withGold = parseClipboard(
      RareMapFakeAllProps.rawText,
    )._unsafeUnwrap();
    // The parser reads no gold line, since client_strings.js has no string for it
    withGold.mapGold = 40;

    expect(
      search(RareMap, setMaximum).filters.map_filters?.filters,
    ).toMatchObject({
      map_revives: { min: 2, max: 500 },
      map_packsize: { min: 34, max: 500 },
      map_rare_monsters: { min: 28, max: 500 },
      map_bonus: { min: 75, max: 500 },
    });
    expect(
      search(withGold, setMaximum).filters.map_filters?.filters,
    ).toMatchObject({
      map_magic_monsters: { max: 500 },
      map_iir: { min: 17, max: 500 },
      map_gold: { min: 40, max: 500 },
    });
  });

  it("sends no property the user turned off", () => {
    const query = search(ItemAllTheModifierTypes, (props) => {
      for (const filter of props) filter.disabled = true;
    });

    expect(query.filters.equipment_filters?.filters).not.toHaveProperty("dps");
    expect(query.filters.equipment_filters?.filters).not.toHaveProperty("aps");
  });

  it.each([
    [ItemIsElementalModifier.Fire, [COLD, LIGHTNING], FIRE],
    [ItemIsElementalModifier.Cold, [FIRE, LIGHTNING], COLD],
    [ItemIsElementalModifier.Lightning, [FIRE, COLD], LIGHTNING],
  ])(
    "leaves out the other elements when the elemental damage names element %s",
    (element, excluded, kept) => {
      const query = search(ItemAllTheModifierTypes, (props) => {
        present(prop(props, "item.elemental_dps").option).value = element;
      });

      const not = query.stats.find((group) => group.type === "not");
      const ids = present(not).filters.map((filter) => filter.id);
      for (const stat of excluded) {
        expect(ids).toContain(`explicit.${stat}`);
      }
      expect(ids.some((id) => id.endsWith(kept))).toBe(false);
    },
  );

  it("leaves out no element when the elemental damage names any element", () => {
    const query = search(ItemAllTheModifierTypes);

    expect(query.stats.some((group) => group.type === "not")).toBe(false);
  });
});
