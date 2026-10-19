import { beforeAll, describe, expect, it } from "vitest";
import { setupTests } from "@specs/vitest.setup";
import { type BaseType, type DropEntry, init } from "@/assets/data";
import {
  buildRelatedItems,
  findItemByQueryId,
  splitQueryId,
} from "@/web/price-check/related-items/related-items";

function baseType(name: string): BaseType {
  return {
    name,
    refName: name,
    namespace: "ITEM",
    icon: `${name}.png`,
    tags: [],
  };
}

const ITEMS = new Map<string, BaseType>([
  ["ITEM::Fragment A", baseType("Fragment A")],
  ["ITEM::Fragment B", baseType("Fragment B")],
  ["ITEM::Reward", baseType("Reward")],
]);
const PRICES = new Map<string, number>([
  ["ITEM::Fragment B", 3],
  ["ITEM::Reward", 40],
]);
const findItem = (ref: string) => ITEMS.get(ref);
const findPrice = (ref: string) => PRICES.get(ref);

describe("buildRelatedItems", () => {
  const drops: DropEntry[] = [
    { query: ["ITEM::Other"], items: [] },
    {
      query: ["ITEM::Fragment A", "ITEM::Fragment B"],
      items: ["ITEM::Reward"],
    },
  ];

  it("lists the group of the checked item and what the group drops", () => {
    expect(
      buildRelatedItems("ITEM::Fragment B", drops, findItem, findPrice),
    ).toEqual({
      related: [
        { name: "Fragment A", icon: "Fragment A.png", highlight: false },
        {
          name: "Fragment B",
          icon: "Fragment B.png",
          price: 3,
          highlight: true,
        },
      ],
      items: [{ name: "Reward", icon: "Reward.png", price: 40 }],
    });
  });

  it("returns null when no group contains the checked item", () => {
    expect(
      buildRelatedItems("ITEM::Reward", drops, findItem, findPrice),
    ).toBeNull();
  });

  it("leaves out the refs the item data does not contain", () => {
    const withUnknown: DropEntry[] = [
      {
        query: ["ITEM::Fragment A", "ITEM::Added Next Patch"],
        items: ["ITEM::Typo Reward", "ITEM::Reward"],
      },
    ];

    expect(
      buildRelatedItems("ITEM::Fragment A", withUnknown, findItem, findPrice),
    ).toEqual({
      related: [
        { name: "Fragment A", icon: "Fragment A.png", highlight: true },
      ],
      items: [{ name: "Reward", icon: "Reward.png", price: 40 }],
    });
  });

  it("returns null when the item data contains no ref of the group", () => {
    const unknownOnly: DropEntry[] = [
      { query: ["ITEM::Unknown"], items: ["ITEM::Also Unknown"] },
    ];

    expect(
      buildRelatedItems("ITEM::Unknown", unknownOnly, findItem, findPrice),
    ).toBeNull();
  });
});

describe("splitQueryId", () => {
  it("splits the namespace, the name and the base item", () => {
    expect(splitQueryId("UNIQUE::Edyrn's Tusks // Iron Cuirass")).toEqual({
      ns: "UNIQUE",
      name: "Edyrn's Tusks",
      variant: "Iron Cuirass",
    });
    expect(splitQueryId("ITEM::Chaos Orb")).toEqual({
      ns: "ITEM",
      name: "Chaos Orb",
      variant: undefined,
    });
  });
});

describe("findItemByQueryId", () => {
  beforeAll(async () => {
    setupTests();
    await init("en");
  });

  it("returns the unique on the base item the ref names", () => {
    expect(
      findItemByQueryId("UNIQUE::Edyrn's Tusks // Runemastered Iron Cuirass")
        ?.unique?.base,
    ).toBe("Runemastered Iron Cuirass");
    expect(
      findItemByQueryId("UNIQUE::Edyrn's Tusks // Iron Cuirass")?.unique?.base,
    ).toBe("Iron Cuirass");
  });

  it("returns a unique with the name when no record has the base item", () => {
    expect(
      findItemByQueryId("UNIQUE::Edyrn's Tusks // Leather Vest")?.name,
    ).toBe("Edyrn's Tusks");
  });

  it("returns undefined for a name the item data does not contain", () => {
    expect(findItemByQueryId("ITEM::Not An Item")).toBeUndefined();
  });
});
