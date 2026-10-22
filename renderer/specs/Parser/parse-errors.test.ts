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

let warned: unknown[][] = [];
let failed: unknown[][] = [];

beforeEach(() => {
  vi.spyOn(console, "warn").mockImplementation((...args: unknown[]) => {
    warned.push(args);
  });
  vi.spyOn(console, "error").mockImplementation((...args: unknown[]) => {
    failed.push(args);
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

async function loadLanguageQuietly(language: Config["language"]) {
  await loadLanguage(language);
  warned = [];
  failed = [];
}

describe("parseClipboard on text it cannot price check", () => {
  beforeEach(async () => {
    await loadLanguageQuietly("en");
  });

  it.each([
    ["an empty clipboard", ""],
    ["a blank line", "\n"],
    ["one line of text", "Hello there"],
  ])("returns item.parse_error and logs the error for %s", (_, text) => {
    expect(parseError(text)).toBe("item.parse_error");
    expect(failed.at(-1)?.[0]).toBe("Cannot parse the item text:");
    expect(failed.at(-1)?.[1]).toBeInstanceOf(Error);
  });

  it("returns item.parse_error and warns with the lines in no language's item format", () => {
    expect(parseError("Path of Exile 2\nPatch notes\n")).toBe(
      "item.parse_error",
    );
    expect(warned).toEqual([
      ["Cannot find the item class line:", ["Path of Exile 2", "Patch notes"]],
    ]);
  });

  it("returns item.parse_error for an item without its name line", () => {
    const text = NormalItem.rawText.replace("Superior Divine Crown\n", "");

    expect(parseError(text)).toBe("item.parse_error");
    expect(warned).toEqual([]);
    expect(failed).toEqual([]);
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
  it.each([
    ["German", "en", DePlatedVestments.rawText, "Deutsch|English"],
    ["Japanese", "en", JaArrayedFocus.rawText, "日本語|English"],
    ["English", "de", NormalItem.rawText, "English|Deutsch"],
  ] as const)(
    "names the %s of the item and the language of the app without a warning",
    async (_, language, text, languages) => {
      await loadLanguageQuietly(language);

      expect(parseError(text)).toBe(`item.wrong_language|${languages}`);
      expect(warned).toEqual([]);
    },
  );
});
