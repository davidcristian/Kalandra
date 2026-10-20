import fnv1a from "@sindresorhus/fnv1a";
import { init, ITEM_BY_REF, ITEM_BY_TRANSLATED } from "@/assets/data";
import { setupTests } from "@specs/vitest.setup";
import { beforeEach, describe, expect, it } from "vitest";

const SAME_HASH_AS_SAPPHIRE_RING = "Milarofilegu";

describe("ITEM_BY_REF and ITEM_BY_TRANSLATED", () => {
  beforeEach(async () => {
    setupTests();
    await init("en");
  });

  it("find no item for a name whose hash only another item's name has", () => {
    expect(fnv1a(`ITEM::${SAME_HASH_AS_SAPPHIRE_RING}`, { size: 32 })).toBe(
      fnv1a("ITEM::Sapphire Ring", { size: 32 }),
    );

    expect(ITEM_BY_REF("ITEM", SAME_HASH_AS_SAPPHIRE_RING)).toBeUndefined();
    expect(
      ITEM_BY_TRANSLATED("ITEM", SAME_HASH_AS_SAPPHIRE_RING),
    ).toBeUndefined();
  });

  it("find the item whose name has that hash", () => {
    expect(ITEM_BY_REF("ITEM", "Sapphire Ring")?.map((r) => r.refName)).toEqual(
      ["Sapphire Ring"],
    );
    expect(
      ITEM_BY_TRANSLATED("ITEM", "Sapphire Ring")?.map((r) => r.refName),
    ).toEqual(["Sapphire Ring"]);
  });
});
