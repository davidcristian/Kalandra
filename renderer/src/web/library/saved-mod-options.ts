import type { ColumnOpts, LibraryWidget } from "./widget";

type SavedWidget = Record<string, unknown>;

/** The mod options of a library profile, which no code reads and the `< 43` step deletes. */
interface ModOptions {
  name: true;
  tier: boolean;
  roll: boolean;
  ref: boolean;
  type: boolean;
  generation: boolean;
}

/** A library widget as versions 30 to 42 saved it, the type the `< 33` step reads. */
export interface LibraryWidgetWithModOptions extends LibraryWidget {
  profiles: Record<string, ColumnOpts & { modOpts: ModOptions }>;
}

/** Returns the library widget default of version 42, which the `< 30` step adds. */
export function libraryDefaultWithModOptions(): LibraryWidgetWithModOptions {
  return {
    wmId: 0,
    wmType: "library",
    wmTitle: "{icon=fa-book}",
    wmWants: "hide",
    wmZorder: null,
    wmFlags: ["invisible-on-blur", "menu::skip"],
    anchor: { pos: "tl", x: 20, y: 20 },
    logItemKey: null,
    libraryOutputPath: null,
    selectedProfile: "chaos",
    profiles: {
      chaos: {
        refName: true,
        itemLevel: true,
        rarity: true,
        sockets: true,
        mods: true,
        addedMods: true,
        removedMods: true,
        keep: {
          explicit: true,
          implicit: false,
          enchant: false,
          augment: false,
        },
        modOpts: {
          name: true,
          tier: true,
          roll: true,
          ref: true,
          type: true,
          generation: true,
        },
      },
    },
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Deletes `modOpts` from each profile of each library widget. */
export function removeModOptions(config: { widgets: SavedWidget[] }): void {
  for (const widget of config.widgets) {
    if (widget.wmType !== "library" || !isRecord(widget.profiles)) continue;
    for (const profile of Object.values(widget.profiles)) {
      if (isRecord(profile)) delete profile.modOpts;
    }
  }
}
