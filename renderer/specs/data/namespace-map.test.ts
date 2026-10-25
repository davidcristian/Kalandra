import fs from "fs";
import path from "path";
import { describe, expect, it } from "vitest";

const FILE = path.resolve(__dirname, "../../public/data/namespaceMap.json");

// The namespaces a price lookup searches, and a path segment of a poe.ninja page
const NAMESPACES: unknown[] = ["ITEM", "GEM", "UNIQUE"];
const PAGE = /^[a-z0-9]+(-[a-z0-9]+)*$/;

describe("namespaceMap.json", () => {
  const schema: { schemaVersion?: unknown; map?: unknown } = JSON.parse(
    fs.readFileSync(FILE, "utf8"),
  );
  const entries: Array<Record<string, unknown>> = Array.isArray(schema.map)
    ? schema.map
    : [];

  it("has the schema version both readers accept and a list of categories", () => {
    expect(schema.schemaVersion).toBe(1);
    expect(Array.isArray(schema.map)).toBe(true);
    expect(entries.length).toBeGreaterThan(0);
  });

  it("gives each category a namespace, an exchange flag, a poe.ninja page and a type", () => {
    const invalid = entries.filter(
      (entry) =>
        !NAMESPACES.includes(entry.ns) ||
        typeof entry.cx !== "boolean" ||
        typeof entry.url !== "string" ||
        !PAGE.test(entry.url) ||
        typeof entry.type !== "string" ||
        entry.type === "",
    );

    expect(invalid).toEqual([]);
  });

  it("lists each type once, since the app reads an overview with the first category of its type", () => {
    const types = entries.map((entry) => entry.type);

    expect(types.filter((type, i) => types.indexOf(type) !== i)).toEqual([]);
  });
});
