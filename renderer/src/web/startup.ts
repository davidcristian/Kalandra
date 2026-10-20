/** Runs the page's startup steps, and logs and shows the error that stops them in place of the app. */
export async function startApp(
  steps: () => Promise<void>,
  showError: (message: string) => void,
): Promise<void> {
  try {
    await steps();
  } catch (error) {
    console.error("[startup] Kalandra cannot start:", error);
    showError(startupErrorMessage(error));
  }
}

// English only, because app_i18n.json is one of the files whose load can fail
function startupErrorMessage(error: unknown): string {
  const reason = error instanceof Error ? error.message : String(error);
  return [
    `Kalandra cannot start: ${reason}`,
    "Restart Kalandra. If this message shows again, install the latest version over this one. Your settings are kept.",
  ].join("\n\n");
}
