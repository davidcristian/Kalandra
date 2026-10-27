import { present } from "@specs/present";
import { describe, expect, it, vi } from "vitest";
import { parserSettings } from "@/parser/settings";
import { AppConfig } from "@/web/Config";
import type { PriceCheckWidget } from "@/web/overlay/widgets";
import { defaultConfigMock } from "@specs/vitest.setup";

describe("parser settings", () => {
  it("reads the language and the saved augments from the current config at each use", () => {
    defaultConfigMock({ language: "de" });
    expect(parserSettings().language).toBe("de");

    AppConfig().language = "ja";
    present(AppConfig<PriceCheckWidget>("price-check")).savedAugments = {
      Helmet: ["Iron Rune", null],
    };

    expect(parserSettings().language).toBe("ja");
    expect(parserSettings().savedAugments).toEqual({
      Helmet: ["Iron Rune", null],
    });
  });

  it("throws when the parser reads them before the app sets them", async () => {
    vi.resetModules();
    const unset = await import("@/parser/settings");

    expect(() => unset.parserSettings()).toThrow(
      "The parser settings are read before the app sets them",
    );
  });
});
