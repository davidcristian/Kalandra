import { beforeAll, describe, expect, it } from "vitest";
import { setupTests } from "@specs/vitest.setup";
import { type BaseType, init, ITEM_BY_REF, ITEM_DROP } from "@/assets/data";
import { splitQueryId } from "@/web/price-check/related-items/related-items";

// The trade site lists this unique, but its Ring records in items.ndjson have no name.
const NOT_IN_ITEM_DATA = ["UNIQUE::Sekhema's Resolve // Ring"];

function inItemData(ref: string) {
  const { ns, name, variant } = splitQueryId(ref);
  const found = ITEM_BY_REF(ns as BaseType["namespace"], name) ?? [];
  if (ns === "UNIQUE") {
    return found.some((unique) => unique.unique?.base === variant);
  }
  return found.length > 0;
}

describe("item-drop.json", () => {
  beforeAll(async () => {
    setupTests();
    await init("en");
  });

  it("names only items, and uniques on base items, that the item data contains", () => {
    const refs = ITEM_DROP.flatMap((entry) => [...entry.query, ...entry.items]);

    expect(refs.filter((ref) => !inItemData(ref))).toEqual(NOT_IN_ITEM_DATA);
  });
});
