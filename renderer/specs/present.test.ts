import { describe, expect, it } from "vitest";
import { present } from "@specs/present";

describe("present", () => {
  it("returns a value that is set, including 0 and an empty string", () => {
    expect(present(0)).toBe(0);
    expect(present("")).toBe("");
    expect(present(false)).toBe(false);
  });

  it("throws for undefined and null", () => {
    expect(() => present(undefined)).toThrow(
      "The test expected a value and found none",
    );
    expect(() => present(null)).toThrow(
      "The test expected a value and found none",
    );
  });
});
