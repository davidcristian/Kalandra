import { describe, expect, it } from "vitest";
import {
  decisionCreate,
  decisionHasColor,
  nextDecision,
  removeMark,
} from "@/web/map-check/common";

describe("a click on a Map check modifier", () => {
  it("marks an unmarked modifier deadly, then warning, good, seen and deadly again", () => {
    const marks = ["-"];
    for (let click = 0; click < 5; click++) {
      marks.push(nextDecision(marks[marks.length - 1]));
    }

    expect(marks).toEqual(["-", "d", "w", "g", "s", "d"]);
  });
});

describe("the marks of the three profiles", () => {
  it("writes the first mark of a modifier into the character of its profile", () => {
    expect([1, 2, 3].map((profile) => decisionCreate("d", profile))).toEqual([
      "d--",
      "-d-",
      "--d",
    ]);
  });

  it("changes the mark of one profile and keeps the marks of the others", () => {
    expect(decisionCreate("s", 1, "dwg")).toBe("swg");
    expect(decisionCreate("g", 2, "dwg")).toBe("dgg");
    expect(decisionCreate("-", 3, "dwg")).toBe("dw-");
  });

  it("colors a deadly, warning or good mark, and not an unmarked or seen modifier", () => {
    expect(
      [1, 2, 3].map((profile) => decisionHasColor("dwg", profile)),
    ).toEqual([true, true, true]);
    expect(
      [1, 2, 3].map((profile) => decisionHasColor("s-w", profile)),
    ).toEqual([false, false, true]);
  });
});

describe("the x button of a marked row in Settings, Map check", () => {
  it("removes the mark of profile II and keeps the marks of profiles I and III", () => {
    const stat = { matcher: "#% maximum Player Resistances", decision: "wdg" };

    removeMark(stat, 2);

    expect(stat.decision).toBe("w-g");
    expect(
      [1, 2, 3].map((profile) => decisionHasColor(stat.decision, profile)),
    ).toEqual([true, false, true]);
  });

  it("removes only the character of the profile it is pressed in", () => {
    const removed = [1, 2, 3].map((profile) => {
      const stat = { decision: "wdg" };
      removeMark(stat, profile);
      return stat.decision;
    });

    expect(removed).toEqual(["-dg", "w-g", "wd-"]);
  });
});
