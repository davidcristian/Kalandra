import fs from "fs";
import path from "path";
import { describe, expect, it } from "vitest";
import { readMessages, TRANSLATIONS } from "./app-i18n";

const SRC_DIR = path.resolve(__dirname, "../../src");

// The UI text that docs/dev/refinements/tasks/019-ui-text-not-in-app-i18n.md lists: t() gets it as
// a key, and the English file does not define it yet. Remove a text here when it gets a key.
const LISTED_MISSING = ["Hotcool"];

// Keys that t() gets through a condition or a prop default, which literalKeys() does not read
const EXPRESSION_KEYS = [
  "Instant",
  "Offline",
  "Online",
  "Trade",
  "poe2_new.failed_to_load",
  "poe2_new.internal_error",
];

// Key prefixes that src/ completes at run time, as in t(`tips.tip_${n}`)
const COMPUTED_PREFIXES = [
  "filters.tag_",
  "item.mod_",
  "item_category.",
  "tips.tip_",
];

// Keys that src/ builds whole: an Ultimatum hint in lower case, and a parse error name with _help
const COMPUTED_KEYS = [
  "item.victorious",
  "item.cowardly",
  "item.deadly",
  "item.parse_error_help",
  "item.unknown_help",
  "item.wrong_language_help",
];

// Keys of the English file that no code reads yet, each kept for a planned use
const PLANNED: string[] = [];

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

/** Returns each quoted string in src/, and a string that starts with : as a key of its file's namespace. */
function quotedStrings(): Set<string> {
  const strings = new Set<string>();
  for (const file of sourceFiles(SRC_DIR)) {
    const source = fs.readFileSync(file, "utf8");
    const namespace = source.match(/useI18nNs\(\s*"([^"]+)"/)?.[1];
    for (const match of source.matchAll(/(["'`])([^"'`\n]*)\1/g)) {
      strings.add(match[2]);
      if (namespace && match[2].startsWith(":")) {
        strings.add(match[2].replace(":", `${namespace}.`));
      }
    }
  }
  return strings;
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

describe("the keys that t() gets through an expression", () => {
  const english = readMessages("en");
  const quoted = quotedStrings();

  it("are quoted in the source and are UI texts of the English file", () => {
    const missing = EXPRESSION_KEYS.filter(
      (key) => !quoted.has(key) || !english.has(key),
    );
    expect(missing).toEqual([]);
  });
});

describe("the keys of a translation", () => {
  const english = readMessages("en");
  const listed = new Set(LISTED_MISSING);

  it.each(TRANSLATIONS)(
    "are keys of the English file, or listed as missing, in %s",
    (lang) => {
      const unknown = [...readMessages(lang).keys()].filter(
        (key) => !english.has(key) && !listed.has(key),
      );
      expect(unknown).toEqual([]);
    },
  );
});

describe("the keys of the English file", () => {
  const english = [...readMessages("en").keys()];
  const quoted = quotedStrings();

  it("are each a quoted string in the source, computed there or planned", () => {
    const unread = english.filter(
      (key) =>
        !quoted.has(key) &&
        !COMPUTED_KEYS.includes(key) &&
        !PLANNED.includes(key) &&
        !COMPUTED_PREFIXES.some((prefix) => key.startsWith(prefix)),
    );
    expect(unread).toEqual([]);
  });
});

describe("the computed and planned key lists", () => {
  const english = [...readMessages("en").keys()];
  const quoted = quotedStrings();

  it("name English keys, prefixes the source builds and planned keys it does not read", () => {
    const source = sourceFiles(SRC_DIR)
      .map((file) => fs.readFileSync(file, "utf8"))
      .join("\n");
    const outdated = [
      ...[...COMPUTED_KEYS, ...PLANNED].filter((key) => !english.includes(key)),
      ...COMPUTED_PREFIXES.filter(
        (prefix) => !source.includes(`\`${prefix}\${`),
      ),
      ...PLANNED.filter((key) => quoted.has(key)),
    ];
    expect(outdated).toEqual([]);
  });
});
