export const DEFAULT_FONT_SIZE = 16;
export const MIN_FONT_SIZE = 10;
export const MAX_FONT_SIZE = 40;

/** Returns the font size within the accepted range, or the default when the value is not a finite number. */
export function validFontSize(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return DEFAULT_FONT_SIZE;
  }
  return Math.min(Math.max(value, MIN_FONT_SIZE), MAX_FONT_SIZE);
}

/** Returns the font size typed into the Settings field, or `current` when the text is not a number. */
export function fontSizeFromInput(text: string, current: number): number {
  const value = Number.parseFloat(text);
  return Number.isFinite(value) ? validFontSize(value) : current;
}
