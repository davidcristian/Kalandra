import { present } from "@specs/present";
import { describe, expect, it } from "vitest";
import { reactive } from "vue";
import { defaultConfigMock } from "@specs/vitest.setup";
import { AppConfig, Config } from "@/web/Config";
import { createSettingsDraft } from "@/web/settings/draft";
import { alphaModelValue } from "@/web/settings/utils";

function openSettings(overrides: Partial<Config>): Config {
  defaultConfigMock(overrides);
  const draft = createSettingsDraft();
  draft.open(reactive(AppConfig()));
  return present(draft.copy.value);
}

function openGeneralPage(copy: Config) {
  return alphaModelValue(() => copy, "library");
}

describe("the library alpha checkbox on the General page", () => {
  it("keeps one library entry when the page opens twice before Save", () => {
    const copy = openSettings({ enableAlphas: true, alphas: ["library"] });

    expect(openGeneralPage(copy).value).toBe(true);
    expect(openGeneralPage(copy).value).toBe(true);

    expect(copy.alphas).toEqual(["library"]);
  });

  it("shows a change made earlier in the same window after a page switch", () => {
    const copy = openSettings({ enableAlphas: true, alphas: ["library"] });

    openGeneralPage(copy).value = false;
    const reopened = openGeneralPage(copy);

    expect(reopened.value).toBe(false);
    expect(copy.alphas).toEqual([]);
  });

  it("leaves alphas unchanged when the page opens with experimental features off", () => {
    const copy = openSettings({ enableAlphas: false, alphas: ["library"] });

    expect(openGeneralPage(copy).value).toBe(true);

    expect(copy.alphas).toEqual(["library"]);
  });

  it("adds the alpha once and removes every copy a config already has", () => {
    const copy = openSettings({
      enableAlphas: true,
      alphas: ["library", "library"],
    });
    const libraryAlpha = openGeneralPage(copy);

    libraryAlpha.value = false;
    expect(copy.alphas).toEqual([]);

    libraryAlpha.value = true;
    libraryAlpha.value = true;
    expect(copy.alphas).toEqual(["library"]);
  });
});
