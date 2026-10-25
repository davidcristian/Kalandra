import fs from "fs";
import path from "path";
import { describe, expect, it } from "vitest";
import { createI18n, type DefineLocaleMessage } from "vue-i18n";
import { DATA_DIR, readMessages, TRANSLATIONS } from "./app-i18n";

const LANGUAGES = ["en", ...TRANSLATIONS];

function readFile(lang: string): DefineLocaleMessage {
  const file = path.join(DATA_DIR, lang, "app_i18n.json");
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

/** Returns the dotted key of each value that is neither a text nor a group of texts. */
function nonTexts(node: unknown, key = ""): string[] {
  if (typeof node === "string") return [];
  if (node === null || typeof node !== "object" || Array.isArray(node)) {
    return [key];
  }
  return Object.entries(node).flatMap(([name, value]) =>
    nonTexts(value, key ? `${key}.${name}` : name),
  );
}

describe("a UI text file", () => {
  it.each(LANGUAGES)("holds only texts and groups of texts in %s", (lang) => {
    expect(nonTexts(readFile(lang))).toEqual([]);
  });

  // vue-i18n compiles a text when t() first reads it and throws on a syntax error, such as an
  // unclosed { or an @ that does not start a linked key
  it.each(LANGUAGES)("holds texts that vue-i18n compiles in %s", (lang) => {
    const { global } = createI18n({
      legacy: false,
      locale: lang,
      messages: { [lang]: readFile(lang) },
    });
    const errors: Record<string, string> = {};
    for (const key of readMessages(lang).keys()) {
      try {
        global.t(key);
      } catch (error: unknown) {
        errors[key] = String(error);
      }
    }

    expect(errors).toEqual({});
  });
});
