import {
  pushHostConfig,
  saveConfig,
  updateConfig,
  type Config,
} from "@/web/Config";

/** Applies the Settings window's edited copy, hides the window and sends the config to main. */
export function saveSettings(copy: Config, hideWindow: () => void) {
  updateConfig(copy);
  // saveConfig() sends nothing while an exclusive widget, such as this window, is shown
  hideWindow();
  saveConfig();
  pushHostConfig();
}
