import { describe, expect, it } from "vitest";
import { readMessages, TRANSLATIONS } from "./app-i18n";

const PRODUCT_NAME = "Kalandra";

describe("the product name in translated UI text", () => {
  const named = [...readMessages("en")]
    .filter(([, text]) => text.includes(PRODUCT_NAME))
    .map(([key]) => key);

  it("is in the English Settings title", () => {
    expect(named).toContain("settings.title");
  });

  it.each(TRANSLATIONS)("is kept as it is in %s", (lang) => {
    const messages = readMessages(lang);
    const translated = named.filter(
      (key) => messages.has(key) && !messages.get(key)!.includes(PRODUCT_NAME),
    );
    expect(translated).toEqual([]);
  });
});
