import { beforeEach, describe, expect, it } from "vitest";
import { setupTests } from "@specs/vitest.setup";
import { init } from "@/assets/data";
import { newWidgetEntries } from "@/web/stash-search/widget";

beforeEach(() => {
  setupTests();
});

describe("the searches of a new stash search widget", () => {
  it.each([
    ["en", "Currency"],
    ["de", "Währung"],
    ["ko", "화폐"],
  ])("search the Currency rarity of the %s game data", async (lang, text) => {
    await init(lang);

    expect(newWidgetEntries()).toEqual([
      { id: 1, name: "", text, hotkey: null },
    ]);
  });
});
