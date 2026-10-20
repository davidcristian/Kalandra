import { createApp, watch } from "vue";
import App from "./web/App.vue";
import * as I18n from "./web/i18n";
import * as Data from "./assets/data";
import { initConfig, AppConfig } from "./web/Config";
import { Host } from "./web/background/IPC";
import { startApp } from "./web/startup";

async function start() {
  await initConfig();
  const i18nPlugin = await I18n.init(AppConfig().language);
  await Data.init(AppConfig().language);
  await Host.init();

  watch(
    () => AppConfig().language,
    async () => {
      await Data.loadForLang(AppConfig().language);
      await I18n.loadLang(AppConfig().language);
    },
  );

  const app = createApp(App);
  app.use(i18nPlugin);
  app.mount("#app");
  if (import.meta.env.DEV) {
    app.config.performance = true;
    console.error("DEV MODE");
  }
}

function showStartupError(message: string) {
  const box = document.createElement("div");
  box.className =
    "m-6 p-4 max-w-2xl rounded border border-red-400 bg-gray-900 text-base text-gray-100 whitespace-pre-wrap";
  box.textContent = message;
  document.getElementById("app")!.replaceChildren(box);
}

startApp(start, showStartupError);
