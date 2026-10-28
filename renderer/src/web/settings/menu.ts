/** A page of the Settings window. `SettingsWindow.vue` maps each name to its component. */
export type SettingsPage =
  | "hotkeys"
  | "chat"
  | "general"
  | "price-check"
  | "maps"
  | "item-check"
  | "leveling"
  | "help"
  | "debug"
  | "about"
  | "stash-search"
  | "stopwatch"
  | "library"
  | "stash-prices";

/** Returns the menu's groups of pages for a widget type, or for the whole window when no type is given. */
export function menuPages(type?: string): SettingsPage[][] {
  switch (type) {
    case "stash-search":
      return [["stash-search"]];
    case "timer":
      return [["stopwatch"]];
    case "item-check":
      return [["item-check", "maps"]];
    case "price-check":
      return [["price-check"]];
    case "library":
      return [["library"]];
    case "experience-tracker":
      return [["leveling"]];
    case "stash-prices":
      return [["stash-prices"]];
    default:
      return [
        ["hotkeys", "chat"],
        ["general"],
        ["price-check", "stash-prices", "maps", "item-check"],
        ["leveling"],
        ["help", "debug", "about"],
      ];
  }
}
