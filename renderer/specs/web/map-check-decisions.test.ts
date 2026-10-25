import { describe, expect, it } from "vitest";
import {
  decisionCreate,
  decisionHasColor,
  nextDecision,
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
