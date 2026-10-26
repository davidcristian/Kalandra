import type { ImageStripWidget } from "./overlay/widgets";

const SYNDICATE_SHEET = "syndicate.jpg";

/** Returns the `Cheat sheets` image strip with the Path of Exile 1 syndicate sheet, which the `< 3` step adds. */
export function cheatSheetsDefault(): ImageStripWidget {
  return {
    wmId: 0,
    wmType: "image-strip",
    wmTitle: "Cheat sheets",
    wmWants: "hide",
    wmZorder: null,
    wmFlags: ["invisible-on-blur"],
    anchor: { pos: "tc", x: 50, y: 10 },
    images: [{ id: 1, url: SYNDICATE_SHEET }],
  };
}
