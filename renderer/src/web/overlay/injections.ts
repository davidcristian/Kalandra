import { inject } from "vue";
import type { WidgetManager } from "./interfaces";

/** Returns the widget manager that the overlay window provides, and throws outside it. */
export function injectWidgetManager(): WidgetManager {
  const wm = inject<WidgetManager>("wm");
  if (!wm) throw new Error("No widget manager is provided to this component");
  return wm;
}

/** Returns the function that the price check window provides to open a URL in its browser. */
export function injectShowBrowser(): (url: string) => void {
  const showBrowser = inject<(url: string) => void>("builtin-browser");
  if (!showBrowser) {
    throw new Error("No built-in browser is provided to this component");
  }
  return showBrowser;
}
