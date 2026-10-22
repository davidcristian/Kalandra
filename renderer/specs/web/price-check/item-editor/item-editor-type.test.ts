import { beforeEach, describe, expect, it } from "vitest";
import { setupTests } from "@specs/vitest.setup";
import { init } from "@/assets/data";
import { parseClipboard } from "@/parser";
import { ItemEditorType } from "@/parser/meta";
import { getItemEditorType } from "@/web/price-check/item-editor/item-editor";
import {
  CharmQuality,
  NewExplicitTypeDefinitions,
  NormalItem,
  RareItem,
  RareJewel,
  RareMap,
  RareWithImplicit,
  TwoImplicitItem,
  UniqueItem,
  type TestItem,
} from "@specs/Parser/items";

function editorType(item: TestItem) {
  return getItemEditorType(parseClipboard(item.rawText)._unsafeUnwrap());
}

describe("getItemEditorType", () => {
  beforeEach(async () => {
    setupTests();
    await init("en");
  });

  it.each([
    ["ring", RareWithImplicit],
    ["amulet", NewExplicitTypeDefinitions],
    ["jewel", RareJewel],
  ])("opens the catalyst editor for a %s", (_, item) => {
    expect(editorType(item)).toBe(ItemEditorType.Catalyst);
  });

  it.each([
    ["helmet", NormalItem],
    ["bow", RareItem],
  ])("opens the augment editor for a %s", (_, item) => {
    expect(editorType(item)).toBe(ItemEditorType.Augment);
  });

  it.each([
    ["unique focus", UniqueItem],
    ["belt", TwoImplicitItem],
    ["charm", CharmQuality],
    ["waystone", RareMap],
  ])("opens no editor for a %s", (_, item) => {
    expect(editorType(item)).toBe(ItemEditorType.None);
  });
});
