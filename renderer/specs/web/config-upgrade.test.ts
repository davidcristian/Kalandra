import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import fs from "fs";
import path from "path";
import type { Config } from "@/web/Config";
import type { Widget } from "@/web/overlay/widgets";
import { Host } from "@/web/background/IPC";
import { registry } from "@/web/overlay/widget-registry";
import type { StashSearchWidget } from "@/web/stash-search/widget";

// PriceTrend.vue imports vue3-apexcharts, which reads window when it loads; no test draws a chart
vi.mock("vue3-apexcharts", () => ({ default: {} }));

type ConfigModule = typeof import("@/web/Config");

const actual = await vi.importActual<ConfigModule>("@/web/Config");
const CURRENT = actual.defaultConfig().configVersion;

// Each file is a new install's config of that version with the choices in USER_CHOICES:
// 2 is Awakened PoE Trade in June 2020, the oldest version the steps accept; 16 is its last
// release, which Exiled Exchange 2 saved until v0.2.0; 25 has the filter generator; 28 is
// before the XP tracker and the library; 32 is before the library profile; 36 is before the
// map check marks by ref.
const VERSIONS = [2, 16, 25, 28, 32, 36];

const SINGLE_WIDGETS = registry.widgets
  .filter((component) => component.widget.instances === "single")
  .map((component) => component.widget.type);

const USER_CHOICES = {
  leagueId: "Standard",
  overlayKey: "Alt + Space",
  exitHotkey: "F10",
  priceCheckHotkey: "E",
  mapRollingAnchor: { pos: "tl", x: 61.5, y: 30.25 },
};

function readSaved(version: number): Config {
  const file = path.resolve(
    __dirname,
    `../saved-configs/version-${version}.json`,
  );
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

/** Returns the config as the app keeps it: a JSON copy, which drops each undefined value. */
function asSaved(config: Config): Config {
  return JSON.parse(JSON.stringify(config));
}

function upgrade(config: Config): Config {
  return asSaved(actual.upgradeConfig(config));
}

/** Runs the steps below version `until` and returns the version each step wrote, in order. */
function runSteps(config: Config, until = Number.POSITIVE_INFINITY): number[] {
  const written: number[] = [];
  let stored = config.configVersion;
  // Each step first compares configVersion, so reading Infinity skips every later step
  Object.defineProperty(config, "configVersion", {
    configurable: true,
    enumerable: true,
    get: () => (stored >= until ? Number.POSITIVE_INFINITY : stored),
    set: (value: number) => {
      written.push(value);
      stored = value;
    },
  });
  actual.upgradeConfig(config);
  Object.defineProperty(config, "configVersion", {
    configurable: true,
    enumerable: true,
    writable: true,
    value: stored,
  });
  return written;
}

// Every version from 3 to the current one has a step except 20 and 33: the < 21 step
// follows the < 19 step, and the < 33 step writes 34
function stepVersions(after: number): number[] {
  const versions: number[] = [];
  for (let version = after + 1; version <= CURRENT; version++) {
    if (version !== 20 && version !== 33) versions.push(version);
  }
  return versions;
}

function kind(value: unknown): string {
  if (value === null) return "null";
  return Array.isArray(value) ? "array" : typeof value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return kind(value) === "object";
}

function field(value: unknown, key: string): unknown {
  return isRecord(value) ? value[key] : undefined;
}

/** Returns the path of each key of `defaults` that `saved` lacks or holds another kind of value under. */
function shapeDifferences(
  saved: unknown,
  defaults: unknown,
  at = "",
): string[] {
  if (!isRecord(saved) || !isRecord(defaults)) return [];
  return Object.entries(defaults).flatMap(([key, value]) => {
    const where = at ? `${at}.${key}` : key;
    const savedValue = saved[key];
    if (savedValue === undefined) return [where];
    // A default null is an unset hotkey or path, and a saved null is one the user cleared
    if (value === null || savedValue === null) return [];
    if (kind(savedValue) !== kind(value)) {
      return [`${where} is ${kind(savedValue)}`];
    }
    // A list holds the user's own entries, of which the defaults are only examples
    if (Array.isArray(value)) return [];
    return shapeDifferences(savedValue, value, where);
  });
}

/** Compares each default widget with the first saved widget of its type, which AppConfig(type) reads. */
function configShapeDifferences(saved: Config, defaults: Config): string[] {
  const { widgets, ...fields } = defaults;
  const widgetDifferences = widgets.flatMap((widget) => {
    const where = `widgets[${widget.wmType}]`;
    const first = saved.widgets.find((w) => w.wmType === widget.wmType);
    return first ? shapeDifferences(first, widget, where) : [where];
  });
  return [
    ...new Set([...shapeDifferences(saved, fields), ...widgetDifferences]),
  ];
}

/** Returns the keys that entered defaultConfig() without a step of their own, which the version 38 step adds. */
function keysWithoutStep(config: Config) {
  const widget = (wmType: string) =>
    config.widgets.find((w) => w.wmType === wmType);
  return {
    language: config.language,
    restoreClipboard: config.restoreClipboard,
    clientLog: config.clientLog,
    gameConfig: config.gameConfig,
    craftOfExileKey: field(widget("item-check"), "craftOfExileKey"),
    toggleKey: field(widget("delve-grid"), "toggleKey"),
    ocrGemsKey: field(widget("item-search"), "ocrGemsKey"),
  };
}

function userChoices(config: Config) {
  const priceCheck = config.widgets.find((w) => w.wmType === "price-check");
  const mapRolling = config.widgets.find((w) => w.wmTitle === "Map rolling");
  return {
    leagueId: config.leagueId,
    overlayKey: config.overlayKey,
    exitHotkey: config.commands.find((c) => c.text === "/exit")?.hotkey,
    priceCheckHotkey: field(priceCheck, "hotkey"),
    mapRollingAnchor: field(mapRolling, "anchor"),
  };
}

/** Returns a copy with every boolean, number, string and null changed, except the keys that identify. */
function changeEverySetting(value: unknown, key = ""): unknown {
  if (key === "wmType" || key === "configVersion") return value;
  if (Array.isArray(value)) {
    return value.map((item) => changeEverySetting(item));
  }
  if (isRecord(value)) {
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [k, changeEverySetting(v, k)]),
    );
  }
  if (typeof value === "boolean") return !value;
  if (typeof value === "number") return value + 1;
  if (typeof value === "string") return `${value} (changed)`;
  return value === null ? "changed" : value;
}

describe("upgradeConfig", () => {
  it.each(VERSIONS)(
    "upgrades a version %i config to the current version with every key of defaultConfig()",
    (version) => {
      const upgraded = upgrade(readSaved(version));

      expect(upgraded.configVersion).toBe(CURRENT);
      expect(configShapeDifferences(upgraded, actual.defaultConfig())).toEqual(
        [],
      );
    },
  );

  // Awakened PoE Trade added the first four keys and two hotkeys without a new version, and
  // a new install of versions 15 to 21 has no ocrGemsKey
  it.each([2, 16])(
    "sets each key that entered the defaults without a step to its default in a version %i config",
    (version) => {
      const upgraded = upgrade(readSaved(version));

      expect(keysWithoutStep(upgraded)).toStrictEqual(
        keysWithoutStep(actual.defaultConfig()),
      );
    },
  );

  it("keeps the saved value of each key the version 38 step sets", () => {
    const changed = asSaved(
      changeEverySetting(asSaved(actual.defaultConfig())) as Config,
    );
    const config = asSaved(changed);
    config.configVersion = 37;

    expect(upgrade(config)).toEqual(changed);
  });

  it("names the default stash searches of a version 36 config by preset and keeps their text", () => {
    const upgraded = upgrade(readSaved(36));
    const entriesOf = (config: Config, title: string) =>
      (config.widgets.find((w) => w.wmTitle === title) as StashSearchWidget)
        .entries;
    const entries = (title: string) => entriesOf(upgraded, title);

    expect(entries("Dump sorting").map((e) => e.preset ?? null)).toEqual([
      "currency",
      "martial-weapon",
      null,
      "waystone-tier",
      "normal-rarity",
      "trial-count",
    ]);
    expect(entries("Dump sorting").map((e) => e.text)).toEqual(
      entriesOf(readSaved(36), "Dump sorting").map((e) => e.text),
    );
    expect(entries("Map rolling").map((e) => e.preset ?? null)).toEqual([
      null,
      null,
      null,
      null,
    ]);
  });

  it("names the Martial Weapon and Waystone Tier searches only in the < 40 step", () => {
    const config = readSaved(36);
    const presets = (saved: Config) =>
      (
        saved.widgets.find(
          (w) => w.wmTitle === "Dump sorting",
        ) as StashSearchWidget
      ).entries.map((e) => e.preset ?? null);

    runSteps(config, 39);

    expect(config.configVersion).toBe(39);
    expect(presets(config)).toEqual([
      "currency",
      null,
      null,
      null,
      "normal-rarity",
      "trial-count",
    ]);
    expect(presets(upgrade(config))).toEqual([
      "currency",
      "martial-weapon",
      null,
      "waystone-tier",
      "normal-rarity",
      "trial-count",
    ]);
  });

  it.each(VERSIONS)(
    "keeps the league, hotkeys and widget position the user chose in a version %i config",
    (version) => {
      expect(userChoices(upgrade(readSaved(version)))).toEqual(USER_CHOICES);
    },
  );

  it("checks user choices that each differ from the default", () => {
    const defaults = userChoices(actual.defaultConfig());
    const keys = Object.keys(USER_CHOICES) as Array<keyof typeof USER_CHOICES>;
    const same = keys.filter(
      (key) =>
        JSON.stringify(defaults[key]) === JSON.stringify(USER_CHOICES[key]),
    );

    expect(same).toEqual([]);
  });

  it.each(VERSIONS)(
    "runs each step above version %i once, in order",
    (version) => {
      expect(runSteps(readSaved(version))).toEqual(stepVersions(version));
    },
  );

  it.each(VERSIONS)(
    "gives a version %i config the same result when each version in between saved it",
    (version) => {
      let saved = readSaved(version);
      for (let release = version + 1; release <= CURRENT; release++) {
        runSteps(saved, release);
        saved = asSaved(saved);
      }

      expect(saved).toEqual(upgrade(readSaved(version)));
    },
  );

  it("leaves a config at the current version unchanged, with every setting changed from its default", () => {
    const changed = changeEverySetting(asSaved(actual.defaultConfig()));
    const config = asSaved(changed as Config);

    expect(upgrade(config)).toEqual(changed);
  });

  it.each(VERSIONS)(
    "leaves an upgraded version %i config unchanged when it upgrades it again",
    (version) => {
      const once = upgrade(readSaved(version));

      expect(upgrade(asSaved(once))).toEqual(once);
    },
  );

  it.each(VERSIONS)(
    "keeps a widget of a type the app does not know in a version %i config",
    (version) => {
      const lootTracker: Widget = {
        wmId: 900,
        wmType: "loot-tracker",
        wmTitle: "Loot",
        wmWants: "hide",
        wmZorder: null,
        wmFlags: ["invisible-on-blur"],
      };
      const config = readSaved(version);
      config.widgets.push({ ...lootTracker });

      const upgraded = upgrade(config);

      expect(
        upgraded.widgets.filter((w) => w.wmType === "loot-tracker"),
      ).toEqual([lootTracker]);
    },
  );

  it("removes the filter generator widget, which the app no longer has, from a version 25 config", () => {
    const upgraded = upgrade(readSaved(25));

    expect(upgraded.widgets.map((w) => w.wmType)).not.toContain(
      "filter-generator",
    );
  });
});

/** Runs the real initConfig() on `config` as the saved file, and returns the config it loads and the lines it logs. */
async function load(config: Config) {
  const warnings: string[] = [];
  const warn = vi
    .spyOn(console, "warn")
    .mockImplementation((...args: unknown[]) => {
      warnings.push(args.join(" "));
    });
  vi.mocked(Host.getConfig).mockResolvedValueOnce(JSON.stringify(config));
  try {
    await actual.initConfig();
  } finally {
    warn.mockRestore();
  }
  return { loaded: asSaved(actual.AppConfig()), warnings };
}

/** Returns each single instance widget type that `config` does not have exactly once. */
function singleWidgetsNotOnce(config: Config): string[] {
  return SINGLE_WIDGETS.filter(
    (type) => config.widgets.filter((w) => w.wmType === type).length !== 1,
  );
}

describe("initConfig", () => {
  beforeAll(() => {
    vi.stubGlobal("document", { documentElement: { style: {} } });
  });

  afterAll(() => {
    vi.unstubAllGlobals();
  });

  it.each(VERSIONS)(
    "loads a version %i config as upgradeConfig() returns it, without a log line",
    async (version) => {
      const { loaded, warnings } = await load(readSaved(version));

      expect(loaded).toEqual(upgrade(readSaved(version)));
      expect(warnings).toEqual([]);
    },
  );

  // The < 4 step, most later ones and the code that runs on every load read the price check
  it.each([...VERSIONS, CURRENT])(
    "adds the default price check widget to a version %i config without one, and logs it",
    async (version) => {
      const config =
        version === CURRENT
          ? asSaved(actual.defaultConfig())
          : readSaved(version);
      config.widgets = config.widgets.filter((w) => w.wmType !== "price-check");

      const { loaded, warnings } = await load(config);

      expect(warnings).toEqual([
        "[config] Added the default widgets that the saved config lacks: price-check",
      ]);
      expect(singleWidgetsNotOnce(loaded)).toEqual([]);
      expect(configShapeDifferences(loaded, actual.defaultConfig())).toEqual(
        [],
      );
    },
  );

  it.each(SINGLE_WIDGETS)(
    "adds the default %s widget with a new wmId to a current config without one",
    async (wmType) => {
      const defaults = asSaved(actual.defaultConfig());
      const config = asSaved(defaults);
      config.widgets = config.widgets.filter((w) => w.wmType !== wmType);
      const wmId = Math.max(...config.widgets.map((w) => w.wmId)) + 1;

      const { loaded } = await load(config);

      expect(loaded.widgets.filter((w) => w.wmType === wmType)).toEqual([
        { ...defaults.widgets.find((w) => w.wmType === wmType), wmId },
      ]);
    },
  );

  // defaultConfig() has no map check widget, which the steps below version 7 read
  it("still stops at a version 2 config without a map check widget", async () => {
    const config = readSaved(2);
    config.widgets = config.widgets.filter((w) => w.wmType !== "map-check");

    await expect(load(config)).rejects.toThrow(TypeError);
  });
});
