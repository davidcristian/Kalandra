import { FilterTag, StatFilter } from "@/web/price-check/filters/interfaces";
import { applyRules as applyMissingFracturedRules } from "@/web/price-check/filters/pseudo/missing-fractured-rules";
import { describe, expect, it } from "vitest";

function filter(tag: FilterTag, statRef: string): StatFilter {
  return {
    tradeId: [],
    statRef,
    text: statRef,
    tag,
    sources: [],
    disabled: false,
  };
}

describe("applyMissingFracturedRules", () => {
  it.each([
    ["only a fractured filter", () => [filter(FilterTag.Fractured, "a")]],
    [
      "a fractured and an explicit filter",
      () => [filter(FilterTag.Fractured, "a"), filter(FilterTag.Explicit, "b")],
    ],
  ])("adds nothing when the filters have %s", (_name, createFilters) => {
    const filters = createFilters();

    applyMissingFracturedRules(filters, [filter(FilterTag.Explicit, "c")]);

    expect(filters).toEqual(createFilters());
  });

  it("appends a fractured copy of each explicit stat", () => {
    const filters = [
      filter(FilterTag.Explicit, "a"),
      filter(FilterTag.Explicit, "b"),
    ];
    const explicitStats = [
      filter(FilterTag.Explicit, "a"),
      filter(FilterTag.Explicit, "b"),
    ];

    applyMissingFracturedRules(filters, explicitStats);

    expect(filters).toEqual([
      filter(FilterTag.Explicit, "a"),
      filter(FilterTag.Explicit, "b"),
      filter(FilterTag.Fractured, "a"),
      filter(FilterTag.Fractured, "b"),
    ]);
    expect(explicitStats).toEqual([
      filter(FilterTag.Explicit, "a"),
      filter(FilterTag.Explicit, "b"),
    ]);
  });

  it("copies only the stats whose tag is explicit", () => {
    const filters: StatFilter[] = [];

    applyMissingFracturedRules(filters, [
      filter(FilterTag.Implicit, "a"),
      filter(FilterTag.Explicit, "b"),
      filter(FilterTag.Enchant, "c"),
    ]);

    expect(filters).toEqual([filter(FilterTag.Fractured, "b")]);
  });
});
