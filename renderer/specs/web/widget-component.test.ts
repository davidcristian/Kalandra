import { describe, expect, it } from "vitest";
import { defineComponent } from "vue";
import { widgetComponent } from "@/web/overlay/widget-component";

describe("widgetComponent", () => {
  it("returns a component that has a widget option", () => {
    const component = defineComponent({
      widget: {
        type: "timer",
        instances: "multi",
        trNameKey: "stopwatch.name",
      },
    });

    expect(widgetComponent(component)).toBe(component);
    expect(widgetComponent(component).widget.type).toBe("timer");
  });

  it("throws for a component without a widget option", () => {
    const component = defineComponent({ name: "Frame" });

    expect(() => widgetComponent(component)).toThrow(
      "A widget component needs a static widget option",
    );
  });
});
