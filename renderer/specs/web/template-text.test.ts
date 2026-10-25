import fs from "fs";
import path from "path";
import { describe, expect, it } from "vitest";
import { parse } from "vue/compiler-sfc";

const SRC_DIR = path.resolve(__dirname, "../../src");

// The NodeTypes values of @vue/compiler-core for an element, a text and a static attribute
const ELEMENT = 1;
const TEXT = 2;
const ATTRIBUTE = 6;

const TEXT_ATTRIBUTES = ["title", "placeholder", "label", "alt", "aria-label"];

// CheckedItem.vue does not render price-prediction/, and task 018 decides whether it returns
const SKIPPED_DIRS = [path.join("web", "price-check", "price-prediction")];

// Text that is the same in every language
const ALLOWED = new Set([
  // Product and site names
  "Kalandra",
  "poe.ninja",
  "www.poeprices.info",
  "www.pathofexile.com",
  "r/pathofexile",
  "pathofexile",
  "PoE-Leveling-Guide",
  "wiki",
  "poedb",
  "CoE",
  // Each language of Settings, General in its own language
  "English",
  "Русский",
  "正體中文",
  "한국어",
  "日本語",
  "Deutsch",
  "Español",
  "Português (Brasil)",
  "Français",
  // Key names, written as the hotkeys write them
  "Ctrl",
  "Alt",
  "Ctrl + MouseWheel",
  // A currency abbreviation, as abbrev in background/Prices.ts, a unit and a symbol
  "div ⇒",
  "px",
  "Σ",
  // Example paths of the game's and the app's files
  "...?/Grinding Gear Games/Path of Exile 2/logs/Client.txt",
  "...?/My Games/Path of Exile 2/poe2_production_Config.ini",
  "...?/AppData/Roaming/kalandra/apt-data/csv-data",
]);

interface TemplateNode {
  type: number;
  content?: unknown;
  children?: TemplateNode[];
  props?: Array<{ type: number; name: string; value?: { content: string } }>;
}

/** Returns each text node and static text attribute with a letter in the template of an SFC. */
function templateTexts(source: string): string[] {
  const root = parse(source).descriptor.template?.ast as
    | TemplateNode
    | undefined;
  const texts: string[] = [];
  const walk = (node: TemplateNode) => {
    if (node.type === TEXT && typeof node.content === "string") {
      texts.push(node.content.trim());
    }
    if (node.type === ELEMENT) {
      for (const prop of node.props ?? []) {
        if (
          prop.type === ATTRIBUTE &&
          TEXT_ATTRIBUTES.includes(prop.name) &&
          prop.value
        ) {
          texts.push(prop.value.content.trim());
        }
      }
    }
    node.children?.forEach(walk);
  };
  if (root) walk(root);
  return texts.filter((text) => /\p{L}/u.test(text));
}

function vueFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      const skipped = SKIPPED_DIRS.includes(path.relative(SRC_DIR, file));
      return skipped ? [] : vueFiles(file);
    }
    return entry.name.endsWith(".vue") ? [file] : [];
  });
}

describe("the text in a template", () => {
  it("is found in text nodes, slots and text attributes, but not in t() calls", () => {
    const source = `<template>
      <div title="Hint" class="flex">Hello {{ t("key") }}
        <template #name><b>World</b></template>
        <input :placeholder="t('other')" placeholder="Type here" />
        <span>{{ count }} / 12</span>
      </div>
    </template>`;

    expect(templateTexts(source)).toEqual([
      "Hint",
      "Hello",
      "World",
      "Type here",
    ]);
  });

  it("goes through t() in src/, unless it is the same in every language", () => {
    const literal = vueFiles(SRC_DIR).flatMap((file) =>
      templateTexts(fs.readFileSync(file, "utf8"))
        .filter((text) => !ALLOWED.has(text))
        .map((text) => `${path.relative(SRC_DIR, file)}: ${text}`),
    );
    expect(literal).toEqual([]);
  });

  it("is allowed only where src/ still has it", () => {
    const found = new Set(
      vueFiles(SRC_DIR).flatMap((file) =>
        templateTexts(fs.readFileSync(file, "utf8")),
      ),
    );
    expect([...ALLOWED].filter((text) => !found.has(text))).toEqual([]);
  });
});
