import type { App } from "electron";

/** Runs `start` once Electron is ready, on macOS only after `hasPermission` resolves true; quits otherwise. */
export async function startWhenReady(
  app: Pick<App, "whenReady" | "quit">,
  platform: NodeJS.Platform,
  hasPermission: () => Promise<boolean>,
  start: () => Promise<void>,
): Promise<void> {
  if (platform === "darwin") {
    if (!(await hasPermission())) {
      console.warn("Accessibility permission not granted, exiting");
      app.quit();
      return;
    }
  }
  // Electron emits `ready` once, which can happen during the permission wait,
  // and only whenReady() also resolves after that.
  await app.whenReady();
  await start();
}
