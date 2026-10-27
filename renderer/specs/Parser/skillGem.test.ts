import { present } from "@specs/present";
import { beforeEach, describe, expect, it } from "vitest";
import { setupTests } from "@specs/vitest.setup";
import { __testExports, parseClipboard } from "@/parser/Parser";
import {
  MetaSkillGem,
  RareItem,
  UncutSkillGem,
  UncutSpiritGem,
  UncutSupportGem,
} from "./items";
import { init } from "@/assets/data";

describe("isItemMissingItemClass", () => {
  beforeEach(async () => {
    setupTests();
    await init("en");
  });
  it("returns true for a meta skill gem copied without an item class line", () => {
    const sections = __testExports.itemTextToSections(MetaSkillGem.rawText);
    expect(__testExports.isItemMissingItemClass(sections[0])).toBeTruthy();
  });

  it("should return false for any other item", () => {
    const sections = __testExports.itemTextToSections(RareItem.rawText);
    expect(__testExports.isItemMissingItemClass(sections[0])).toBe(false);
  });
});

describe("Uncut gems parse correctly", () => {
  beforeEach(async () => {
    setupTests();
    await init("en");
  });
  it.each([
    ["skill", UncutSkillGem],
    ["spirit", UncutSpiritGem],
    ["support", UncutSupportGem],
  ])(
    "finds the record of an uncut %s gem's level, without a gem level",
    (_, gem) => {
      const result = parseClipboard(gem.rawText)._unsafeUnwrap();

      expect(result.category).toBe(gem.category);
      expect(result.info.refName).toBe(gem.info.refName);
      expect(result.info.tradeTag).toBe(gem.info.tradeTag);
      expect(result.info.craftable).toEqual(gem.info.craftable);
      expect(result.gemLevel).toBeUndefined();
    },
  );
});

describe("Skill gems parse correctly", () => {
  beforeEach(async () => {
    setupTests();
    await init("en");
  });

  it("should parse meta skill gem", () => {
    const result = parseClipboard(MetaSkillGem.rawText).unwrapOr(null);
    expect(result).not.toBeNull();
    expect(present(result).category).toBe(MetaSkillGem.category);
    expect(present(result).gemLevel).toBe(MetaSkillGem.gemLevel);
  });
});
