import type { IpcEvent } from "@ipc/types";
import { init } from "@/assets/data";
import { itemIsModifiable, parseClipboard } from "@/parser";
import { Host } from "@/web/background/IPC";
import { AppConfig } from "@/web/Config";
import {
  __testExports,
  canOpenCoE,
  findSamePricedItems,
  openPoedb,
} from "@/web/item-check/hotkeyable-actions";
import type { ItemCheckWidget } from "@/web/item-check/widget";
import type { Widget } from "@/web/overlay/widgets";
import {
  ArmourHighValueRareItem,
  DePlatedVestments,
  JaArrayBuckler,
  JaArrayedFocus,
  NormalItem,
  NormalOnTradeOnlyBase,
  NormalShield,
  RareItem,
  RareJewel,
  RequiresOneAttribute,
  TwoLineOneImplicitItem,
  UniqueItem,
} from "@specs/Parser/items";
import { setupTests } from "@specs/vitest.setup";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("encodePoe2dbUri", () => {
  it("should encode all spaces", () => {
    const result = __testExports.encodePoe2dbUri("a b c");
    expect(result).toBe("a_b_c");
  });

  it("should remove all single quotes", () => {
    const result = __testExports.encodePoe2dbUri("a'b'c");
    expect(result).toBe("abc");
  });

  it("should do both", () => {
    const result = __testExports.encodePoe2dbUri("a'b c");
    expect(result).toBe("ab_c");
  });

  it("should leave all others unchanged", () => {
    const result = __testExports.encodePoe2dbUri("A/b-cö");
    expect(result).toBe("A/b-cö");
  });
});

describe("the poe2db page of an item", () => {
  beforeEach(async () => {
    setupTests();
    await init("en");
  });

  it("is the item's own page when the item data has no category for it", () => {
    const item = parseClipboard(NormalOnTradeOnlyBase.rawText)._unsafeUnwrap();
    expect(item.category).toBe(NormalOnTradeOnlyBase.category);

    expect(__testExports.poe2dbUrl(item)).toBe(
      "https://poe2db.tw/us/Gladiatoral_Helm",
    );
  });

  it("is the modifier calculator of the item's kind for a known base", () => {
    const item = parseClipboard(NormalItem.rawText)._unsafeUnwrap();

    expect(__testExports.poe2dbUrl(item)).toBe(
      "https://poe2db.tw/us/Helmets_str_int#ModifiersCalc",
    );
  });

  it.each([
    ["a unique", UniqueItem.rawText, "The_Eternal_Spark"],
    ["a jewel", RareJewel.rawText, "Ruby#ModifiersCalc"],
    [
      "a tablet",
      TwoLineOneImplicitItem.rawText,
      "Delirium_Precursor_Tablet#ModifiersCalc",
    ],
    ["a weapon", RareItem.rawText, "Bows#ModifiersCalc"],
    [
      "body armour with armour",
      ArmourHighValueRareItem.rawText,
      "Body_Armours_str#ModifiersCalc",
    ],
    [
      "a shield with armour and evasion",
      NormalShield.rawText,
      "Shields_str_dex#ModifiersCalc",
    ],
    [
      "boots with energy shield",
      RequiresOneAttribute.rawText,
      "Boots_int#ModifiersCalc",
    ],
  ])("is named by the kind of %s", (_kind, rawText, path) => {
    const item = parseClipboard(rawText)._unsafeUnwrap();

    expect(__testExports.poe2dbUrl(item)).toBe(`https://poe2db.tw/us/${path}`);
  });

  it("is a focus or buckler page without defences, in the app's language", async () => {
    setupTests({ language: "ja" });
    await init("ja");
    const pages = [JaArrayedFocus, JaArrayBuckler].map((fixture) =>
      __testExports.poe2dbUrl(parseClipboard(fixture.rawText)._unsafeUnwrap()),
    );

    expect(pages).toEqual([
      "https://poe2db.tw/jp/Foci#ModifiersCalc",
      "https://poe2db.tw/jp/Bucklers#ModifiersCalc",
    ]);
  });

  it("opens in a new window", () => {
    const opened: Array<string | URL | undefined> = [];
    vi.stubGlobal("window", { open: (url?: string | URL) => opened.push(url) });

    openPoedb(parseClipboard(RareJewel.rawText)._unsafeUnwrap());

    expect(opened).toEqual(["https://poe2db.tw/us/Ruby#ModifiersCalc"]);
  });
});

describe("the Craft of Exile button", () => {
  it("shows for a modifiable item copied in English", async () => {
    setupTests();
    await init("en");

    expect(canOpenCoE(parseClipboard(NormalItem.rawText)._unsafeUnwrap())).toBe(
      true,
    );
  });

  it("is hidden for a modifiable item copied in German, as its hotkey row is", async () => {
    setupTests({ language: "de" });
    await init("de");
    const item = parseClipboard(DePlatedVestments.rawText)._unsafeUnwrap();
    expect(item.info.craftable).toBeDefined();
    expect(itemIsModifiable(item)).toBe(true);

    expect(canOpenCoE(item)).toBe(false);
  });
});

describe("the stash search for items of the same price", () => {
  let searches: string[];

  function searchFor(
    rawText: string,
    samePricedType: ItemCheckWidget["samePricedType"],
    note?: string,
  ) {
    const itemCheck: Widget & Pick<ItemCheckWidget, "samePricedType"> = {
      wmId: 1,
      wmType: "item-check",
      wmTitle: "",
      wmWants: "hide",
      wmZorder: null,
      wmFlags: [],
      samePricedType,
    };
    setupTests();
    const defaultWidgets = AppConfig().widgets;
    setupTests({ widgets: [...defaultWidgets, itemCheck] });
    const item = parseClipboard(rawText)._unsafeUnwrap();
    if (note != null) item.note = note;

    findSamePricedItems(item);
    return searches;
  }

  beforeEach(async () => {
    searches = [];
    vi.mocked(Host.sendEvent).mockImplementation((event: IpcEvent) => {
      if (
        event.name === "CLIENT->MAIN::user-action" &&
        event.payload.action === "stash-search"
      ) {
        searches.push(event.payload.text);
      }
    });
    setupTests();
    await init("en");
  });

  it("is not sent for an item without a price note", () => {
    expect(searchFor(RareJewel.rawText, "both")).toEqual([]);
  });

  it("searches the note in quotes with Price Only", () => {
    expect(searchFor(TwoLineOneImplicitItem.rawText, "price")).toEqual([
      '"~b/o 1 exalted"',
    ]);
  });

  it("adds the name in quotes with Price and Item", () => {
    expect(searchFor(TwoLineOneImplicitItem.rawText, "both")).toEqual([
      '"~b/o 1 exalted""Delirium Precursor Tablet"',
    ]);
  });

  it("adds the name while the search is at most 50 characters", () => {
    const note = "~price 99999999999999999 exalted";
    const longerNote = note.replace("~price ", "~price 9");

    expect(searchFor(NormalShield.rawText, "both", note)).toEqual([
      `"${note}""Polished Targe"`,
    ]);
    expect(searches[0]).toHaveLength(50);
    expect(searchFor(NormalShield.rawText, "both", longerNote)).toEqual([
      `"${note}""Polished Targe"`,
      `"${longerNote}"`,
    ]);
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});
