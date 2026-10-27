import { afterEach, describe, expect, it, vi } from "vitest";
import { TipsFrequency } from "@/web/Config";
import { createTipSchedule, randomTip, TIP_COUNT } from "@/web/help/tips";
import { readMessages, TRANSLATIONS } from "./app-i18n";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("the tips", () => {
  it("are the English keys tips.tip_1 to tips.tip_<TIP_COUNT>, in order", () => {
    const keys = [...readMessages("en").keys()].filter((key) =>
      key.startsWith("tips."),
    );
    const numbered = Array.from(
      { length: TIP_COUNT },
      (_, index) => `tips.tip_${index + 1}`,
    );
    expect(keys).toEqual(numbered);
  });

  it.each([
    [0, 1],
    [0.999999, TIP_COUNT],
  ])("are picked from 1 to TIP_COUNT, %s gives %s", (random, tip) => {
    vi.spyOn(Math, "random").mockReturnValue(random);
    expect(randomTip()).toBe(tip);
  });
});

type TipSchedule = ReturnType<typeof createTipSchedule>;

/** Shows new items without a search, and returns the tip shown with each, or 0 for none. */
function showItems(
  schedule: TipSchedule,
  frequency: TipsFrequency,
  items: number,
): number[] {
  return Array.from({ length: items }, () =>
    schedule.next(frequency, true, false),
  );
}

function itemsWithTip(tips: number[]): number[] {
  return tips.flatMap((tip, index) => (tip > 0 ? [index + 1] : []));
}

describe("the tip schedule of the price check", () => {
  it("shows a tip with every item at Always", () => {
    const tips = showItems(createTipSchedule(0), TipsFrequency.Always, 5);

    expect(itemsWithTip(tips)).toEqual([1, 2, 3, 4, 5]);
  });

  it("shows no tip at Never", () => {
    const tips = showItems(createTipSchedule(500), TipsFrequency.Never, 500);

    expect(itemsWithTip(tips)).toEqual([]);
  });

  it.each([
    ["MoreOften", 7, TipsFrequency.MoreOften],
    ["Normal", 20, TipsFrequency.Normal],
    ["Rarely", 50, TipsFrequency.Rarely],
    ["VeryRarely", 100, TipsFrequency.VeryRarely],
  ])("at %s, shows a tip after %i items without one", (_name, n, frequency) => {
    const tips = showItems(createTipSchedule(0), frequency, 2 * n + 2);

    expect(itemsWithTip(tips)).toEqual([n + 1, 2 * n + 2]);
  });

  it("counts the items it starts with as items without a tip", () => {
    const tips = showItems(createTipSchedule(15), TipsFrequency.Normal, 6);

    expect(itemsWithTip(tips)).toEqual([6]);
  });

  it("shows no tip for a searched item, and shows it with the next item", () => {
    const schedule = createTipSchedule(20);

    expect(schedule.next(TipsFrequency.Normal, true, true)).toBe(0);
    expect(schedule.next(TipsFrequency.Normal, true, false)).toBeGreaterThan(0);
  });

  it("hides the tip when the search of the item starts", () => {
    const schedule = createTipSchedule(0);

    expect(schedule.next(TipsFrequency.Always, true, false)).toBeGreaterThan(0);
    expect(schedule.next(TipsFrequency.Always, false, true)).toBe(0);
  });

  it("does not count an item again when only its search starts or stops", () => {
    const schedule = createTipSchedule(19);
    const tips = [
      schedule.next(TipsFrequency.Normal, false, true),
      schedule.next(TipsFrequency.Normal, false, false),
      schedule.next(TipsFrequency.Normal, false, true),
      ...showItems(schedule, TipsFrequency.Normal, 2),
    ];

    expect(itemsWithTip(tips)).toEqual([5]);
  });
});

// Game options that a tip names, which the app does not show
const GAME_OPTIONS = ["Mousewheel Zoom"];

function tipTexts(lang: string): string[] {
  return [...readMessages(lang)]
    .filter(([key]) => key.startsWith("tips."))
    .map(([, text]) => text);
}

describe("the tip texts", () => {
  it.each(["en", ...TRANSLATIONS])("are each different in %s", (lang) => {
    const texts = tipTexts(lang);

    expect(new Set(texts).size).toBe(texts.length);
  });
});

describe("the names that the English tips quote", () => {
  const names = tipTexts("en").flatMap((text) =>
    [...text.matchAll(/"([^"]+)"/g)].map((match) => match[1]),
  );
  const uiTexts = new Set(
    [...readMessages("en")]
      .filter(([key]) => !key.startsWith("tips."))
      .map(([, text]) => text.toLowerCase()),
  );

  it("are found in the tips", () => {
    expect(names).toContain("Find in Stash");
  });

  it("are UI texts or game options, so no tip names a control the app does not have", () => {
    const unknown = names.filter(
      (name) =>
        !uiTexts.has(name.toLowerCase()) && !GAME_OPTIONS.includes(name),
    );
    expect(unknown).toEqual([]);
  });

  it("include each game option, which no UI text has", () => {
    const outdated = GAME_OPTIONS.filter(
      (name) => !names.includes(name) || uiTexts.has(name.toLowerCase()),
    );
    expect(outdated).toEqual([]);
  });
});
