import { computed } from "vue";
import type { PropType } from "vue";
import type { Config } from "@/web/Config";
import type { Widget } from "@/web/overlay/interfaces";

export function configProp<T = undefined>() {
  return {
    config: {
      type: Object as PropType<Config>,
      required: true as const,
    },
    configWidget: {
      type: Object as PropType<T>,
      default: undefined as T | undefined,
    },
  };
}

export function configModelValue<
  ObjectT extends object,
  KeyT extends keyof ObjectT,
>(getObj: () => ObjectT, key: KeyT) {
  return computed<ObjectT[KeyT]>({
    get() {
      return getObj()[key];
    },
    set(value) {
      getObj()[key] = value;
    },
  });
}

/** Returns a checkbox model that adds the alpha feature to `alphas` once, or removes every copy of it. */
export function alphaModelValue(
  getConfig: () => Config,
  alpha: Config["alphas"][number],
) {
  return computed<boolean>({
    get() {
      return getConfig().alphas.includes(alpha);
    },
    set(value) {
      const config = getConfig();
      const others = config.alphas.filter((entry) => entry !== alpha);
      config.alphas = value ? [...others, alpha] : others;
    },
  });
}

export function _configModelValue<
  ObjectT extends object,
  KeyT extends keyof ObjectT,
>(obj: ObjectT, key: KeyT) {
  return {
    get value(): ObjectT[KeyT] {
      return obj[key];
    },
    set value(value: ObjectT[KeyT]) {
      obj[key] = value;
    },
  };
}

export function findWidget<T extends Widget>(type: string, config: Config) {
  return config.widgets.find((w) => w.wmType === type) as T | undefined;
}

export function disableWidget(widget: Widget) {
  widget.wmWants = "hide";
  if (!widget.wmFlags.includes("menu::skip")) {
    widget.wmFlags.push("menu::skip");
  }
}

export function enableWidget(widget: Widget) {
  widget.wmFlags = widget.wmFlags.filter((flag) => flag !== "menu::skip");
}
