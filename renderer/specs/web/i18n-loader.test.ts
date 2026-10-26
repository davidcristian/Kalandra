import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { createSSRApp, defineComponent } from "vue";
import { renderToString } from "vue/server-renderer";
import { setupTests } from "@specs/vitest.setup";
import { DataLoadError } from "@/assets/data/fetch-data";
import { init, loadLang, useI18nNs } from "@/web/i18n";
import { readMessages } from "./app-i18n";

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

/** Renders a component that translates the key with useI18nNs(namespace). */
async function renderText(namespace: string, key: string, list?: unknown[]) {
  const component = defineComponent({
    setup() {
      const { t } = useI18nNs(namespace);
      return () => (list ? t(key, list) : t(key));
    },
  });
  return renderToString(createSSRApp(component).use(plugin));
}

/** Makes fetch fail with status 404 for one data file and serve the others. */
function failFetch(file: string): () => void {
  const served = global.fetch;
  global.fetch = async (input: RequestInfo | URL, init?: RequestInit) =>
    String(input).endsWith(file)
      ? new Response("", { status: 404 })
      : served(input, init);
  return () => {
    global.fetch = served;
  };
}

describe("loadLang", () => {
  it("shows the text of the language it loads", async () => {
    await loadLang("de");

    expect(plugin.global.locale.value).toBe("de");
    expect(plugin.global.t("settings.title")).toBe("Einstellungen - Kalandra");
  });

  it("shows the English text for a key that the language does not have", async () => {
    const german = readMessages("de");
    // t() fills a placeholder with nothing when it gets no values
    const [key, english] = [...readMessages("en")].find(
      ([key, text]) => !german.has(key) && !text.includes("{"),
    )!;

    await loadLang("de");

    expect(plugin.global.t(key)).toBe(english);
  });

  it("shows a text that no language file has as the key, with its placeholders filled", async () => {
    await loadLang("de");

    expect(plugin.global.t("Instant or Online")).toBe("Instant or Online");
    expect(plugin.global.t("{0} items", [5])).toBe("5 items");
  });

  it("empties the messages of the language it leaves", async () => {
    await loadLang("de");
    await loadLang("fr");

    expect(plugin.global.getLocaleMessage("de")).toEqual({});
    expect(plugin.global.t("settings.title")).toBe("Paramètres - Kalandra");
  });

  it("keeps the language when the file of the new language does not load", async () => {
    await loadLang("de");
    const restore = failFetch("ja/app_i18n.json");

    try {
      await expect(loadLang("ja")).rejects.toThrow(DataLoadError);
    } finally {
      restore();
    }

    expect(plugin.global.locale.value).toBe("de");
    expect(document.documentElement.lang).toBe("de");
    expect(plugin.global.t("settings.title")).toBe("Einstellungen - Kalandra");
  });
});

describe("useI18nNs", () => {
  it("reads a key that starts with : in its namespace", async () => {
    await loadLang("de");

    expect(await renderText("settings", ":tip_number_header", [7])).toBe(
      "Tipp #7",
    );
  });

  it("reads a key without : from the root of the messages", async () => {
    expect(await renderText("settings", "widget.untitled")).toBe("Untitled");
  });

  it("leaves a : inside a key as it is", async () => {
    expect(await renderText("settings", "price_check:name")).toBe(
      "price_check:name",
    );
  });
});
