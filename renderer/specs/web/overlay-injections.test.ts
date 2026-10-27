import { describe, expect, it } from "vitest";
import { computed, createApp, ref } from "vue";
import type { WidgetManager } from "@/web/overlay/interfaces";
import {
  injectShowBrowser,
  injectWidgetManager,
} from "@/web/overlay/injections";

describe("injectWidgetManager", () => {
  it("returns the widget manager the app provides", () => {
    const app = createApp({});
    const wm: WidgetManager = {
      poePanelWidth: computed(() => 0),
      size: ref({ width: 0, height: 0 }),
      active: ref(true),
      widgets: computed(() => []),
      show: () => undefined,
      hide: () => undefined,
      remove: () => undefined,
      bringToTop: () => undefined,
      create: () => undefined,
      setFlag: () => undefined,
    };
    app.provide("wm", wm);

    expect(app.runWithContext(() => injectWidgetManager())).toBe(wm);
  });

  it("throws when nothing provides a widget manager", () => {
    const app = createApp({});

    expect(() => app.runWithContext(() => injectWidgetManager())).toThrow(
      "No widget manager is provided to this component",
    );
  });
});

describe("injectShowBrowser", () => {
  it("returns the function the app provides", () => {
    const app = createApp({});
    const opened: string[] = [];
    app.provide("builtin-browser", (url: string) => opened.push(url));

    app.runWithContext(() => injectShowBrowser())("https://example.com");
    expect(opened).toEqual(["https://example.com"]);
  });

  it("throws when nothing provides a browser", () => {
    const app = createApp({});

    expect(() => app.runWithContext(() => injectShowBrowser())).toThrow(
      "No built-in browser is provided to this component",
    );
  });
});
