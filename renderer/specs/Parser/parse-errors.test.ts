import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { init } from "@/assets/data";
import { parseClipboard } from "@/parser";
import type { Config } from "@/web/Config";
import { setupTests } from "@specs/vitest.setup";
import { DePlatedVestments, JaArrayedFocus, NormalItem } from "./items";

async function loadLanguage(language: Config["language"]) {
  setupTests({ language });
  await init(language);
}

function parseError(text: string) {
  const result = parseClipboard(text);
  expect(result.isErr()).toBe(true);
  return result._unsafeUnwrapErr();
}

describe("parseClipboard on text it cannot price check", () => {
  let logged: unknown[];

  beforeEach(async () => {
    logged = [];
    vi.spyOn(console, "log").mockImplementation((message: unknown) => {
      logged.push(message);
    });
    await loadLanguage("en");
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it.each([
    ["an empty clipboard", ""],
    ["a blank line", "\n"],
    ["one line of text", "Hello there"],
  ])("returns item.parse_error and logs the error for %s", (_, text) => {
    expect(parseError(text)).toBe("item.parse_error");
    expect(logged.at(-1)).toBeInstanceOf(Error);
  });

  it("returns item.parse_error for lines in no language's item format", () => {
    expect(parseError("Path of Exile 2\nPatch notes\n")).toBe(
      "item.parse_error",
    );
    expect(logged).toEqual([["Path of Exile 2", "Patch notes"]]);
  });

  it("returns item.parse_error for an item without its name line", () => {
    const text = NormalItem.rawText.replace("Superior Divine Crown\n", "");

    expect(parseError(text)).toBe("item.parse_error");
    expect(logged).toEqual([]);
  });

  it("returns item.unknown for a base that neither the game data nor the trade data has", () => {
    const text = NormalItem.rawText.replace(
      "Superior Divine Crown",
      "Superior Paper Crown",
    );

    expect(parseError(text)).toBe("item.unknown");
  });
});

describe("parseClipboard on an item copied in another language", () => {
  beforeEach(() => {
    vi.spyOn(console, "log").mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it.each([
    ["German", "en", DePlatedVestments.rawText, "Deutsch|English"],
    ["Japanese", "en", JaArrayedFocus.rawText, "日本語|English"],
    ["English", "de", NormalItem.rawText, "English|Deutsch"],
  ] as const)(
    "names the %s of the item and the language of the app",
    async (_, language, text, languages) => {
      await loadLanguage(language);

      expect(parseError(text)).toBe(`item.wrong_language|${languages}`);
    },
  );
});
