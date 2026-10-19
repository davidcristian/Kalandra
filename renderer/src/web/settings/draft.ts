import { reactive, shallowRef } from "vue";
import type { Config } from "@/web/Config";

type PreviewKey = "language" | "preferredTradeSite";

/** Holds the copy of the config that the Settings window edits, and the live values it changes before Save. */
export function createSettingsDraft() {
  const copy = shallowRef<Config | null>(null);
  let live: Config | null = null;
  let replaced: Partial<Pick<Config, PreviewKey>> = {};

  return {
    copy,
    open(config: Config) {
      const draft: Config = JSON.parse(JSON.stringify(config));
      live = config;
      copy.value = reactive(draft);
    },
    /** Writes the value into the live config too, so the open window uses the new language and trade site. */
    preview<K extends PreviewKey>(key: K, value: Config[K]) {
      if (live === null) return;
      if (!(key in replaced)) replaced[key] = live[key];
      live[key] = value;
    },
    /** Puts back the live values that `preview` replaced, unless Save or a reload has replaced the config. */
    close(current: Config) {
      if (current === live) Object.assign(current, replaced);
      live = null;
      replaced = {};
      copy.value = null;
    },
  };
}

export const settingsDraft = createSettingsDraft();
