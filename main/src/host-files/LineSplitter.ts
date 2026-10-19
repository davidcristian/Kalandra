import type { Logger } from "../RemoteLogger";

const NEWLINE = 0x0a;
// Client.txt lines are far shorter. Dropping a longer line stops a file without
// newlines from growing the kept bytes without limit.
export const MAX_LINE_BYTES = 64 * 1024;

/** Splits log bytes read in chunks into whole lines and keeps a partial line for the next chunk. */
export class LineSplitter {
  private pending = Buffer.alloc(0);
  private skipping = false;

  constructor(private logger: Logger) {}

  push(chunk: Buffer): string[] {
    let bytes = Buffer.concat([this.pending, chunk]);
    if (this.skipping) {
      const next = bytes.indexOf(NEWLINE);
      if (next === -1) {
        this.pending = Buffer.alloc(0);
        return [];
      }
      bytes = bytes.subarray(next + 1);
      this.skipping = false;
    }

    // UTF-8 never uses the newline byte inside a character, so the bytes up to it decode whole
    const end = bytes.lastIndexOf(NEWLINE) + 1;
    this.pending = Buffer.from(bytes.subarray(end));
    if (this.pending.length > MAX_LINE_BYTES) {
      this.logger.write(
        `warn [GameLogWatcher] Skipped a line longer than ${MAX_LINE_BYTES} bytes`,
      );
      this.pending = Buffer.alloc(0);
      this.skipping = true;
    }

    return bytes
      .toString("utf8", 0, end)
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length);
  }

  reset() {
    this.pending = Buffer.alloc(0);
    this.skipping = false;
  }
}
