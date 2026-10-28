/** Adds the settings of version 46 to each stash prices widget of a saved config, with that version's defaults. */
export function addDetectionSettings(
  widgets: Array<Record<string, unknown>>,
): void {
  for (const widget of widgets) {
    if (widget.wmType !== "stash-prices") continue;
    widget.captureEnabled ??= true;
    widget.toggleKey ??= null;
    widget.gridCorrection ??= { unit: "px", left: 0, top: 0, cell: 0 };
  }
}

/** Adds the settings of version 47 to each stash prices widget of a saved config, with that version's defaults. */
export function addHighlightSettings(
  widgets: Array<Record<string, unknown>>,
): void {
  for (const widget of widgets) {
    if (widget.wmType !== "stash-prices") continue;
    widget.highlightValuable ??= true;
    widget.highlightTrash ??= true;
    widget.trashThreshold ??= { amount: 1, currency: "chaos" };
    widget.alignmentView ??= false;
  }
}
