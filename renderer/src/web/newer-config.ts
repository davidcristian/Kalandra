import { logToMain } from "./background/log-to-main";

/** Writes a warning to main's log when the saved config's version is above `current`, the version of this app's defaults. */
export function warnIfNewerConfig(saved: number, current: number): void {
  if (saved > current) {
    logToMain(
      "warn",
      `config.json is from a newer version of Kalandra: its config version is ${saved}, above this version's ${current}. Kalandra uses it as it is and runs no upgrade step.`,
    );
  }
}
