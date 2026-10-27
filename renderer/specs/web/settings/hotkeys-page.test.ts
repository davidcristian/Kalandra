import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { createSSRApp, type ComponentPublicInstance } from "vue";
import { renderToString } from "vue/server-renderer";
import { setupTests } from "@specs/vitest.setup";
import type { Config } from "@/web/Config";
import { init, loadLang } from "@/web/i18n";
import type { ItemCheckWidget } from "@/web/item-check/widget";
import HotkeyInput from "@/web/settings/HotkeyInput.vue";
import Hotkeys from "@/web/settings/hotkeys.vue";
import { requireWidget } from "@/web/settings/utils";
import { hotkeyConfig } from "../hotkey-config";

type HotkeyField = InstanceType<typeof HotkeyInput>;

let plugin: Awaited<ReturnType<typeof init>>;

beforeAll(async () => {
  setupTests();
  vi.stubGlobal("document", { documentElement: { lang: "" } });
  plugin = await init("en");
});

beforeEach(async () => {
  await loadLang("en");
});

afterAll(() => {
  vi.unstubAllGlobals();
});

/** Renders the Hotkeys page and returns each hotkey row's label with the field that sets its key. */
async function renderRows(config: Config) {
  const fields: HotkeyField[] = [];
  // Vitest's node environment compiles .vue files for server rendering, so only renderToString runs them
  const app = createSSRApp(Hotkeys, { config }).use(plugin);
  app.mixin({
    created(this: ComponentPublicInstance) {
      if ("handleKeyup" in this) fields.push(this as HotkeyField);
    },
  });
  const html = await renderToString(app);
  const labels = [...html.matchAll(/<label class="flex-1">([^<]*)</g)].map(
    (match) => match[1].trim(),
  );
  return fields.map((field, index) => ({ label: labels[index], field }));
}

describe("the Hotkeys page", () => {
  it("has one row that sets the item check key, named for Map check and Item info", async () => {
    const rowCount = (await renderRows(hotkeyConfig())).length;
    const setters: string[] = [];
    for (let index = 0; index < rowCount; index++) {
      const config = hotkeyConfig();
      const row = (await renderRows(config))[index];

      row.field.$emit("update:modelValue", "Alt + W");

      const itemCheck = requireWidget<ItemCheckWidget>("item-check", config);
      if (itemCheck.hotkey === "Alt + W") setters.push(row.label);
    }

    expect(setters).toEqual(["Map check / Item info"]);
  });

  it("names that row in the language the app shows", async () => {
    await loadLang("de");

    const labels = (await renderRows(hotkeyConfig())).map((row) => row.label);

    expect(labels).toContain("Kartenprüfung / Gegenstandsinformationen");
  });
});
