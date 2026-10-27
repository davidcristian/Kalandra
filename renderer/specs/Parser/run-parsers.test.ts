import { describe, expect, it } from "vitest";
import { err } from "neverthrow";
import { runParsers, type ParserFn } from "@/parser/run-parsers";

const takeSection =
  (first: string): ParserFn<string[]> =>
  (section, seen) => {
    if (section[0] !== first) return "SECTION_SKIPPED";
    seen.push(first);
    return "SECTION_PARSED";
  };

describe("runParsers", () => {
  it("gives each section to the first parser that parses it, and removes it", () => {
    const sections = [["a"], ["b"], ["c"]];
    const seen: string[] = [];

    const error = runParsers(
      [takeSection("b"), takeSection("b"), takeSection("a")],
      sections,
      seen,
    );

    expect(error).toBeUndefined();
    expect(seen).toEqual(["b", "a"]);
    expect(sections).toEqual([["c"]]);
  });

  it("stops at the first error of a virtual parser", () => {
    const seen: string[] = [];

    const error = runParsers(
      [{ virtual: () => err("item.unknown") }, takeSection("a")],
      [["a"]],
      seen,
    );

    expect(error?.isErr()).toBe(true);
    expect(seen).toEqual([]);
  });
});
