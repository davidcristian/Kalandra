import fs from "fs";
import path from "path";
import { describe, expect, it } from "vitest";
import { readMessages } from "./app-i18n";

const SRC_DIR = path.resolve(__dirname, "../../src");

// The UI texts that docs/dev/refinements/tasks/019-ui-text-not-in-app-i18n.md lists: t() gets them
// as keys, and the English file does not define them yet. Remove a text here when it gets a key.
const LISTED_MISSING = [
  "Add",
  "Both",
  "Browser",
  "Cancel",
  "Currency / Hour",
  "Disabled",
  "Gone",
  "Hotcool",
  "Instant",
  "Instant or Online",
  "Items / Hour",
  "Loading...",
  "No",
  "None",
  "Not recognized modifier",
  "Online",
  "Recording settings",
  "Refresh",
  "Reload fallback data",
  "Remove",
  "Restart required",
  "Retry",
  "Retry Item",
  "Save",
  "Search",
  "Select",
  "Unable to determine fractured stat",
  "You",
  "added mods column",
  "in demand",
  "keep augment mods",
  "keep enchant mods",
  "keep explicit mods",
  "keep implicit mods",
  "max",
  "milliseconds",
  "min",
  "removed mods column",
  "show ref",
  "show roll",
  "show tier",
  "show type",
];

function sourceFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(file);
    return /\.(vue|ts)$/.test(entry.name) ? [file] : [];
  });
}

/** Returns each string literal passed whole as the first argument of t() in src/, with the files that pass it. */
function literalKeys(): Map<string, string[]> {
  const keys = new Map<string, string[]>();
  for (const file of sourceFiles(SRC_DIR)) {
    const source = fs.readFileSync(file, "utf8");
    const namespace = source.match(/useI18nNs\(\s*"([^"]+)"/)?.[1];
    for (const match of source.matchAll(/\bt\(\s*(["'])([^"'\n]+)\1\s*[,)]/g)) {
      // useI18nNs("name") turns a key that starts with : into name.key
      const key = match[2].replace(/^:/, `${namespace}.`);
      const files = keys.get(key) ?? [];
      keys.set(key, [...files, path.relative(SRC_DIR, file)]);
    }
  }
  return keys;
}

describe("the literal keys passed to t()", () => {
  const english = readMessages("en");
  const used = literalKeys();

  it("are found in the source", () => {
    expect(used.get("widget.untitled")?.length).toBe(3);
    expect(used.has("notepad.placeholder")).toBe(true);
  });

  it("are UI texts of the English file, or listed as missing", () => {
    const missing = [...used]
      .filter(([key]) => !english.has(key) && !LISTED_MISSING.includes(key))
      .map(([key, files]) => `${key} in ${[...new Set(files)].join(", ")}`);
    expect(missing).toEqual([]);
  });

  it("include each listed key, which the English file still does not define", () => {
    const outdated = LISTED_MISSING.filter(
      (key) => !used.has(key) || english.has(key),
    );
    expect(outdated).toEqual([]);
  });
});
