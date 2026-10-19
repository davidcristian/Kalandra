import fs from "fs";
import path from "path";
import { describe, expect, it } from "vitest";

const DATA_DIR = path.resolve(__dirname, "../../public/data");

interface Messages {
  [key: string]: string | Messages;
}

function readMessages(lang: string): Map<string, string> {
  const file = path.join(DATA_DIR, lang, "app_i18n.json");
  const root = JSON.parse(fs.readFileSync(file, "utf8")) as Messages;
  const flat = new Map<string, string>();
  const walk = (node: Messages, prefix: string) => {
    for (const [key, value] of Object.entries(node)) {
      const fullKey = prefix ? `${prefix}.${key}` : key;
      if (typeof value === "string") flat.set(fullKey, value);
      else walk(value, fullKey);
    }
  };
  walk(root, "");
  return flat;
}

function placeholders(text: string): string[] {
  return [...new Set(text.match(/\{[^{}]*\}/g) ?? [])].sort();
}

const translations = fs
  .readdirSync(DATA_DIR)
  .filter(
    (lang) =>
      lang !== "en" &&
      fs.existsSync(path.join(DATA_DIR, lang, "app_i18n.json")),
  );

describe("the placeholders in translated UI text", () => {
  const english = readMessages("en");

  it("reads every translated UI text file", () => {
    const known = ["cmn-Hant", "de", "es", "fr", "ja", "ko", "pt", "ru", "th"];
    expect(translations).toEqual(expect.arrayContaining(known));
  });

  it.each(translations)("match the English text in %s", (lang) => {
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
