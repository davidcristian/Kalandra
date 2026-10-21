import { describe, expect, it } from "vitest";
import { readMessages, TRANSLATIONS } from "./app-i18n";

function placeholders(text: string): string[] {
  return [...new Set(text.match(/\{[^{}]*\}/g) ?? [])].sort();
}

describe("the placeholders in translated UI text", () => {
  const english = readMessages("en");

  it("reads every translated UI text file", () => {
    const known = ["cmn-Hant", "de", "es", "fr", "ja", "ko", "pt", "ru", "th"];
    expect(TRANSLATIONS).toEqual(expect.arrayContaining(known));
  });

  it.each(TRANSLATIONS)("match the English text in %s", (lang) => {
    const mismatched: Record<string, { en: string[]; translated: string[] }> =
      {};
    for (const [key, text] of readMessages(lang)) {
      const source = english.get(key);
      if (source === undefined) continue;
      const expected = placeholders(source);
      const actual = placeholders(text);
      if (expected.join() !== actual.join()) {
        mismatched[key] = { en: expected, translated: actual };
      }
    }
    expect(mismatched).toEqual({});
  });
});
