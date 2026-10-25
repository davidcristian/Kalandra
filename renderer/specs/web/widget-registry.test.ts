import { beforeAll, describe, expect, it, vi } from "vitest";
import { defaultConfigMock } from "@specs/vitest.setup";
import { AppConfig } from "@/web/Config";
import type { Widget } from "@/web/overlay/widgets";
import { registry } from "@/web/overlay/widget-registry";
import { readMessages } from "./app-i18n";

// PriceTrend.vue imports vue3-apexcharts, which reads window when it loads; no test draws a chart
vi.mock("vue3-apexcharts", () => ({ default: {} }));

type ConfigModule = typeof import("@/web/Config");

let actual: ConfigModule;

beforeAll(async () => {
  actual = await vi.importActual<ConfigModule>("@/web/Config");
});

/** Changes every array and object inside the value, so a default shared between two configs shows. */
function editDeeply(value: unknown) {
  if (Array.isArray(value)) {
    value.forEach(editDeeply);
    value.push("edited");
  } else if (typeof value === "object" && value !== null) {
    Object.values(value).forEach(editDeeply);
    Object.assign(value, { edited: true });
  }
}

describe("the widget registry", () => {
  // A wmType is the key of a widget in every saved config
  it("registers each widget type once, with the type and instances saved configs have", () => {
    const specs = registry.widgets.map(({ widget }) => [
      widget.type,
      widget.instances,
    ]);

    expect(specs).toEqual([
      ["menu", "single"],
      ["settings", "single"],
      ["item-search", "single"],
      ["experience-tracker", "single"],
      ["timer", "multi"],
      ["stash-search", "multi"],
      ["price-check", "single"],
      ["item-check", "single"],
      ["image-strip", "multi"],
      ["delve-grid", "single"],
      ["notepad", "multi"],
      ["library", "single"],
    ]);
  });

  it("returns the component of a widget type, and undefined for an unknown type", () => {
    const timer = registry.getWidgetComponent("timer");

    expect(timer?.widget.type).toBe("timer");
    expect(registry.getWidgetComponent("filter-generator")).toBeUndefined();
  });

  it("names each widget that the menu can add with an English UI text", () => {
    const english = readMessages("en");
    const names = registry.widgets
      .filter(({ widget }) => widget.instances === "multi")
      .map(({ widget }) => [widget.type, english.has(widget.trNameKey ?? "")]);

    expect(names).toEqual([
      ["timer", true],
      ["stash-search", true],
      ["image-strip", true],
      ["notepad", true],
    ]);
  });
});

describe("the widgets of defaultConfig()", () => {
  it("are each single widget and the default instances of the multi widgets, numbered from 1", () => {
    const widgets = actual.defaultConfig().widgets;

    expect(widgets.map((w) => [w.wmId, w.wmType])).toEqual([
      [1, "menu"],
      [2, "settings"],
      [3, "item-search"],
      [4, "experience-tracker"],
      [5, "stash-search"],
      [6, "stash-search"],
      [7, "price-check"],
      [8, "item-check"],
      [9, "image-strip"],
      [10, "delve-grid"],
      [11, "library"],
    ]);
  });

  it("each have a registered component and the fields every widget has", () => {
    const invalid = actual
      .defaultConfig()
      .widgets.filter(
        (w: Widget) =>
          registry.getWidgetComponent(w.wmType) === undefined ||
          typeof w.wmTitle !== "string" ||
          !["show", "hide"].includes(w.wmWants) ||
          !(
            typeof w.wmZorder === "number" ||
            w.wmZorder === "exclusive" ||
            w.wmZorder === null
          ) ||
          !w.wmFlags.every((flag) => typeof flag === "string"),
      );

    expect(invalid).toEqual([]);
  });

  it("give the menu the only numeric wmZorder, which the window manager needs to find the top widget", () => {
    const ordered = actual
      .defaultConfig()
      .widgets.filter((w) => typeof w.wmZorder === "number");

    expect(ordered.map((w) => w.wmType)).toEqual(["menu"]);
  });

  it("leave the menu, price check, item check, Delve grid and library out of the menu", () => {
    const skipped = actual
      .defaultConfig()
      .widgets.filter((w) => w.wmFlags.includes("menu::skip"));

    expect(skipped.map((w) => w.wmType)).toEqual([
      "menu",
      "price-check",
      "item-check",
      "delve-grid",
      "library",
    ]);
  });

  it("are new objects at each call, so editing one config leaves the next one as it was", () => {
    const before = JSON.parse(JSON.stringify(actual.defaultConfig()));
    const edited = actual.defaultConfig();

    editDeeply(edited.widgets);

    expect(edited.widgets).not.toEqual(before.widgets);
    expect(actual.defaultConfig()).toEqual(before);
  });
});

describe("the test config", () => {
  it("has every top-level field of defaultConfig(), as the config upgrade rule says", () => {
    defaultConfigMock();

    expect(Object.keys(AppConfig()).sort()).toEqual(
      Object.keys(actual.defaultConfig()).sort(),
    );
  });
});
