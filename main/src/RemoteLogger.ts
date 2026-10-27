import type { ServerEvents } from "./server";

/** The number of entries that `history` keeps for the pages that connect later. */
export const HISTORY_ENTRIES = 1000;

export class Logger {
  private entries: string[] = [];

  constructor(private server: ServerEvents) {}

  /** The last `HISTORY_ENTRIES` entries, oldest first. */
  get history(): string {
    return this.entries.join("");
  }

  write(message: string) {
    message = `[${new Date().toLocaleTimeString()}] ${message}\n`;
    this.entries.push(message);
    if (this.entries.length > HISTORY_ENTRIES) {
      this.entries.shift();
    }
    this.server.sendEventTo("broadcast", {
      name: "MAIN->CLIENT::log-entry",
      payload: { message },
    });
  }
}

/** Returns a rejection handler that writes `error [<source>] Cannot <action>: <message>` to the log. */
export function logRejection(
  logger: Pick<Logger, "write">,
  source: string,
  action: string,
): (error: unknown) => void {
  return (error) => {
    const message = error instanceof Error ? error.message : String(error);
    logger.write(`error [${source}] Cannot ${action}: ${message}`);
  };
}
