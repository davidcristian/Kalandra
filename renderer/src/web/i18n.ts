import { createI18n, Composer as I18n, useI18n } from "vue-i18n";
import { nextTick } from "vue";
import { Settings } from "luxon";
import { fetchData } from "@/assets/data/fetch-data";
import type { Config } from "@/web/Config";

// The game's Traditional Chinese client is the one for Taiwan, and its Portuguese is Brazilian
const DATE_LOCALES: Record<Config["language"], string> = {
  "en": "en",
  "ru": "ru",
  "cmn-Hant": "zh-TW",
  "ko": "ko",
  "ja": "ja",
  "de": "de",
  "es": "es",
  "pt": "pt-BR",
  "fr": "fr",
};

let _global: I18n;

export async function init(lang: Config["language"]) {
  const plugin = createI18n<false>({
    legacy: false,
    locale: "en",
    fallbackLocale: "en",
    fallbackFormat: true,
    fallbackWarn: false,
    missingWarn: false,
    messages: {
      en: await (await fetchData("en/app_i18n.json")).json(),
    },
  });
  _global = plugin.global;
  await loadLang(lang);
  return plugin;
}

export async function loadLang(lang: Config["language"]): Promise<void> {
  if (lang !== "en") {
    const messages = await (await fetchData(`${lang}/app_i18n.json`)).json();
    _global.setLocaleMessage(lang, messages);
  }
  Settings.defaultLocale = DATE_LOCALES[lang];
  const prevLang = _global.locale.value;
  _global.locale.value = lang;
  if (prevLang !== "en") {
    _global.setLocaleMessage(prevLang, {});
  }

  document.documentElement.lang = lang;

  await nextTick();
}

export function useI18nNs(name: string) {
  const { t } = useI18n();
  // The wrapper passes on every argument, so it serves each overload of t and takes its type
  const tNs = (...[path, ...args]: Parameters<typeof t>) => {
    if (typeof path === "string" && path.startsWith(":")) {
      return t(path.replace(":", `${name}.`), ...args);
    } else {
      return t(path, ...args);
    }
  };
  return { t: tNs as typeof t };
}
