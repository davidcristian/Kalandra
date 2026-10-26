import type { Config } from "./Config";
import type { Widget } from "./overlay/widgets";

// The first version whose saved config has each single instance widget. The step of that
// version adds the widget to an older config. Before version 7 the item check was the map check.
const SAVED_SINCE = new Map<string, number>([
  ["menu", 0],
  ["price-check", 0],
  ["delve-grid", 3],
  ["item-check", 7],
  ["settings", 10],
  ["item-search", 12],
  ["experience-tracker", 29],
  ["library", 30],
]);

/** Adds each single instance widget of `defaults` that a config of its version has and this one lacks, and logs their types. */
export function addMissingWidgets(
  config: Pick<Config, "configVersion" | "widgets">,
  defaults: Widget[],
): void {
  const added: string[] = [];
  for (const widget of defaults) {
    const since = SAVED_SINCE.get(widget.wmType);
    if (since === undefined || config.configVersion < since) continue;
    if (config.widgets.some((w) => w.wmType === widget.wmType)) continue;

    const wmId = Math.max(0, ...config.widgets.map((w) => w.wmId)) + 1;
    config.widgets.push({ ...widget, wmId });
    added.push(widget.wmType);
  }
  if (added.length) {
    console.warn(
      "[config] Added the default widgets that the saved config lacks:",
      added.join(", "),
    );
  }
}
