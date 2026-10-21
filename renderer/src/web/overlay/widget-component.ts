import type { Component } from "vue";
import type { WidgetSpec } from "./widgets";

declare module "vue" {
  interface ComponentCustomOptions {
    widget?: WidgetSpec;
  }
}

export type WidgetComponent = Component & { widget: WidgetSpec };

/** Returns the component typed as a widget component, and throws when it has no widget option. */
export function widgetComponent(
  component: Component & { widget?: WidgetSpec },
): WidgetComponent {
  if (!hasWidgetSpec(component)) {
    throw new Error("A widget component needs a static widget option");
  }
  return component;
}

function hasWidgetSpec(
  component: Component & { widget?: WidgetSpec },
): component is WidgetComponent {
  return component.widget !== undefined;
}
