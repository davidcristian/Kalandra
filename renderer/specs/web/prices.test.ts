import fs from "fs";
import path from "path";
import { __testExports, NinjaSchema } from "@/web/background/Prices";
import { leagueFileName } from "@/web/background/price-source";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { setupTests } from "@specs/vitest.setup";
import { init } from "@/assets/data";

const SERVICE_FIXTURES = path.resolve(
  __dirname,
  "../../../priceService/tests/fixtures",
);
const readText = (file: string) => fs.readFileSync(file, "utf-8");

/** The app's namespace map, read as the app reads it, after an optional edit of its text. */
function readSchema(edit = (text: string) => text): NinjaSchema {
  return JSON.parse(
    edit(
      readText(path.resolve(__dirname, "../../public/data/namespaceMap.json")),
    ),
  );
}

describe("the price file reader", () => {
  beforeEach(async () => {
    setupTests();
    await init("en");
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("parseXchg", () => {
    const blob =
      '{"core":{"rates":{"exalted":2312,"chaos":76.2},"primary":"divine","secondary":"chaos"},"itemOverviews":[{"type":"Currency","lines":[{"name":"Orb of Alchemy","detailsId":"orb-of-alchemy","id":"alch","primaryValue":0.00003575,"volumePrimaryValue":0.4008,"maxVolumeCurrency":"exalted",';
    const expected = {
      rates: {
        exalted: 2312,
        chaos: 76.2,
      },
      primary: "divine",
      secondary: "chaos",
    };
    const result = __testExports.parseXchg(blob);

    expect(result).toEqual(expected);
  });

  it("splitJsonBlob", () => {
    const blobSchema: NinjaSchema = {
      schemaVersion: 1,
      map: [
        {
          ns: "ITEM",
          cx: true,
          url: "my-url",
          type: "Currency",
        },
      ],
    };
    const blob =
      'chaos"},"itemOverviews":[{"type":"Currency","lines":[{"name":"Orb of Alchemy","detailsId":"orb-of-alchemy","id":"alch","primaryValue":0.00003575,"volumePrimaryValue":0.4008,"maxVolumeCurrency":"exalted","maxVolumeRate":12.05,"sparkline":{"totalChange":-40.89,"data":[-9.56,-69.14,-70.07,-20.05,-14.13,18.75,-40.89]}},{"name":"Exalted Orb","detailsId":"exalted-orb","id":"exalted","primaryValue":0.0004308,"volumePrimaryValue":449.7,"maxVolumeCurrency":"divine","maxVolumeRate":2321,"sparkline":{"totalChange":-20.32,"data":[-5.22,-15.82,-13.6,-15.2,-15.99,-21.78,-20.32]}}]}]';

    const result = __testExports.splitJsonBlob(blob, blobSchema);
    expect(result).toHaveLength(1);
  });

  it("reads the price file the price service writes", () => {
    const schema = readSchema();
    const blob = readText(path.join(SERVICE_FIXTURES, "price_file.json"));
    const { findInDatabase, parseXchg, splitJsonBlob } = __testExports;

    expect(parseXchg(blob)).toEqual({
      rates: { exalted: 541.6, chaos: 8.53 },
      primary: "divine",
      secondary: "chaos",
    });
    const database = splitJsonBlob(blob, schema);
    expect(database.map(({ ns, url }) => [ns, url])).toEqual([
      ["ITEM", "currency"],
      ["UNIQUE", "unique-weapons"],
      ["ITEM", "precursor-tablets"],
    ]);
    expect(
      findInDatabase(database, { ns: "ITEM", name: "Exalted Orb" })?.info
        .primaryValue,
    ).toBe(0.001846);
    expect(
      findInDatabase(database, {
        ns: "UNIQUE",
        name: "Redbeak",
        variant: "Shortsword",
      })?.info.detailsId,
    ).toBe("redbeak-shortsword");
    expect(
      findInDatabase(database, {
        ns: "ITEM",
        name: "Ritual Tablet",
        variant: "Magic",
      })?.info.primaryValue,
    ).toBe(0.193);
    expect(
      findInDatabase(database, { ns: "UNIQUE", name: "Exalted Orb" }),
    ).toBeNull();
  });

  it("throws on a file without rates", () => {
    const blob = readText(path.join(SERVICE_FIXTURES, "price_file.json"));

    expect(() =>
      __testExports.parseXchg(blob.replace('{"rates":', '{"values":')),
    ).toThrow(SyntaxError);
  });

  it("reads no overview with a namespace map of another schema version and warns", () => {
    const blob = readText(path.join(SERVICE_FIXTURES, "price_file.json"));
    const warnings: unknown[][] = [];
    vi.spyOn(console, "warn").mockImplementation((...args: unknown[]) => {
      warnings.push(args);
    });

    const schema = readSchema((text) =>
      text.replace('"schemaVersion": 1', '"schemaVersion": 2'),
    );

    expect(schema.schemaVersion).toBe(2);
    expect(__testExports.splitJsonBlob(blob, schema)).toEqual([]);
    expect(warnings).toEqual([["Unsupported ninja schema version", 2]]);
  });

  it("leaves out an overview whose type the namespace map does not list", () => {
    const blob = readText(path.join(SERVICE_FIXTURES, "price_file.json"));
    const renamed = blob.replace(
      '{"type":"UniqueWeapons"',
      '{"type":"UniqueSwords"',
    );
    const database = __testExports.splitJsonBlob(renamed, readSchema());

    expect(database.map(({ url }) => url)).toEqual([
      "currency",
      "precursor-tablets",
    ]);
    expect(
      __testExports.findInDatabase(database, {
        ns: "UNIQUE",
        name: "Redbeak",
        variant: "Shortsword",
      }),
    ).toBeNull();
  });

  it("names league files the way the price service does", () => {
    const cases: Record<string, string> = JSON.parse(
      readText(path.join(SERVICE_FIXTURES, "league_files.json")),
    );
    for (const [leagueId, fileName] of Object.entries(cases)) {
      expect(leagueFileName(leagueId)).toBe(fileName);
    }
  });
});
