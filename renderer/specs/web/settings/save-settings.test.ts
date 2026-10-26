import { beforeEach, describe, expect, it, vi } from "vitest";
import type { IpcEvent } from "@ipc/types";
import { Host } from "@/web/background/IPC";
import type { Config } from "@/web/Config";

// PriceTrend.vue imports vue3-apexcharts, which reads window when it loads; no test draws a chart
vi.mock("vue3-apexcharts", () => ({ default: {} }));

type ConfigModule = typeof import("@/web/Config");

// save-settings.ts gets the real config module in place of the mock in vitest.setup.ts
const actual = await vi.importActual<ConfigModule>("@/web/Config");
vi.resetModules();
vi.doMock("@/web/Config", () => actual);
const { saveSettings } = await import("@/web/settings/save-settings");

let sent: IpcEvent[];

beforeEach(() => {
  sent = [];
  vi.mocked(Host.sendEvent).mockImplementation((event) => {
    sent.push(event);
  });
  vi.stubGlobal("document", { documentElement: { style: {} } });
});

/** Shows the Settings window over the default config and returns its id and the copy it edits. */
function openSettings(): { settingsId: number; copy: Config } {
  actual.updateConfig(actual.defaultConfig());
  const settings = actual
    .AppConfig()
    .widgets.find((w) => w.wmType === "settings");
  if (!settings) throw new Error("defaultConfig() has no settings widget");
  settings.wmWants = "show";
  return {
    settingsId: settings.wmId,
    copy: JSON.parse(JSON.stringify(actual.AppConfig())),
  };
}

/** Hides a widget of the current config, as the overlay's widget manager does. */
function hide(wmId: number) {
  const widget = actual.AppConfig().widgets.find((w) => w.wmId === wmId);
  if (widget) widget.wmWants = "hide";
}

function sentEvent<N extends IpcEvent["name"]>(
  name: N,
): Extract<IpcEvent, { name: N }> {
  const event = sent.find(
    (e): e is Extract<IpcEvent, { name: N }> => e.name === name,
  );
  if (!event) throw new Error(`No ${name} event was sent`);
  return event;
}

describe("Save in the Settings window", () => {
  it("sends the edited config to main at once, with the window hidden", () => {
    const { settingsId, copy } = openSettings();
    copy.overlayKey = "Alt + Space";

    saveSettings(copy, () => hide(settingsId));

    expect(sent.map((event) => event.name)).toEqual([
      "CLIENT->MAIN::save-config",
      "CLIENT->MAIN::update-host-config",
    ]);
    const saved: Config = JSON.parse(
      sentEvent("CLIENT->MAIN::save-config").payload.contents,
    );
    expect(saved.overlayKey).toBe("Alt + Space");
    expect(saved.widgets.find((w) => w.wmId === settingsId)?.wmWants).toBe(
      "hide",
    );
    expect(
      sentEvent("CLIENT->MAIN::update-host-config").payload.overlayKey,
    ).toBe("Alt + Space");
  });
});
