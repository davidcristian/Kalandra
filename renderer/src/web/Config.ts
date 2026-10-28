import { reactive as deepReactive, shallowRef, toRaw } from "vue";
import isDeepEqual from "fast-deep-equal";
import { Host } from "@/web/background/IPC";
import { HostConfig } from "@ipc/types";
import type * as widget from "./overlay/widgets";
import type { StashSearchWidget } from "./stash-search/widget";
import type { ItemCheckWidget } from "./item-check/widget";
import type { ItemSearchWidget } from "./item-search/widget";
import { registry as widgetRegistry } from "./overlay/widget-registry.js";
import { LibraryWidget } from "./library/widget";
import * as savedLibrary from "./library/saved-mod-options";
import { addKeysWithoutStep, repairSavedConfig } from "./config-repair";
import { addMissingWidgets, addNewWidget } from "./missing-widgets";
import { warnIfNewerConfig } from "./newer-config";
import * as removed from "./removed-widgets";
import { shortcutActions } from "./shortcut-actions";
import { nameDefaultMarksByRef } from "./map-check/saved-marks";
import { moveMartialWeaponAugments } from "./price-check/saved-augments";
import { ENGLISH_DEFAULTS_40, namePresetEntries } from "./stash-search/presets";
import { DEFAULT_FONT_SIZE, validFontSize } from "./settings/font-size";
import { stashPricesDefault } from "./stash-prices/widget";
import type { StashPricesWidget } from "./stash-prices/widget";
import { tradeHost } from "./trade-host";

const _config = shallowRef<Config | null>(null);
let _lastSavedConfig: Config | null = null;

export function AppConfig(): Config;
export function AppConfig<T extends widget.Widget>(type: string): T | undefined;
export function AppConfig(type?: string) {
  if (!_config.value) throw new Error("The config was read before it loaded");
  if (!type) return _config.value;
  return _config.value.widgets.find((w) => w.wmType === type);
}

export function updateConfig(updates: Config) {
  const config: Config = deepReactive(JSON.parse(JSON.stringify(updates)));
  _config.value = config;
  config.fontSize = validFontSize(config.fontSize);
  document.documentElement.style.fontSize = `${config.fontSize}px`;
}

export function saveConfig() {
  if (!_config.value) return;
  const rawConfig = toRaw(_config.value);
  if (
    rawConfig.widgets.some(
      (w) => w.wmZorder === "exclusive" && w.wmWants === "show",
    )
  ) {
    return;
  }

  if (!isDeepEqual(rawConfig, _lastSavedConfig)) {
    _lastSavedConfig = JSON.parse(JSON.stringify(rawConfig));
    Host.sendEvent({
      name: "CLIENT->MAIN::save-config",
      payload: { contents: JSON.stringify(AppConfig()) },
    });
  }
}

export function pushHostConfig() {
  Host.sendEvent({
    name: "CLIENT->MAIN::update-host-config",
    payload: getConfigForHost(),
  });
}

export async function initConfig() {
  Host.onEvent("MAIN->CLIENT::config-changed", (e) => {
    _lastSavedConfig = JSON.parse(e.contents);
    updateConfig(JSON.parse(e.contents));
  });

  const contents = await Host.getConfig();
  if (!contents) {
    updateConfig(defaultConfig());
    return;
  }

  // main sends only a JSON object, and moves a file that is not one aside
  const config: Config = JSON.parse(contents);
  warnIfNewerConfig(config.configVersion, defaultConfig().configVersion);
  addMissingWidgets(config, defaultConfig().widgets);
  updateConfig(upgradeConfig(config));
}

export function poeWebApi() {
  const { realm, preferredTradeSite, language } = AppConfig();
  if (preferredTradeSite === "www") {
    return "www.pathofexile.com";
  }
  return tradeHost(language, realm);
}

export enum TipsFrequency {
  Always = 1,
  MoreOften = 2,
  Normal = 3,
  Rarely = 4,
  VeryRarely = 5,
  Never = 6,
}

export interface Config {
  configVersion: number;
  leagueId?: string;
  overlayKey: string;
  overlayBackground: string;
  overlayBackgroundClose: boolean;
  hideOverlayOnBlur: boolean;
  restoreClipboard: boolean;
  commands: Array<{
    text: string;
    hotkey: string | null;
    send: boolean;
  }>;
  clientLog: string | null;
  gameConfig: string | null;
  windowTitle: string;
  logKeys: boolean;
  accountName: string;
  stashScroll: boolean;
  language: "en" | "ru" | "cmn-Hant" | "ko" | "ja" | "de" | "es" | "pt" | "fr";
  preferredTradeSite: "default" | "www";
  realm: "pc-ggg" | "pc-garena";
  widgets: widget.Widget[];
  fontSize: number;
  showAttachNotification: boolean;
  overlayAlwaysClose: boolean;
  enableAlphas: boolean;
  alphas: Array<"library">;
  tipsFrequency: TipsFrequency;
  readClientLog: boolean;
}

export const defaultConfig = (): Config => ({
  configVersion: 45,
  overlayKey: "Shift + Space",
  overlayBackground: "rgba(129, 139, 149, 0.15)",
  overlayBackgroundClose: true,
  overlayAlwaysClose: false,
  hideOverlayOnBlur: false,
  restoreClipboard: false,
  showAttachNotification: true,
  commands: [
    {
      text: "/hideout",
      hotkey: "F5",
      send: true,
    },
    {
      text: "/exit",
      hotkey: "F9",
      send: true,
    },
    {
      text: "@last ty",
      hotkey: null,
      send: true,
    },
    {
      text: "/invite @last",
      hotkey: null,
      send: true,
    },
    {
      text: "/tradewith @last",
      hotkey: null,
      send: true,
    },
    {
      text: "/hideout @last",
      hotkey: null,
      send: true,
    },
  ],
  clientLog: null,
  gameConfig: null,
  windowTitle: "Path of Exile 2",
  logKeys: false,
  accountName: "",
  stashScroll: true,
  language: "en",
  preferredTradeSite: "default",
  realm: "pc-ggg",
  fontSize: DEFAULT_FONT_SIZE,
  widgets: widgetRegistry.widgets.reduce<widget.Widget[]>(
    (widgets, { widget }) => {
      const res: widget.Widget[] = [];
      if (widget.instances === "single") {
        res.push(widget.initInstance());
      } else if (
        widget.instances === "multi" &&
        widget.defaultInstances != null
      ) {
        res.push(...widget.defaultInstances());
      }
      for (const config of res) {
        config.wmId = widgets.length + 1;
        widgets.push(config);
      }
      return widgets;
    },
    [],
  ),
  enableAlphas: false,
  alphas: [],
  tipsFrequency: TipsFrequency.Normal,
  readClientLog: false,
});

export function upgradeConfig(_config: Config): Config {
  /* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-non-null-assertion -- the old steps read fields that Config no longer has, and they never change */
  const config = _config as Omit<Config, "widgets"> & {
    widgets: Array<Record<string, any>>;
  };

  if (config.configVersion < 3) {
    config.widgets.push({
      ...removed.cheatSheetsDefault(),
      wmId: Math.max(0, ...config.widgets.map((_) => _.wmId)) + 1,
      wmZorder: null,
    });

    config.widgets.push({
      ...removed.delveGridDefault(),
      wmId: Math.max(0, ...config.widgets.map((_) => _.wmId)) + 1,
      wmZorder: null,
    });

    config.widgets.find((w) => w.wmType === "menu")!.alwaysShow = false;

    config.configVersion = 3;
  }

  if (config.configVersion < 4) {
    config.widgets.find(
      (w) => w.wmType === "price-check",
    )!.chaosPriceThreshold = 0.05;

    const mapCheck = config.widgets.find((w) => w.wmType === "map-check")!;
    (mapCheck as any).selectedStats.forEach((e: any) => {
      e.matcher = e.matchRef;
      e.matchRef = undefined;
    });

    {
      const widgets = config.widgets.filter((w) => w.wmType === "image-strip")!;
      widgets.forEach((imgStrip: any) => {
        imgStrip.images.forEach((e: any, idx: number) => {
          e.id = idx;
        });
      });
    }

    config.configVersion = 4;
  }

  if (config.configVersion < 5) {
    config.commands.forEach((cmd) => {
      cmd.send = true;
    });

    config.configVersion = 5;
  }

  if (config.configVersion < 6) {
    config.widgets.find((w) => w.wmType === "price-check")!.showRateLimitState =
      (config as any).logLevel === "debug";
    config.widgets.find((w) => w.wmType === "price-check")!.apiLatencySeconds =
      2;

    config.configVersion = 6;
  }

  if (config.configVersion < 7) {
    const mapCheck = config.widgets.find((w) => w.wmType === "map-check")!;
    mapCheck.wmType = "item-check";
    mapCheck.maps = { selectedStats: mapCheck.selectedStats };
    mapCheck.selectedStats = undefined;
    (config as any).itemCheckKey = (config as any).mapCheckKey || null;
    (config as any).mapCheckKey = undefined;

    config.configVersion = 7;
  }

  if (config.configVersion < 8) {
    const itemCheck = config.widgets.find((w) => w.wmType === "item-check")!;
    (itemCheck as ItemCheckWidget).maps.showNewStats = false;
    itemCheck.maps.selectedStats = (
      itemCheck as ItemCheckWidget
    ).maps.selectedStats.map((entry) => ({
      matcher: entry.matcher,
      decision: (entry as any).valueDanger
        ? "danger"
        : (entry as any).valueWarning
          ? "warning"
          : (entry as any).valueDesirable
            ? "desirable"
            : "seen",
    }));

    config.configVersion = 8;
  }

  if (config.configVersion < 9) {
    config.widgets.find((w) => w.wmType === "price-check")!.collapseListings =
      "api";

    config.widgets.find((w) => w.wmType === "price-check")!.smartInitialSearch =
      true;
    config.widgets.find(
      (w) => w.wmType === "price-check",
    )!.lockedInitialSearch = true;

    config.widgets.find(
      (w) => w.wmType === "price-check",
    )!.activateStockFilter = false;

    config.configVersion = 9;
  }

  if (config.configVersion < 10) {
    config.widgets.push({
      ...defaultConfig().widgets.find((w) => w.wmType === "settings")!,
      wmId: Math.max(0, ...config.widgets.map((_) => _.wmId)) + 1,
    });

    const priceCheck = config.widgets.find((w) => w.wmType === "price-check")!;
    priceCheck.hotkey = (config as any).priceCheckKey;
    priceCheck.hotkeyHold = (config as any).priceCheckKeyHold;
    priceCheck.hotkeyLocked = (config as any).priceCheckLocked;
    priceCheck.showSeller = (config as any).showSeller;
    priceCheck.searchStatRange = (config as any).searchStatRange;
    priceCheck.showCursor = (config as any).priceCheckShowCursor;

    if (priceCheck.chaosPriceThreshold === 0.05) {
      priceCheck.chaosPriceThreshold = 0;
    }

    config.configVersion = 10;
  }

  if (config.configVersion < 11) {
    config.widgets.find(
      (w) => w.wmType === "price-check",
    )!.requestPricePrediction = false;

    config.configVersion = 11;
  }

  if (config.configVersion < 12) {
    const afterSettings = config.widgets.findIndex(
      (w) => w.wmType === "settings",
    );
    config.widgets.splice(afterSettings + 1, 0, {
      ...defaultConfig().widgets.find((w) => w.wmType === "item-search")!,
      wmWants: "show",
      wmId: Math.max(0, ...config.widgets.map((_) => _.wmId)) + 1,
    });

    config.realm = "pc-ggg";
    if (config.language === ("zh_TW" as string)) {
      config.language = "cmn-Hant";
    }

    config.configVersion = 12;
  }

  if (config.configVersion < 13) {
    config.showAttachNotification = true;

    config.configVersion = 13;
  }

  if (config.configVersion < 14) {
    const imgWidgets = config.widgets.filter(
      (w) => w.wmType === "image-strip",
    ) as widget.ImageStripWidget[];
    imgWidgets.forEach((imgStrip) => {
      imgStrip.images.forEach((e) => {
        e.url = e.url.startsWith("app-file://")
          ? e.url.slice("app-file://".length)
          : e.url;
      });
    });

    const itemCheck = config.widgets.find(
      (w) => w.wmType === "item-check",
    ) as ItemCheckWidget;
    itemCheck.wikiKey = (config as any).wikiKey;
    itemCheck.poedbKey = null;
    itemCheck.craftOfExileKey = (config as any).craftOfExileKey;
    itemCheck.stashSearchKey = null;

    config.configVersion = 14;
  }

  if (config.configVersion < 15) {
    const priceCheck = config.widgets.find(
      (w) => w.wmType === "price-check",
    ) as widget.PriceCheckWidget;
    priceCheck.builtinBrowser = false;

    const itemSearch = config.widgets.find(
      (w) => w.wmType === "item-search",
    ) as ItemSearchWidget;
    itemSearch.ocrGemsKey = null;

    const itemCheck = config.widgets.find(
      (w) => w.wmType === "item-check",
    ) as ItemCheckWidget;
    itemCheck.maps.profile = 1;
    for (const stat of itemCheck.maps.selectedStats) {
      const p1decision =
        stat.decision === "danger"
          ? "d"
          : stat.decision === "warning"
            ? "w"
            : stat.decision === "desirable"
              ? "g"
              : "s";

      stat.decision = `${p1decision}--`;
    }

    config.configVersion = 15;
  }

  if (config.configVersion < 16) {
    const delve = config.widgets.find(
      (w) => w.wmType === "delve-grid",
    ) as removed.DelveGridWidget;
    delve.toggleKey = (config as any).delveGridKey;

    const itemCheck = config.widgets.find(
      (w) => w.wmType === "item-check",
    ) as ItemCheckWidget;
    itemCheck.hotkey = (config as any).itemCheckKey;

    if (itemCheck.maps.profile === undefined) {
      itemCheck.maps.profile = 1;
      itemCheck.maps.selectedStats = [];
    }

    config.configVersion = 16;
  }

  if (config.configVersion < 17) {
    // config.preferredTradeSite = config.language;
    config.configVersion = 17;
  }

  if (config.configVersion < 18) {
    config.enableAlphas = false;
    config.alphas = [];
    config.preferredTradeSite = "default";
    config.configVersion = 18;
  }

  if (config.configVersion < 19) {
    config.widgets.find((w) => w.wmType === "price-check")!.defaultAllSelected =
      false;
    config.configVersion = 19;
  }

  if (config.configVersion < 21) {
    config.widgets.find((w) => w.wmType === "price-check")!.itemHoverTooltip =
      "keybind";

    config.alphas = [];

    config.configVersion = 21;
  }

  const priceCheck = config.widgets.find(
    (w) => w.wmType === "price-check",
  ) as widget.PriceCheckWidget;
  if (priceCheck.rememberCurrency === undefined) {
    priceCheck.rememberCurrency = false;
  }

  for (const widget of config.widgets) {
    if (widget.wmType === "stash-search") {
      (widget as StashSearchWidget).enableHotkeys ??= true;
    }
  }

  if (config.logKeys === undefined) {
    config.logKeys = false;
  }

  if (config.configVersion < 22) {
    // NOTE: v0.7.0
    config.widgets.find(
      (w) => w.wmType === "price-check",
    )!.autoFillEmptyRuneSockets = false;

    config.tipsFrequency = TipsFrequency.Normal;

    config.configVersion = 22;
  }

  if (config.configVersion < 23) {
    for (const widget of config.widgets) {
      for (let i = 0; i < widget.wmFlags.length; ++i) {
        if (widget.wmFlags[i] === "skip-menu") {
          widget.wmFlags[i] = "menu::skip";
        }
      }
      if (widget.wmType === "settings") {
        widget.wmFlags = widget.wmFlags.filter(
          (flag: string) => !flag.startsWith("settings::"),
        );
      }
    }

    const itemSearch = config.widgets.find(
      (w) => w.wmType === "item-search",
    ) as widget.Widget;
    itemSearch.wmTitle = "{icon=fa-search}";
    const settings = config.widgets.find(
      (w) => w.wmType === "settings",
    ) as widget.Widget;
    settings.wmTitle = "{icon=fa-cog}";

    // make sure icon for settings comes first in the widget menu
    config.widgets.sort((a, b) => {
      if (a.wmType === "settings") return -1;
      if (b.wmType === "settings") return 1;
      return 0;
    });

    config.configVersion = 23;
  }
  if (config.configVersion < 24) {
    // NOTE: v0.8.0
    config.widgets.find((w) => w.wmType === "price-check")!.alwaysShowTier =
      false;

    config.configVersion = 24;
  }
  if (config.configVersion < 25) {
    // NOTE: v0.9.0 || poe0.2.0
    config.widgets.find(
      (w) => w.wmType === "price-check",
    )!.openItemEditorAbove = false;

    config.configVersion = 25;
  }

  if (config.configVersion < 26) {
    // NOTE: v0.11.0 || poe0.3.0
    // Removes item filter generator
    config.widgets = config.widgets.filter(
      (w) => w.wmType !== "filter-generator",
    );

    config.configVersion = 26;
  }
  if (config.configVersion < 27) {
    // NOTE: v0.12.4 || poe0.3.0c

    const itemCheck = config.widgets.find(
      (w) => w.wmType === "item-check",
    ) as ItemCheckWidget;
    itemCheck.samePricedKey = null;

    config.configVersion = 27;
  }
  if (config.configVersion < 28) {
    // NOTE: v0.12.7 || poe0.3.0c

    const itemCheck = config.widgets.find(
      (w) => w.wmType === "item-check",
    ) as ItemCheckWidget;
    itemCheck.samePricedType = "both";

    config.configVersion = 28;
  }
  if (config.configVersion < 29) {
    // NOTE: v0.13.0 || poe0.4.0
    const itemSearchId: number = config.widgets.find(
      (w) => w.wmType === "item-search",
    )!.wmId;
    // splicing to insert after the item-search widget, for positioning on the main overlay
    config.widgets.splice(itemSearchId, 0, {
      ...defaultConfig().widgets.find(
        (w) => w.wmType === "experience-tracker",
      )!,
      wmId: Math.max(0, ...config.widgets.map((_) => _.wmId)) + 1,
    });

    config.tipsFrequency = TipsFrequency.Never;

    const priceCheck = config.widgets.find(
      (w) => w.wmType === "price-check",
    ) as widget.PriceCheckWidget;
    priceCheck.coreCurrency = "exalted";
    priceCheck.currencyVolume = "both";

    config.readClientLog = false; // default to false, opt-in only

    config.configVersion = 29;
  }

  if (config.configVersion < 30) {
    // NOTE: v0.14.0 || poe0.4.0d
    const itemSearchId: number = config.widgets.find(
      (w) => w.wmType === "item-search",
    )!.wmId;
    // splicing to insert after the item-search widget, for positioning on the main overlay
    config.widgets.splice(itemSearchId, 0, {
      ...savedLibrary.libraryDefaultWithModOptions(),
      wmId: Math.max(0, ...config.widgets.map((_) => _.wmId)) + 1,
    });

    config.configVersion = 30;
  }

  if (config.configVersion < 31) {
    // NOTE: v0.15.0 || poe0.4.0k
    const priceCheck = config.widgets.find(
      (w) => w.wmType === "price-check",
    ) as widget.PriceCheckWidget;
    priceCheck.rememberListingType = false;

    config.configVersion = 31;
  }

  if (config.configVersion < 32) {
    // NOTE: v0.15.0 || poe0.5.1
    const priceCheck = config.widgets.find(
      (w) => w.wmType === "price-check",
    ) as widget.PriceCheckWidget;
    priceCheck.initialDelay = 48;

    config.configVersion = 32;
  }

  if (config.configVersion < 33) {
    // NOTE: v0.15.6 || poe0.5.2
    const libraryWidget = config.widgets.find(
      (w) => w.wmType === "library",
    ) as savedLibrary.LibraryWidgetWithModOptions;
    libraryWidget.selectedProfile = "chaos";
    libraryWidget.profiles.chaos!.modOpts.generation = true;

    // why is this one higher?
    config.configVersion = 34;
  }

  if (config.configVersion < 35) {
    // NOTE: v0.16.0 || poe0.5.5
    const priceCheck = config.widgets.find(
      (w) => w.wmType === "price-check",
    ) as widget.PriceCheckWidget;
    priceCheck.savedAugments = {};

    config.hideOverlayOnBlur = false;

    config.configVersion = 35;
  }

  if (config.configVersion < 36) {
    repairSavedConfig(config);

    config.configVersion = 36;
  }

  if (config.configVersion < 37) {
    nameDefaultMarksByRef(config);
    config.configVersion = 37;
  }
  /* eslint-enable */

  if (config.configVersion < 38) {
    addKeysWithoutStep(config, defaultConfig());
    config.configVersion = 38;
  }

  if (config.configVersion < 39) {
    namePresetEntries(config);
    config.configVersion = 39;
  }

  if (config.configVersion < 40) {
    namePresetEntries(config, ENGLISH_DEFAULTS_40);
    config.configVersion = 40;
  }

  if (config.configVersion < 41) {
    removed.removePathOfExile1Widgets(config);
    config.configVersion = 41;
  }

  if (config.configVersion < 42) {
    moveMartialWeaponAugments(config);
    config.configVersion = 42;
  }

  if (config.configVersion < 43) {
    savedLibrary.removeModOptions(config);
    config.configVersion = 43;
  }

  if (config.configVersion < 44) {
    for (const w of config.widgets) {
      if (w.wmType === "price-check") w.suggestedPrice ??= true;
    }
    config.configVersion = 44;
  }

  if (config.configVersion < 45) {
    addNewWidget(config, stashPricesDefault());
    config.configVersion = 45;
  }

  return config as Config;
}

function getConfigForHost(): HostConfig {
  const config = AppConfig();
  const priceCheck = AppConfig("price-check") as widget.PriceCheckWidget;
  const library = AppConfig("library") as LibraryWidget;
  const stashPrices = AppConfig("stash-prices") as StashPricesWidget;

  return {
    shortcuts: shortcutActions(config),
    restoreClipboard: config.restoreClipboard,
    clientLog: config.clientLog,
    gameConfig: config.gameConfig,
    stashScroll: config.stashScroll,
    overlayKey: config.overlayKey,
    logKeys: config.logKeys,
    windowTitle: config.windowTitle,
    readClientLog: config.readClientLog,
    libraryAlpha: config.enableAlphas && config.alphas.includes("library"),
    libraryOutputPath: library.libraryOutputPath,
    initialDelay: priceCheck.initialDelay,
    hideOverlayOnBlur: config.hideOverlayOnBlur,
    stashCapture: stashPrices.enabled,
  };
}
