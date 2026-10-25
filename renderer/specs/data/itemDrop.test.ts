import fs from "fs";
import path from "path";
import { beforeAll, describe, expect, it } from "vitest";
import { setupTests } from "@specs/vitest.setup";
import { type BaseType, init, ITEM_BY_REF, ITEM_DROP } from "@/assets/data";
import { splitQueryId } from "@/web/price-check/related-items/related-items";

const DATA_DIR = path.resolve(__dirname, "../../public/data");

function inItemData(ref: string) {
  const { ns, name, variant } = splitQueryId(ref);
  const found = ITEM_BY_REF(ns as BaseType["namespace"], name) ?? [];
  if (ns === "UNIQUE") {
    return found.some((unique) => unique.unique?.base === variant);
  }
  return found.length > 0;
}

/** Parses item-drop.jsonc, whose comments are whole lines that start with //. */
function readItemDropSource(): unknown {
  const text = fs.readFileSync(path.join(DATA_DIR, "item-drop.jsonc"), "utf8");
  const lines = text
    .split(/\r?\n/)
    .filter((line) => !line.trimStart().startsWith("//"));
  return JSON.parse(lines.join("\n"));
}

describe("item-drop.json", () => {
  beforeAll(async () => {
    setupTests();
    await init("en");
  });

  it("names only items, and uniques on base items, that the item data contains", () => {
    const refs = ITEM_DROP.flatMap((entry) => [...entry.query, ...entry.items]);

    expect(refs.filter((ref) => !inItemData(ref))).toEqual([]);
  });

  it("holds the groups of item-drop.jsonc in the same order", () => {
    expect(ITEM_DROP).toEqual(readItemDropSource());
  });
});
