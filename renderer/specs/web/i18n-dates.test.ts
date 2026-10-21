import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { DateTime } from "luxon";
import { setupTests } from "@specs/vitest.setup";
import { init, loadLang } from "@/web/i18n";
import type { Config } from "@/web/Config";

beforeAll(async () => {
  setupTests();
  vi.stubGlobal("document", { documentElement: { lang: "" } });
  await init("en");
});

afterAll(() => {
  vi.unstubAllGlobals();
});

describe("relative times after a language change", () => {
  const cases: Array<[Config["language"], string, string]> = [
    ["de", "vor 2 Stunden", "vor 5 Min."],
    ["ru", "2 часа назад", "5 мин. назад"],
    ["cmn-Hant", "2 小時前", "5 分鐘前"],
    ["pt", "há 2 horas", "há 5 min."],
    ["en", "2 hours ago", "5 min. ago"],
  ];

  it.each(cases)("are written in %s", async (lang, long, short) => {
    await loadLang(lang);

    const checkedAt = DateTime.now().minus({ hours: 2 }).toMillis();
    const listedAt = DateTime.now().minus({ minutes: 5 }).toISO();
    expect(DateTime.fromMillis(checkedAt).toRelative({ style: "long" })).toBe(
      long,
    );
    expect(DateTime.fromISO(listedAt).toRelative({ style: "short" })).toBe(
      short,
    );
    expect(document.documentElement.lang).toBe(lang);
  });
});
