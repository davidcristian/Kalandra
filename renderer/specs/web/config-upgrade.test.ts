import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import fs from "fs";
import path from "path";
import type { Config } from "@/web/Config";
import type {
  ImageStripWidget,
  PriceCheckWidget,
  Widget,
} from "@/web/overlay/widgets";
import { Host } from "@/web/background/IPC";
import { registry } from "@/web/overlay/widget-registry";
import type { StashSearchWidget } from "@/web/stash-search/widget";
import type { ColumnOpts, LibraryWidget } from "@/web/library/widget";
import type { LibraryWidgetWithModOptions } from "@/web/library/saved-mod-options";
import type { StashPricesWidget } from "@/web/stash-prices/widget";

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
    ocrGemsKey: field(widget("item-search"), "ocrGemsKey"),
  };
}

const IRON = "Greater Iron Rune";
const STORM = "Greater Storm Rune";

function priceCheckOf(config: Config): PriceCheckWidget {
  return config.widgets.find(
    (w) => w.wmType === "price-check",
  ) as PriceCheckWidget;
}

function libraryOf(config: Config): LibraryWidget {
  return config.widgets.find((w) => w.wmType === "library") as LibraryWidget;
}

function stashPricesOf(config: Config): StashPricesWidget {
  return config.widgets.find(
    (w) => w.wmType === "stash-prices",
  ) as StashPricesWidget;
}

const MOD_OPTIONS = {
  name: true,
  tier: true,
  roll: true,
  ref: true,
  type: true,
  generation: true,
};

const SYNDICATE_SHEET = { id: 1, url: "syndicate.jpg" };
const OWN_IMAGE = { id: 2, url: "5d41402abc4b2a76b9719d911017c592.png" };

function imageStrip(
  wmTitle: string,
  images: ImageStripWidget["images"],
): ImageStripWidget {
  return {
    wmId: 900,
    wmType: "image-strip",
    wmTitle,
    wmWants: "hide",
    wmZorder: null,
    wmFlags: ["invisible-on-blur"],
    anchor: { pos: "tc", x: 40, y: 8 },
    images: [...images],
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

  // Awakened PoE Trade added the first four keys and craftOfExileKey without a new version,
  // and a new install of versions 15 to 21 has no ocrGemsKey
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

  it.each(VERSIONS)(
    "removes the Delve grid and the default Cheat sheets strip from a version %i config",
    (version) => {
      const types = upgrade(readSaved(version)).widgets.map((w) => w.wmType);

      expect(types).not.toContain("delve-grid");
      expect(types).not.toContain("image-strip");
    },
  );

  it("removes the Delve grid and the syndicate sheet only in the < 41 step", () => {
    const config = readSaved(36);

    const types = (saved: Config) => saved.widgets.map((w) => w.wmType);

    runSteps(config, 40);

    expect(config.configVersion).toBe(40);
    expect(types(config)).toContain("delve-grid");
    expect(types(config)).toContain("image-strip");
    runSteps(config, 41);
    expect(config.configVersion).toBe(41);
    expect(types(config)).not.toContain("delve-grid");
    expect(types(config)).not.toContain("image-strip");
  });

  it("removes a Delve grid whose hotkey the user set from a version 40 config", () => {
    const delveGrid = {
      wmId: 900,
      wmType: "delve-grid",
      wmTitle: "",
      wmWants: "show" as const,
      wmZorder: null,
      wmFlags: ["hide-on-focus", "menu::skip"],
      toggleKey: "Alt + G",
    };
    const config = asSaved(actual.defaultConfig());
    config.configVersion = 40;
    config.widgets.push(delveGrid);

    const upgraded = upgrade(config);

    expect(upgraded.widgets).toEqual(actual.defaultConfig().widgets);
  });

  it.each([
    [
      "the default strip",
      "Cheat sheets",
      [SYNDICATE_SHEET, OWN_IMAGE],
      [OWN_IMAGE],
    ],
    [
      "a strip added from the menu",
      "",
      [OWN_IMAGE, SYNDICATE_SHEET],
      [OWN_IMAGE],
    ],
    ["a strip the user named", "Bosses", [SYNDICATE_SHEET], []],
    ["a strip the user emptied", "Cheat sheets", [], []],
  ])(
    "keeps %s and its own images, without the syndicate sheet",
    (_, wmTitle, images, kept) => {
      const config = readSaved(36);
      config.widgets.push(imageStrip(wmTitle, images));

      const upgraded = upgrade(config);

      expect(upgraded.widgets.filter((w) => w.wmId === 900)).toEqual([
        imageStrip(wmTitle, kept),
      ]);
    },
  );

  it.each([
    ["the default strip", "Cheat sheets"],
    ["a strip added from the menu", ""],
  ])("removes %s when the syndicate sheet is its only image", (_, wmTitle) => {
    const config = readSaved(36);
    config.widgets.push(imageStrip(wmTitle, [SYNDICATE_SHEET]));

    const upgraded = upgrade(config);

    expect(upgraded.widgets.filter((w) => w.wmId === 900)).toEqual([]);
  });

  it.each([
    [
      "moves the set saved for martial weapons to martialWeapon",
      { Bow: [IRON], maritalWeapon: [IRON, null] },
      { Bow: [IRON], martialWeapon: [IRON, null] },
    ],
    ["moves a cleared set", { maritalWeapon: [] }, { martialWeapon: [] }],
    [
      "keeps a martialWeapon set, which the price check already applies",
      { maritalWeapon: [IRON], martialWeapon: [STORM] },
      { martialWeapon: [STORM] },
    ],
    [
      "leaves saved augments without a martial weapon set",
      { all: [IRON] },
      { all: [IRON] },
    ],
  ])("%s in a version 41 config", (_, saved, upgraded) => {
    const config = asSaved(actual.defaultConfig());
    config.configVersion = 41;
    priceCheckOf(config).savedAugments = saved;

    expect(priceCheckOf(upgrade(config)).savedAugments).toEqual(upgraded);
  });

  it("moves the martial weapon set of every price check widget and skips one without saved augments", () => {
    const config = asSaved(actual.defaultConfig());
    config.configVersion = 41;
    const priceCheck = priceCheckOf(config);
    priceCheck.savedAugments = { maritalWeapon: [IRON] };
    const second = {
      ...priceCheck,
      wmId: 900,
      savedAugments: { maritalWeapon: [STORM] },
    };
    const withoutSets = { ...priceCheck, wmId: 901, savedAugments: null };
    config.widgets.push(second, withoutSets);

    const upgraded = upgrade(config);

    expect(
      upgraded.widgets
        .filter((w) => w.wmType === "price-check")
        .map((w) => field(w, "savedAugments")),
    ).toEqual([{ martialWeapon: [IRON] }, { martialWeapon: [STORM] }, null]);
  });

  it("removes modOpts from each profile of every library widget in a version 42 config and keeps the other fields", () => {
    const expected = asSaved(actual.defaultConfig());
    const library = libraryOf(expected);
    const own: ColumnOpts = {
      refName: true,
      itemLevel: true,
      rarity: true,
      sockets: true,
      mods: true,
      addedMods: false,
      removedMods: true,
      keep: { explicit: true, implicit: true, enchant: false, augment: true },
    };
    library.profiles.own = own;
    library.selectedProfile = "own";
    const second: LibraryWidget = { ...library, wmId: 900, profiles: { own } };
    expected.widgets.push(second);
    const config = asSaved(expected);
    config.configVersion = 42;
    for (const widget of config.widgets) {
      if (widget.wmType !== "library") continue;
      for (const profile of Object.values((widget as LibraryWidget).profiles)) {
        Object.assign(profile, { modOpts: { ...MOD_OPTIONS, tier: false } });
      }
    }

    expect(upgrade(config)).toEqual(expected);
  });

  it("turns on the suggested price of every price check widget in a version 43 config", () => {
    const expected = asSaved(actual.defaultConfig());
    expected.widgets.push({ ...priceCheckOf(expected), wmId: 900 });
    const config = asSaved(expected);
    config.configVersion = 43;
    for (const widget of config.widgets) {
      if (widget.wmType !== "price-check") continue;
      delete (widget as Partial<PriceCheckWidget>).suggestedPrice;
    }

    expect(upgrade(config)).toEqual(expected);
  });

  it("adds the stash prices widget, off and out of the menu, with the next free wmId to a version 44 config", () => {
    const expected = asSaved(actual.defaultConfig());
    const stashPrices = stashPricesOf(expected);
    const notepad: Widget = {
      wmId: 900,
      wmType: "notepad",
      wmTitle: "",
      wmWants: "hide",
      wmZorder: null,
      wmFlags: [],
    };
    expected.widgets = [
      ...expected.widgets.filter((w) => w !== stashPrices),
      notepad,
    ];
    const config = asSaved(expected);
    config.configVersion = 44;
    expected.widgets.push({ ...stashPrices, wmId: 901 });

    expect(upgrade(config)).toEqual(expected);
    expect(stashPrices).toMatchObject({
      enabled: false,
      wmFlags: ["invisible-on-blur", "menu::skip"],
    });
  });

  it("keeps the stash prices widget of a version 44 config and adds no second one", () => {
    const expected = asSaved(actual.defaultConfig());
    Object.assign(stashPricesOf(expected), {
      enabled: true,
      tabName: "dump",
      wmFlags: ["invisible-on-blur"],
    });
    const config = asSaved(expected);
    config.configVersion = 44;

    expect(upgrade(config)).toEqual(expected);
  });

  it.each([
    [
      "without a library widget",
      (config: Config) => {
        config.widgets = config.widgets.filter((w) => w.wmType !== "library");
      },
    ],
    [
      "with modOpts in a profile of a widget of another type",
      (config: Config) => {
        const other: Widget & { profiles: unknown } = {
          wmId: 900,
          wmType: "loot-tracker",
          wmTitle: "",
          wmWants: "hide",
          wmZorder: null,
          wmFlags: [],
          profiles: { chaos: { modOpts: MOD_OPTIONS } },
        };
        config.widgets.push(other);
      },
    ],
    [
      "whose library widget has no profiles",
      (config: Config) => {
        Reflect.deleteProperty(libraryOf(config), "profiles");
      },
    ],
    [
      "whose library profiles are not objects",
      (config: Config) => {
        Object.assign(libraryOf(config), {
          profiles: { chaos: null, own: "text" },
        });
      },
    ],
  ])(
    "passes a version 42 config %s through unchanged but for its version",
    (_, change) => {
      const expected = asSaved(actual.defaultConfig());
      change(expected);
      const config = asSaved(expected);
      config.configVersion = 42;

      expect(upgrade(config)).toEqual(expected);
    },
  );

  it.each([28, 32])(
    "sets generation in the < 33 step of a version %i config, and the < 43 step removes modOpts",
    (version) => {
      const config = readSaved(version);
      const chaos = (saved: Config) =>
        (libraryOf(saved) as LibraryWidgetWithModOptions).profiles.chaos;

      runSteps(config, 42);

      expect(config.configVersion).toBe(42);
      expect(chaos(config)?.modOpts).toEqual(MOD_OPTIONS);
      expect(chaos(upgrade(config))).toEqual(
        libraryOf(actual.defaultConfig()).profiles.chaos,
      );
    },
  );

  it("removes the filter generator widget, which the app no longer has, from a version 25 config", () => {
    const upgraded = upgrade(readSaved(25));

    expect(upgraded.widgets.map((w) => w.wmType)).not.toContain(
      "filter-generator",
    );
  });
});

/** Runs the real initConfig() on `config` as the saved file, and returns the config it loads, the lines it logs and the lines it sends to main's log. */
async function load(config: Config) {
  const warnings: string[] = [];
  const mainLog: string[] = [];
  const warn = vi
    .spyOn(console, "warn")
    .mockImplementation((...args: unknown[]) => {
      warnings.push(args.join(" "));
    });
  vi.mocked(Host.sendEvent).mockImplementation((event) => {
    if (event.name === "CLIENT->MAIN::log-entry") {
      mainLog.push(`${event.payload.level} ${event.payload.message}`);
    }
  });
  vi.mocked(Host.getConfig).mockResolvedValueOnce(JSON.stringify(config));
  try {
    await actual.initConfig();
  } finally {
    warn.mockRestore();
    vi.mocked(Host.sendEvent).mockReset();
  }
  return { loaded: asSaved(actual.AppConfig()), warnings, mainLog };
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

  it.each([...VERSIONS, CURRENT])(
    "sends no line to main's log for a version %i config, which is not newer than the app",
    async (version) => {
      const config =
        version === CURRENT
          ? asSaved(actual.defaultConfig())
          : readSaved(version);

      const { mainLog } = await load(config);

      expect(mainLog).toEqual([]);
    },
  );

  it("adds the library widget with the modOpts the < 33 step sets to a version 32 config without one", async () => {
    const config = readSaved(32);
    config.widgets = config.widgets.filter((w) => w.wmType !== "library");

    const { loaded, warnings } = await load(config);

    expect(warnings).toEqual([
      "[config] Added the default widgets that the saved config lacks: library",
    ]);
    expect(libraryOf(loaded)).toEqual({
      ...libraryOf(actual.defaultConfig()),
      wmId: libraryOf(loaded).wmId,
    });
  });

  it("uses a config from a newer version as it is, and warns in main's log with both versions", async () => {
    const config = asSaved(actual.defaultConfig());
    config.configVersion = CURRENT + 1;
    config.overlayKey = "Alt + Space";
    priceCheckOf(config).rememberCurrency = true;
    Object.assign(config, { settingOfANewerVersion: { enabled: true } });
    config.widgets.push({
      wmId: 900,
      wmType: "widget-of-a-newer-version",
      wmTitle: "",
      wmWants: "hide",
      wmZorder: null,
      wmFlags: [],
    });

    const { loaded, warnings, mainLog } = await load(asSaved(config));

    expect(loaded).toEqual(config);
    expect(warnings).toEqual([]);
    expect(mainLog).toEqual([
      `warn config.json is from a newer version of Kalandra: its config version is ${CURRENT + 1}, above this version's ${CURRENT}. Kalandra uses it as it is and runs no upgrade step.`,
    ]);
  });

  // defaultConfig() has no map check widget, which the steps below version 7 read
  it("still stops at a version 2 config without a map check widget", async () => {
    const config = readSaved(2);
    config.widgets = config.widgets.filter((w) => w.wmType !== "map-check");

    await expect(load(config)).rejects.toThrow(TypeError);
  });

  // defaultConfig() has no Delve grid widget, which the < 16 step reads
  it("still stops at a version 15 config without a Delve grid widget", async () => {
    const config = readSaved(16);
    config.configVersion = 15;
    config.widgets = config.widgets.filter((w) => w.wmType !== "delve-grid");

    await expect(load(config)).rejects.toThrow(TypeError);
  });
});
