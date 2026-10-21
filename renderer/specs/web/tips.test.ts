import { afterEach, describe, expect, it, vi } from "vitest";
import { randomTip, TIP_COUNT } from "@/web/help/tips";
import { readMessages } from "./app-i18n";

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
