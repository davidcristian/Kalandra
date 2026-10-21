import { describe, expect, it } from "vitest";
import { menuPages } from "@/web/settings/menu";

describe("the pages the Settings window menu lists", () => {
  it("lists every page in its groups for the whole window", () => {
    expect(menuPages()).toEqual([
      ["hotkeys", "chat"],
      ["general"],
      ["price-check", "maps", "item-check"],
      ["leveling"],
      ["help", "debug", "about"],
    ]);
  });

  it("lists only the pages of a widget that has its own settings", () => {
    expect(menuPages("stash-search")).toEqual([["stash-search"]]);
    expect(menuPages("timer")).toEqual([["stopwatch"]]);
    expect(menuPages("item-check")).toEqual([["item-check", "maps"]]);
    expect(menuPages("price-check")).toEqual([["price-check"]]);
    expect(menuPages("item-search")).toEqual([["item-search"]]);
    expect(menuPages("library")).toEqual([["library"]]);
  });

  it("lists every page for a widget without its own settings", () => {
    expect(menuPages("delve-grid")).toEqual(menuPages());
  });
});
