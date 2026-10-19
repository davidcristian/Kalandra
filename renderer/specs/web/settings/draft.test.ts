import { describe, expect, it } from "vitest";
import { isReactive, reactive } from "vue";
import { defaultConfigMock } from "@specs/vitest.setup";
import { AppConfig, Config } from "@/web/Config";
import { createSettingsDraft } from "@/web/settings/draft";

function liveConfig(overrides: Partial<Config> = {}): Config {
  defaultConfigMock(overrides);
  return reactive(AppConfig());
}

function saveDraft(copy: Config): Config {
  return reactive(JSON.parse(JSON.stringify(copy)));
}

describe("settings draft", () => {
  it("opens a reactive deep copy that the window edits apart from the live config", () => {
    const draft = createSettingsDraft();
    const live = liveConfig();

    draft.open(live);
    draft.copy.value!.fontSize = 20;
    draft.copy.value!.widgets[0].wmTitle = "Edited";

    expect(isReactive(draft.copy.value)).toBe(true);
    expect(live.fontSize).toBe(12);
    expect(live.widgets[0].wmTitle).toBe("");
  });

  it("writes a previewed language and trade site into the live config", () => {
    const draft = createSettingsDraft();
    const live = liveConfig();

    draft.open(live);
    draft.preview("language", "de");
    draft.preview("preferredTradeSite", "www");

    expect(live.language).toBe("de");
    expect(live.preferredTradeSite).toBe("www");
  });

  it("puts the live language and trade site back when the window closes without Save", () => {
    const draft = createSettingsDraft();
    const live = liveConfig({ language: "ru", preferredTradeSite: "default" });

    draft.open(live);
    draft.preview("language", "de");
    draft.preview("preferredTradeSite", "www");
    draft.close(live);

    expect(live.language).toBe("ru");
    expect(live.preferredTradeSite).toBe("default");
    expect(draft.copy.value).toBeNull();
  });

  it("puts back the value from before the first preview when a setting changes twice", () => {
    const draft = createSettingsDraft();
    const live = liveConfig({ language: "ru" });

    draft.open(live);
    draft.preview("language", "de");
    draft.preview("language", "fr");
    draft.close(live);

    expect(live.language).toBe("ru");
  });

  it("keeps the saved language when Save has replaced the live config", () => {
    const draft = createSettingsDraft();
    const live = liveConfig({ language: "ru" });

    draft.open(live);
    draft.copy.value!.language = "de";
    draft.preview("language", "de");
    const saved = saveDraft(draft.copy.value!);
    draft.close(saved);

    expect(saved.language).toBe("de");
    expect(draft.copy.value).toBeNull();
  });

  it("keeps a reloaded config when it arrives while the window is open", () => {
    const draft = createSettingsDraft();
    const live = liveConfig({ language: "ru" });

    draft.open(live);
    draft.preview("language", "de");
    const reloaded = liveConfig({ language: "ja" });
    draft.close(reloaded);

    expect(reloaded.language).toBe("ja");
  });

  it("leaves the live config alone when a preview comes after the window closed", () => {
    const draft = createSettingsDraft();
    const live = liveConfig({ language: "ru" });

    draft.open(live);
    draft.close(live);
    draft.preview("language", "de");

    expect(live.language).toBe("ru");
  });
});
