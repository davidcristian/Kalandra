import type { RendererLogLevel } from "../../ipc/renderer-log";
import type { Logger } from "./RemoteLogger";
import type { ServerEvents } from "./server";

/** The most characters of a renderer log line that main writes. */
export const RENDERER_LOG_CHARS = 500;

function isLevel(value: unknown): value is RendererLogLevel {
  return value === "error" || value === "warn" || value === "info";
}

/** Returns the line main writes for a log entry of the page, whose payload main does not check on receipt. */
export function rendererLogLine(entry: unknown): string {
  if (
    typeof entry !== "object" ||
    entry === null ||
    !("level" in entry) ||
    !isLevel(entry.level) ||
    !("message" in entry) ||
    typeof entry.message !== "string"
  ) {
    return "warn [renderer] Ignored a log entry without a known level and a text message";
  }
  // One entry stays one line in Settings, Debug, and an error text can hold response headers after its first line
  const firstLine = entry.message.split(/\r\n|\r|\n/)[0];
  const text =
    firstLine.length > RENDERER_LOG_CHARS
      ? `${firstLine.slice(0, RENDERER_LOG_CHARS)}...`
      : firstLine;
  return `${entry.level} [renderer] ${text}`;
}

/** Writes each log entry that a page sends to main's log, which Settings, Debug shows. */
export function logRendererEntries(
  server: Pick<ServerEvents, "onEventAnyClient">,
  logger: Pick<Logger, "write">,
): void {
  server.onEventAnyClient("CLIENT->MAIN::log-entry", (entry) => {
    logger.write(rendererLogLine(entry));
  });
}
