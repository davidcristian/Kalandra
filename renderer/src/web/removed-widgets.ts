import type { ImageStripWidget, Widget } from "./overlay/widgets";

type SavedWidget = Record<string, unknown>;

const CHEAT_SHEETS = "Cheat sheets";
const SYNDICATE_SHEET = "syndicate.jpg";
// The title of the default strip, and of a strip added from the menu
const TITLES_THE_APP_GAVE = [CHEAT_SHEETS, ""];

/** A saved Delve grid widget, which only the upgrade steps read. */
export interface DelveGridWidget extends Widget {
  toggleKey: string | null;
}

/** Returns the Delve grid widget, which the `< 3` step adds. */
export function delveGridDefault(): DelveGridWidget {
  return {
    wmId: 0,
    wmType: "delve-grid",
    wmTitle: "",
    wmWants: "hide",
    wmZorder: null,
    wmFlags: ["hide-on-focus", "menu::skip"],
    toggleKey: null,
  };
}

/** Returns the `Cheat sheets` image strip with the Path of Exile 1 syndicate sheet, which the `< 3` step adds. */
export function cheatSheetsDefault(): ImageStripWidget {
  return {
    wmId: 0,
    wmType: "image-strip",
    wmTitle: CHEAT_SHEETS,
    wmWants: "hide",
    wmZorder: null,
    wmFlags: ["invisible-on-blur"],
    anchor: { pos: "tc", x: 50, y: 10 },
    images: [{ id: 1, url: SYNDICATE_SHEET }],
  };
}

/** Removes each Delve grid, the syndicate sheet from each image strip, and a strip that had only that sheet and the title the app gave it. */
export function removePathOfExile1Widgets(config: {
  widgets: SavedWidget[];
}): void {
  const kept: SavedWidget[] = [];
  for (const widget of config.widgets) {
    if (widget.wmType === "delve-grid") continue;
    if (widget.wmType === "image-strip" && Array.isArray(widget.images)) {
      const images: unknown[] = widget.images;
      const others = images.filter((image) => !isSyndicateSheet(image));
      widget.images = others;
      if (images.length > 0 && others.length === 0 && hasAppTitle(widget)) {
        continue;
      }
    }
    kept.push(widget);
  }
  config.widgets = kept;
}

function hasAppTitle(widget: SavedWidget): boolean {
  return (
    typeof widget.wmTitle === "string" &&
    TITLES_THE_APP_GAVE.includes(widget.wmTitle)
  );
}

function isSyndicateSheet(image: unknown): boolean {
  return (
    typeof image === "object" &&
    image !== null &&
    "url" in image &&
    image.url === SYNDICATE_SHEET
  );
}
