import { describe, expect, it } from "vitest";
import { repairSavedConfig, SavedConfig } from "@/web/config-repair";

type SavedWidget = SavedConfig["widgets"][number];

function widget(
  wmId: number,
  wmType: string,
  settings: Record<string, unknown> = {},
): SavedWidget {
  return {
    wmId,
    wmType,
    wmTitle: "",
    wmWants: "hide",
    wmZorder: null,
    wmFlags: [],
    ...settings,
  };
}

function library(wmId: number, logItemKey: string | null): SavedWidget {
  return widget(wmId, "library", {
    wmFlags: ["invisible-on-blur", "menu::skip"],
    logItemKey,
    libraryOutputPath: null,
    selectedProfile: "chaos",
  });
}

function ids(config: SavedConfig): unknown[] {
  return config.widgets.map((w) => w.wmId);
}

// The widgets of a new install from version 30 to 40, in the order of widget-registry.ts
function newInstallWidgets(): SavedWidget[] {
  return [
    widget(1, "menu"),
    widget(2, "settings"),
    widget(3, "item-search"),
    widget(4, "experience-tracker"),
    widget(5, "stash-search"),
    widget(6, "stash-search"),
    widget(7, "price-check"),
    widget(8, "item-check"),
    widget(9, "image-strip"),
    widget(10, "delve-grid"),
    library(11, null),
  ];
}

// A v0.14.0 install saved version 29; its version 30 step then put a second library at index 3
function freshV014Config(): SavedConfig {
  const widgets = newInstallWidgets();
  widgets.splice(3, 0, library(12, "Ctrl + L"));
  return { overlayAlwaysClose: false, widgets };
}

// An Awakened PoE Trade config from before version 12: item search has wmId 10 at index 7,
// so the version 29 and 30 steps appended their widgets after the stash search with wmId 9
function awakenedPoeTradeConfig(): SavedConfig {
  return {
    widgets: [
      widget(8, "settings"),
      widget(1, "menu"),
      widget(2, "price-check"),
      widget(3, "item-check"),
      widget(5, "stash-search"),
      widget(6, "image-strip"),
      widget(7, "delve-grid"),
      widget(10, "item-search"),
      widget(9, "stash-search"),
      widget(11, "experience-tracker"),
      library(12, null),
    ],
  };
}

// A config from versions 12 to 28, where both steps inserted their widget right after item search
function upgradedConfig(): SavedConfig {
  return {
    overlayAlwaysClose: true,
    widgets: [
      widget(2, "settings"),
      widget(1, "menu"),
      widget(3, "item-search"),
      library(12, null),
      widget(11, "experience-tracker"),
      widget(4, "stash-search"),
      widget(5, "price-check"),
    ],
  };
}

describe("repairSavedConfig", () => {
  it("removes the second library widget of a v0.14.0 install and keeps the first, which holds the user's settings", () => {
    const config = freshV014Config();

    repairSavedConfig(config);

    const libraries = config.widgets.filter((w) => w.wmType === "library");
    expect(libraries).toEqual([library(12, "Ctrl + L")]);
    expect(ids(config)).toEqual([1, 2, 3, 12, 4, 5, 6, 7, 8, 9, 10]);
  });

  it("moves the library and the XP tracker to right after item search when the old steps put them elsewhere", () => {
    const config = awakenedPoeTradeConfig();

    repairSavedConfig(config);

    expect(ids(config)).toEqual([8, 1, 2, 3, 5, 6, 7, 10, 12, 11, 9]);
  });

  it("sets overlayAlwaysClose to false when a config from Awakened PoE Trade lacks it", () => {
    const config = awakenedPoeTradeConfig();

    repairSavedConfig(config);

    expect(config.overlayAlwaysClose).toBe(false);
  });

  it("keeps an overlayAlwaysClose the user turned on", () => {
    const config = upgradedConfig();

    repairSavedConfig(config);

    expect(config.overlayAlwaysClose).toBe(true);
  });

  it.each([
    [
      "a new install's config",
      () => ({ overlayAlwaysClose: false, widgets: newInstallWidgets() }),
    ],
    ["a config from versions 12 to 28", upgradedConfig],
    [
      "a repaired config",
      () => {
        const config = freshV014Config();
        repairSavedConfig(config);
        return config;
      },
    ],
  ])("leaves %s unchanged", (_name, makeConfig: () => SavedConfig) => {
    const config = makeConfig();

    repairSavedConfig(config);

    expect(config).toEqual(makeConfig());
  });

  it("leaves the widget order as it is when the config has no item search widget", () => {
    const widgets = newInstallWidgets().filter(
      (w) => w.wmType !== "item-search",
    );
    const config = { overlayAlwaysClose: false, widgets };

    repairSavedConfig(config);

    expect(ids(config)).toEqual([1, 2, 4, 5, 6, 7, 8, 9, 10, 11]);
  });
});
