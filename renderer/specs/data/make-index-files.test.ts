import { spawnSync } from "child_process";
import fs from "fs";
import os from "os";
import path from "path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

const SCRIPT = path.resolve(__dirname, "../../src/assets/make-index-files.mjs");
const LANGUAGES = ["en", "ru", "cmn-Hant", "ko", "ja", "de", "es", "pt", "fr"];
const STAT = '{"ref": "Life", "matchers": [{"string": "Life"}]}';
const RING = '{"name": "Ring", "refName": "Ring", "namespace": "ITEM"}';
const NAMELESS_UNIQUE = '{"namespace": "UNIQUE", "unique": {"base": "Ring"}}';

let dir: string;

const dataFile = (lang: string, name: string) =>
  path.join(dir, "public", "data", lang, name);

const makeIndexFiles = () =>
  spawnSync(process.execPath, [SCRIPT], { cwd: dir, encoding: "utf-8" });

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "kalandra-index-"));
  for (const lang of LANGUAGES) {
    fs.mkdirSync(path.join(dir, "public", "data", lang), { recursive: true });
    fs.writeFileSync(dataFile(lang, "stats.ndjson"), `${STAT}\n`);
    fs.writeFileSync(dataFile(lang, "items.ndjson"), `${RING}\n`);
  }
});

afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true });
});

describe("make-index-files", () => {
  it("writes one item index row per item when every item has a refName", () => {
    const result = makeIndexFiles();

    expect(result.stderr).toBe("");
    expect(result.status).toBe(0);
    for (const lang of LANGUAGES) {
      // A row is a 32-bit hash and a 32-bit line start
      expect(fs.statSync(dataFile(lang, "items-ref.index.bin")).size).toBe(8);
    }
  });

  it("fails and names the file and line of an item without a refName", () => {
    fs.writeFileSync(
      dataFile("de", "items.ndjson"),
      `${RING}\n${NAMELESS_UNIQUE}\n`,
    );

    const result = makeIndexFiles();

    expect(result.status).toBe(1);
    expect(result.stderr).toContain(
      "public/data/de/items.ndjson:2: the item has no refName",
    );
    expect(fs.existsSync(dataFile("de", "items-ref.index.bin"))).toBe(false);
  });
});
