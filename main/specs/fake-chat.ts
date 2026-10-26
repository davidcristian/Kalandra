export const Key = {
  A: "A",
  ArrowUp: "ArrowUp",
  Ctrl: "Ctrl",
  Delete: "Delete",
  Enter: "Enter",
  Escape: "Escape",
  Home: "Home",
  Meta: "Meta",
  V: "V",
} as const;
type KeyName = (typeof Key)[keyof typeof Key];

/** Stands in for the clipboard and the game's chat box, and applies each key press to the text in the box. */
export class FakeChat {
  lastWhisperer = "UltraSkillPlayer";
  clipboardText = "";
  // The error the next clipboard read or write fails with, or null for one that works
  clipboardError: Error | null = null;
  // The text left in the box when it closes, which the next Enter shows again
  draft = "";
  // The text in the open box, or null while the box is closed
  input: string | null = null;
  sent: string[] = [];
  private cursor = 0;
  private selected = false;
  // The key presses that wait while the game stalls, or null while it handles each one at once
  private stalled: Array<[KeyName, KeyName[]]> | null = null;

  // A write ends on a later tick, as the operating system's does
  readonly clipboard = {
    readText: async () => {
      this.throwClipboardError();
      return this.clipboardText;
    },
    writeText: async (text: string) => {
      await Promise.resolve();
      this.throwClipboardError();
      this.clipboardText = text;
    },
  };

  reset() {
    this.clipboardText = "";
    this.clipboardError = null;
    this.draft = "";
    this.input = null;
    this.sent = [];
    this.stalled = null;
  }

  /** Makes the game keep each key press until `resume()`, as a game does while it stalls. */
  stall() {
    this.stalled = [];
  }

  /** Handles the key presses kept since `stall()` in order, each with the clipboard text of now. */
  resume() {
    const presses = this.stalled ?? [];
    this.stalled = null;
    for (const [key, modifiers] of presses) this.keyTap(key, modifiers);
  }

  keyTap = (key: KeyName, modifiers: KeyName[] = []) => {
    if (this.stalled) {
      this.stalled.push([key, modifiers]);
      return;
    }
    const withCtrl =
      modifiers.includes(Key.Ctrl) || modifiers.includes(Key.Meta);
    if (key === Key.Enter) {
      if (withCtrl) this.open(`@${this.lastWhisperer} `);
      else if (this.input === null) this.open(this.draft);
      else this.send(this.input);
      return;
    }
    if (this.input === null) return;

    if (key === Key.A && withCtrl) {
      this.selected = true;
    } else if (key === Key.V && withCtrl) {
      this.paste(this.input);
    } else if (key === Key.Home) {
      this.cursor = 0;
    } else if (key === Key.Delete) {
      this.input =
        this.input.slice(0, this.cursor) + this.input.slice(this.cursor + 1);
    } else if (key === Key.Escape) {
      this.draft = this.input;
      this.input = null;
    }
  };

  private throwClipboardError() {
    const error = this.clipboardError;
    this.clipboardError = null;
    if (error) throw error;
  }

  private open(text: string) {
    this.input = text;
    this.cursor = text.length;
    this.selected = false;
  }

  private send(text: string) {
    this.sent.push(text);
    this.draft = "";
    this.input = null;
  }

  private paste(input: string) {
    const before = this.selected ? "" : input.slice(0, this.cursor);
    const after = this.selected ? "" : input.slice(this.cursor);
    this.input = before + this.clipboardText + after;
    this.cursor = before.length + this.clipboardText.length;
    this.selected = false;
  }
}

export const chat = new FakeChat();
