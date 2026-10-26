import type { Config } from "./Config";
import type { DelveGridWidget, Widget } from "./overlay/widgets";
import type { ItemCheckWidget } from "./item-check/widget";
import type { ItemSearchWidget } from "./item-search/widget";

type SavedWidget = Record<string, unknown>;

/** The parts of a saved config that `repairSavedConfig` reads and changes. */
export interface SavedConfig {
  overlayAlwaysClose?: boolean;
  widgets: SavedWidget[];
}

const INSERTED_AFTER_ITEM_SEARCH = ["library", "experience-tracker"];

/** Adds a missing `overlayAlwaysClose`, removes a second library widget and moves misplaced widgets after item search. */
export function repairSavedConfig(config: SavedConfig): void {
  config.overlayAlwaysClose ??= false;
  removeLaterCopies(config.widgets, "library");
  moveAfterItemSearch(config.widgets, INSERTED_AFTER_ITEM_SEARCH);
}

// AppConfig(type), the settings window and the hotkeys read the first widget of a type,
// so the first one holds the settings the user sees.
function removeLaterCopies(widgets: SavedWidget[], wmType: string): void {
  const first = widgets.findIndex((w) => w.wmType === wmType);
  for (let i = widgets.length - 1; i > first; i--) {
    if (widgets[i].wmType === wmType) {
      widgets.splice(i, 1);
    }
  }
}

// The version 29 and 30 steps passed the item search wmId to splice as an index, which puts
// these widgets right after item search only where that wmId is its index plus one.
function moveAfterItemSearch(widgets: SavedWidget[], wmTypes: string[]): void {
  const itemSearch = widgets.findIndex((w) => w.wmType === "item-search");
  if (itemSearch === -1) return;
  const next = widgets.at(itemSearch + 1);
  if (wmTypes.some((type) => type === next?.wmType)) return;

  const moved = wmTypes.flatMap((type) =>
    widgets.filter((w) => w.wmType === type),
  );
  const rest = widgets.filter((w) => !moved.includes(w));
  const after = rest.findIndex((w) => w.wmType === "item-search") + 1;
  rest.splice(after, 0, ...moved);
  widgets.splice(0, widgets.length, ...rest);
}

/** The parts of a saved config that `addKeysWithoutStep` reads and changes. */
export interface ConfigKeysWithoutStep {
  language?: Config["language"];
  restoreClipboard?: boolean;
  clientLog?: string | null;
  gameConfig?: string | null;
  widgets: SavedWidget[];
}

/** Sets each key that entered `defaultConfig()` without a step to its value in `defaults`, where the saved config has none. */
export function addKeysWithoutStep(
  config: ConfigKeysWithoutStep,
  defaults: Config,
): void {
  if (config.language === undefined) config.language = defaults.language;
  if (config.restoreClipboard === undefined) {
    config.restoreClipboard = defaults.restoreClipboard;
  }
  if (config.clientLog === undefined) config.clientLog = defaults.clientLog;
  if (config.gameConfig === undefined) config.gameConfig = defaults.gameConfig;

  const itemCheck = defaultWidget<ItemCheckWidget>(defaults, "item-check");
  const delveGrid = defaultWidget<DelveGridWidget>(defaults, "delve-grid");
  const itemSearch = defaultWidget<ItemSearchWidget>(defaults, "item-search");
  addWidgetKey(
    config.widgets,
    "item-check",
    "craftOfExileKey",
    itemCheck?.craftOfExileKey,
  );
  addWidgetKey(config.widgets, "delve-grid", "toggleKey", delveGrid?.toggleKey);
  addWidgetKey(
    config.widgets,
    "item-search",
    "ocrGemsKey",
    itemSearch?.ocrGemsKey,
  );
}

function defaultWidget<T extends Widget>(
  defaults: Config,
  wmType: string,
): T | undefined {
  return defaults.widgets.find((w) => w.wmType === wmType) as T | undefined;
}

// AppConfig(type) reads the first widget of a type, so the key goes on that one
function addWidgetKey(
  widgets: SavedWidget[],
  wmType: string,
  key: string,
  value: unknown,
): void {
  const widget = widgets.find((w) => w.wmType === wmType);
  if (widget !== undefined && widget[key] === undefined) widget[key] = value;
}
