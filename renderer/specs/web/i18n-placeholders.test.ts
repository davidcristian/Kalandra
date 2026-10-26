import { describe, expect, it } from "vitest";
import type { Config } from "@/web/Config";
import { readMessages, TRANSLATIONS } from "./app-i18n";

const SELECTABLE: Record<Exclude<Config["language"], "en">, true> = {
  "cmn-Hant": true,
  "de": true,
  "es": true,
  "fr": true,
  "ja": true,
  "ko": true,
  "pt": true,
  "ru": true,
};

function placeholders(text: string): string[] {
  return [...new Set(text.match(/\{[^{}]*\}/g) ?? [])].sort();
}

describe("the placeholders in translated UI text", () => {
  const english = readMessages("en");

  it("reads a translation for each selectable language and no other", () => {
    expect([...TRANSLATIONS].sort()).toEqual(Object.keys(SELECTABLE).sort());
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
