import type { RendererLogLevel } from "@ipc/renderer-log";
import { Host } from "./IPC";

/** Sends a line to main's log, which Settings, Debug shows; the caller puts no cookie, token or session ID in it. */
export function logToMain(level: RendererLogLevel, message: string): void {
  Host.sendEvent({
    name: "CLIENT->MAIN::log-entry",
    payload: { level, message },
  });
}
