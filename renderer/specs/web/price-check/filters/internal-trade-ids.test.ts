import { describe, expectTypeOf, it } from "vitest";
import type { InternalTradeId } from "@/web/price-check/filters/interfaces";

describe("InternalTradeId", () => {
  it("is the union of the internal trade ids, not any string", () => {
    expectTypeOf<"item.runic_ward">().toExtend<InternalTradeId>();
    expectTypeOf<"item.runic_wards">().not.toExtend<InternalTradeId>();
  });
});
