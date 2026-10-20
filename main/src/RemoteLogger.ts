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
