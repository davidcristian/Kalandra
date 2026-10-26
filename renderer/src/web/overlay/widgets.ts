import type { SavedAugments } from "@/parser/settings";

export interface Widget {
  wmId: number;
  wmType: string;
  wmTitle: string;
  wmWants: "show" | "hide";
  wmZorder: number | "exclusive" | null;
  wmFlags: Array<WellKnownFlag | string>;
}

interface SingleWidgetSpec {
  type: string;
  instances: "single";
  trNameKey?: string;
  initInstance: () => Widget;
}

interface MultiWidgetSpec {
  type: string;
  instances: "multi";
  trNameKey?: string;
  defaultInstances?: () => Widget[];
}

export type WidgetSpec = SingleWidgetSpec | MultiWidgetSpec;

export type WellKnownFlag =
  | "uninitialized"
  | "menu::skip"
  | "has-browser"
  | "invisible-on-blur"
  | "hide-on-blur"
  | "hide-on-focus"
  | "ignore-ui-visibility";

export interface Anchor {
  pos: string;
  x: number;
  y: number;
}

export interface WidgetMenu extends Widget {
  anchor: Anchor;
  alwaysShow: boolean;
}

export interface PriceCheckWidget extends Widget {
  hotkey: string | null;
  hotkeyHold: string;
  hotkeyLocked: string | null;
  showSeller: false | "account" | "ign";
  searchStatRange: number;
  showRateLimitState: boolean;
  apiLatencySeconds: number;
  collapseListings: "api" | "app";
  smartInitialSearch: boolean;
  lockedInitialSearch: boolean;
  activateStockFilter: boolean;
  showCursor: boolean;
  builtinBrowser: boolean;
  rememberCurrency: boolean;
  defaultAllSelected: boolean;
  itemHoverTooltip: "off" | "keybind" | "always";
  alwaysShowTier: boolean;
  coreCurrency: "exalted" | "chaos";
  currencyVolume: "none" | "value" | "item" | "both";
  rememberListingType: boolean;
  initialDelay: number;
  savedAugments: SavedAugments;
}

export interface StopwatchWidget extends Widget {
  anchor: Anchor;
  toggleKey: string | null;
  resetKey: string | null;
}

export interface ImageStripWidget extends Widget {
  anchor: Anchor;
  images: Array<{
    id: number;
    url: string;
  }>;
}

export interface NotepadWidget extends Widget {
  anchor: Anchor;
  notepadBody: string;
  notepadSize: 0 | 1 | 2;
}
