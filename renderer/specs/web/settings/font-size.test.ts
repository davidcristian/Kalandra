import { describe, expect, it } from "vitest";
import {
  DEFAULT_FONT_SIZE,
  fontSizeFromInput,
  MAX_FONT_SIZE,
  MIN_FONT_SIZE,
  validFontSize,
} from "@/web/settings/font-size";

describe("the font size the overlay reads from a saved config", () => {
  it("keeps a number within the range", () => {
    expect(validFontSize(16)).toBe(16);
    expect(validFontSize(18.5)).toBe(18.5);
    expect(validFontSize(MIN_FONT_SIZE)).toBe(MIN_FONT_SIZE);
    expect(validFontSize(MAX_FONT_SIZE)).toBe(MAX_FONT_SIZE);
  });

  it("reads text that an older Settings field stored as the default", () => {
    expect(validFontSize("")).toBe(DEFAULT_FONT_SIZE);
    expect(validFontSize("abc")).toBe(DEFAULT_FONT_SIZE);
  });

  it("reads a missing or infinite value as the default", () => {
    expect(validFontSize(undefined)).toBe(DEFAULT_FONT_SIZE);
    expect(validFontSize(Number.NaN)).toBe(DEFAULT_FONT_SIZE);
    expect(validFontSize(Number.POSITIVE_INFINITY)).toBe(DEFAULT_FONT_SIZE);
  });

  it("reads a number outside the range as the nearest limit", () => {
    expect(validFontSize(1)).toBe(MIN_FONT_SIZE);
    expect(validFontSize(-16)).toBe(MIN_FONT_SIZE);
    expect(validFontSize(160)).toBe(MAX_FONT_SIZE);
  });
});

describe("the Font size field in Settings", () => {
  it("stores the typed number", () => {
    expect(fontSizeFromInput("20", 16)).toBe(20);
  });

  it("keeps the current size when the field is empty or holds no number", () => {
    expect(fontSizeFromInput("", 18)).toBe(18);
    expect(fontSizeFromInput("abc", 18)).toBe(18);
  });

  it("stores the nearest limit for a number outside the range", () => {
    expect(fontSizeFromInput("1", 16)).toBe(MIN_FONT_SIZE);
    expect(fontSizeFromInput("160", 16)).toBe(MAX_FONT_SIZE);
  });
});
