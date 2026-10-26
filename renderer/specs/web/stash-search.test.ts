import { beforeEach, describe, expect, it } from "vitest";
import { setupTests } from "@specs/vitest.setup";
import { init } from "@/assets/data";
import {
  newWidgetEntries,
  type StashSearchWidget,
} from "@/web/stash-search/widget";
import WidgetStashSearch from "@/web/stash-search/WidgetStashSearch.vue";
import { widgetComponent } from "@/web/overlay/widget-component";
import {
  entrySearchText,
  namePresetEntries,
  searchKeyword,
  setEntryText,
  type StashSearchEntry,
  type StashSearchPreset,
} from "@/web/stash-search/presets";
import { shortcutActions } from "@/web/shortcut-actions";
import { hotkeyConfig, widgetEntry } from "./hotkey-config";

beforeEach(() => {
  setupTests();
});

function presetEntry(preset: StashSearchPreset, text = ""): StashSearchEntry {
  return { id: 1, name: "", text, hotkey: null, preset };
}

const PRESETS: StashSearchPreset[] = [
  "currency",
  "normal-rarity",
  "trial-count",
];

describe("the searches of a new stash search widget", () => {
  it.each([
    ["en", "Currency"],
    ["de", "Währung"],
    ["ko", "화폐"],
    ["es", '"Objetos monetarios"'],
  ])("search the Currency rarity of the %s game data", async (lang, text) => {
    await init(lang);

    expect(newWidgetEntries()).toEqual([
      { id: 1, name: "", text, hotkey: null, preset: "currency" },
    ]);
  });
});

describe("the preset searches", () => {
  it.each([
    ["en", ["Currency", '"Rarity: Normal"', '"Number of Trials:"']],
    ["de", ["Währung", '"Seltenheit: Normal"', '"Anzahl der Prüfungen:"']],
    ["ko", ["화폐", '"아이템 희귀도: 일반"', '"시련 수:"']],
  ])("search the game text of the %s game data", async (lang, texts) => {
    await init(lang);

    expect(
      PRESETS.map((preset) => entrySearchText(presetEntry(preset))),
    ).toEqual(texts);
  });

  it("give the default Dump sorting widget the game text of three searches", async () => {
    await init("de");
    const spec = widgetComponent(WidgetStashSearch).widget;
    const widgets = (("defaultInstances" in spec &&
      spec.defaultInstances?.()) ||
      []) as StashSearchWidget[];
    const dumpSorting = widgets.find((w) => w.wmTitle === "Dump sorting");

    expect(dumpSorting?.entries.map(entrySearchText)).toEqual([
      "Währung",
      '"Martial Weapon"',
      "Jewel",
      '"Waystone Tier"',
      '"Seltenheit: Normal"',
      '"Anzahl der Prüfungen:"',
    ]);
  });

  it("follow the game language to the data loaded last", async () => {
    const entry = presetEntry("currency", "Currency");

    await init("de");
    expect(entrySearchText(entry)).toBe("Währung");
    await init("en");
    expect(entrySearchText(entry)).toBe("Currency");
  });

  it("search the game text in place of the saved text", async () => {
    await init("de");

    expect(entrySearchText(presetEntry("currency", "Rune"))).toBe("Währung");
  });

  it("search the saved text of an entry without a preset or with one this version lacks", async () => {
    await init("de");
    const newer = { ...presetEntry("currency", "Wegstein"), preset: "jewel" };

    expect(
      entrySearchText({ id: 2, name: "", text: "Rune", hotkey: null }),
    ).toBe("Rune");
    expect(entrySearchText(newer as StashSearchEntry)).toBe("Wegstein");
  });

  it("stop following the language once the user edits the text", async () => {
    await init("de");
    const entry = presetEntry("currency", "Currency");

    setEntryText(entry, "Currency");

    expect(entry).toEqual({ id: 1, name: "", text: "Currency", hotkey: null });
    expect(entrySearchText(entry)).toBe("Currency");
  });

  it("send the game text with an entry's hotkey", async () => {
    await init("de");
    const config = hotkeyConfig();
    const entries = [{ ...presetEntry("currency", "Currency"), hotkey: "F3" }];
    config.widgets.push(
      widgetEntry(5, "stash-search", { enableHotkeys: true, entries }),
    );

    expect(shortcutActions(config).slice(3)).toEqual([
      { shortcut: "F3", action: { type: "stash-search", text: "Währung" } },
    ]);
  });
});

describe("searchKeyword", () => {
  it("quotes a text with a space and trims the ends", () => {
    expect(searchKeyword("Währung")).toBe("Währung");
    expect(searchKeyword(" Number of Trials: ")).toBe('"Number of Trials:"');
  });
});

describe("namePresetEntries", () => {
  function entries(texts: string[]) {
    return texts.map((text, i) => ({ id: i, name: "", text, hotkey: null }));
  }

  it("names the English default texts of earlier versions by preset and keeps the others", () => {
    const dumpSorting = {
      wmType: "stash-search",
      entries: entries([
        "Currency",
        '"Martial Weapon"',
        '"Rarity: Normal"',
        "Trials:",
        "currency",
        "constructor",
      ]),
    };
    const kept = { ...presetEntry("currency", "Trials:") };
    const other = { wmType: "stash-search", entries: [kept] };
    const notes = { wmType: "notepad", entries: entries(["Currency"]) };

    namePresetEntries({
      widgets: [dumpSorting, other, notes, { wmType: "x" }],
    });

    expect(dumpSorting.entries.map((e) => "preset" in e && e.preset)).toEqual([
      "currency",
      false,
      "normal-rarity",
      "trial-count",
      false,
      false,
    ]);
    expect(kept.preset).toBe("currency");
    expect(notes.entries[0]).not.toHaveProperty("preset");
  });
});
