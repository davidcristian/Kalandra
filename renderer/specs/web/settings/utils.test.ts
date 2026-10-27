import { describe, expect, it } from "vitest";
import { createSSRApp, defineComponent, h } from "vue";
import { renderToString } from "vue/server-renderer";
import { defaultConfigMock } from "@specs/vitest.setup";
import { AppConfig, Config } from "@/web/Config";
import type { StopwatchWidget, Widget } from "@/web/overlay/widgets";
import {
  _configModelValue,
  configModelValue,
  configProp,
  disableWidget,
  enableWidget,
  findWidget,
  requireWidget,
} from "@/web/settings/utils";

function widget(wmId: number, wmType: string, wmFlags: string[] = []): Widget {
  return {
    wmId,
    wmType,
    wmTitle: "",
    wmWants: "show",
    wmZorder: null,
    wmFlags,
  };
}

function config(widgets: Widget[] = []): Config {
  defaultConfigMock({ widgets });
  return JSON.parse(JSON.stringify(AppConfig()));
}

/** Renders a settings page that shows the language of its config and the type of its widget config. */
async function renderPage(props: {
  config: Config;
  configWidget?: StopwatchWidget;
}): Promise<string> {
  const Page = defineComponent({
    props: configProp<StopwatchWidget>(),
    setup(props) {
      return () =>
        `${props.config.language} ${props.configWidget?.wmType ?? "none"}`;
    },
  });
  return renderToString(createSSRApp({ render: () => h(Page, props) }));
}

describe("configProp", () => {
  it("passes a settings page the config and the config of its widget", async () => {
    const timer: StopwatchWidget = {
      ...widget(5, "timer"),
      anchor: { pos: "tc", x: 50, y: 5 },
      toggleKey: null,
      resetKey: null,
    };

    const html = await renderPage({ config: config(), configWidget: timer });

    expect(html).toBe("en timer");
  });

  it("leaves the widget config undefined on a page for the whole window", async () => {
    expect(await renderPage({ config: config() })).toBe("en none");
  });
});

describe("configModelValue", () => {
  it("reads and writes the field of the object the getter returns at each use", () => {
    const first = config();
    const second = config();
    let current = first;
    const fontSize = configModelValue(() => current, "fontSize");

    fontSize.value = 16;
    current = second;
    fontSize.value = 20;

    expect(first.fontSize).toBe(16);
    expect(second.fontSize).toBe(20);
    expect(fontSize.value).toBe(20);
  });
});

describe("_configModelValue", () => {
  it("reads and writes one field of the object it was given", () => {
    const edited = config();
    const overlayKey = _configModelValue(edited, "overlayKey");

    overlayKey.value = "Alt + Space";

    expect(edited.overlayKey).toBe("Alt + Space");
    expect(overlayKey.value).toBe("Alt + Space");
  });
});

describe("findWidget", () => {
  it("returns the first widget of the type", () => {
    const edited = config([
      widget(1, "menu"),
      widget(5, "stash-search"),
      widget(6, "stash-search"),
    ]);

    expect(findWidget("stash-search", edited)?.wmId).toBe(5);
  });

  it("returns undefined for a type the config has no widget of", () => {
    const edited = config([widget(1, "menu")]);

    expect(findWidget("library", edited)).toBeUndefined();
  });
});

describe("requireWidget", () => {
  it("returns the first widget of the type", () => {
    const edited = config([widget(1, "menu"), widget(5, "stash-search")]);

    expect(requireWidget("stash-search", edited).wmId).toBe(5);
  });

  it("throws an error that names a type the config has no widget of", () => {
    const edited = config([widget(1, "menu")]);

    expect(() => requireWidget("library", edited)).toThrow(
      'The config has no widget of type "library"',
    );
  });
});

describe("disableWidget and enableWidget", () => {
  it("hide the widget and leave it out of the menu, then put it back in the menu", () => {
    const xpTracker = widget(4, "experience-tracker", ["invisible-on-blur"]);

    disableWidget(xpTracker);
    expect(xpTracker.wmWants).toBe("hide");
    expect(xpTracker.wmFlags).toEqual(["invisible-on-blur", "menu::skip"]);

    enableWidget(xpTracker);
    expect(xpTracker.wmFlags).toEqual(["invisible-on-blur"]);
    expect(xpTracker.wmWants).toBe("hide");
  });

  it("add menu::skip once when the widget is disabled twice", () => {
    const library = widget(11, "library");

    disableWidget(library);
    disableWidget(library);

    expect(library.wmFlags).toEqual(["menu::skip"]);
  });

  it("remove every copy of menu::skip and keep the other flags", () => {
    const library = widget(11, "library", [
      "menu::skip",
      "invisible-on-blur",
      "menu::skip",
    ]);

    enableWidget(library);

    expect(library.wmFlags).toEqual(["invisible-on-blur"]);
  });
});
