import { describe, expect, expectTypeOf, it } from "vitest";
import {
  propSet,
  type LeafPath,
  type PathValue,
} from "@/web/price-check/trade/prop-set";

interface Body {
  misc?: { filters: { level?: { min?: number }; mirrored?: "true" | "false" } };
  price?: { min?: number } | { option?: string };
}

describe("propSet", () => {
  it("sets the value at a path and adds the objects on the way", () => {
    const body: Body = {};
    propSet(body, "misc.filters.level.min", 3);
    propSet(body, "misc.filters.mirrored", "false");
    propSet(body, "price.option", "divine");

    expect(body).toEqual({
      misc: { filters: { level: { min: 3 }, mirrored: "false" } },
      price: { option: "divine" },
    });
  });

  it("takes only the paths of the object's type and the values they hold", () => {
    expectTypeOf<LeafPath<Body>>().toEqualTypeOf<
      | "misc.filters.level.min"
      | "misc.filters.mirrored"
      | "price.min"
      | "price.option"
    >();
    expectTypeOf<PathValue<Body, "misc.filters.mirrored">>().toEqualTypeOf<
      "true" | "false" | undefined
    >();
    expectTypeOf<PathValue<Body, "price.option">>().toEqualTypeOf<
      string | undefined
    >();
  });
});
