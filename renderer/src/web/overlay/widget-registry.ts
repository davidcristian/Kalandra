import type { Component } from "vue";
import type { WidgetSpec } from "./interfaces";
import { type WidgetComponent, widgetComponent } from "./widget-component";
import WidgetTimer from "../stopwatch/WidgetTimer.vue";
import WidgetStashSearch from "../stash-search/WidgetStashSearch.vue";
import WidgetMenu from "./WidgetMenu.vue";
import PriceCheckWindow from "@/web/price-check/PriceCheckWindow.vue";
import WidgetItemCheck from "@/web/item-check/WidgetItemCheck.vue";
import WidgetImageStrip from "./WidgetImageStrip.vue";
import WidgetItemSearch from "../item-search/WidgetItemSearch.vue";
import WidgetSettings from "../settings/SettingsWindow.vue";
import WidgetXpTracker from "../leveling/WidgetXpTracker.vue";
import WidgetNotepad from "../notepad/WidgetNotepad.vue";
import WidgetLibrary from "../library/WidgetLibrary.vue";

export const registry = {
  widgets: [] as WidgetComponent[],

  getWidgetComponent(wmType: string) {
    return this.widgets.find((component) => component.widget.type === wmType);
  },
};

function registerWidget(component: Component & { widget?: WidgetSpec }) {
  registry.widgets.push(widgetComponent(component));
}

// Core
registerWidget(WidgetMenu);
registerWidget(WidgetSettings);
// Extra
registerWidget(WidgetItemSearch);
registerWidget(WidgetXpTracker);
registerWidget(WidgetTimer);
registerWidget(WidgetStashSearch);
registerWidget(PriceCheckWindow);
registerWidget(WidgetItemCheck);
registerWidget(WidgetImageStrip);
registerWidget(WidgetNotepad);
registerWidget(WidgetLibrary);
