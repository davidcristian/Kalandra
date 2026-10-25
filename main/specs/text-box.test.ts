import { beforeEach, describe, expect, it, vi } from "vitest";
import { Logger } from "../src/RemoteLogger";
import { HostClipboard } from "../src/shortcuts/HostClipboard";
import { typeInChat } from "../src/shortcuts/text-box";
import { chat } from "./fake-chat";
import { FakeServer } from "./fake-server";

vi.mock("electron", async () => {
  const { chat } = await import("./fake-chat");
  return { clipboard: chat.clipboard };
});

vi.mock("uiohook-napi", async () => {
  const { chat, Key } = await import("./fake-chat");
  return { uIOhook: chat, UiohookKey: Key };
});

// A new clipboard for each command, because restoreShortly() skips a command within 120 ms of the last
async function type(text: string, send: boolean) {
  await typeInChat(text, send, new HostClipboard(new Logger(new FakeServer())));
}

beforeEach(() => {
  chat.reset();
});

describe("typeInChat", () => {
  it("whispers the last whisperer the text after @last and a space", async () => {
    await type("@last Good luck!", true);
    expect(chat.sent).toEqual(["@UltraSkillPlayer Good luck!"]);
  });

  it("whispers a player whose name starts with last", async () => {
    await type("@lasthope hi", true);
    expect(chat.sent).toEqual(["@lasthope hi"]);
  });

  it("opens a whisper to the last whisperer for @last alone", async () => {
    await type("@last", false);
    expect(chat.input).toBe("@UltraSkillPlayer ");
    expect(chat.sent).toEqual([]);
  });

  it("puts the last whisperer's name in place of @last at the end", async () => {
    await type("/invite @last", true);
    expect(chat.sent).toEqual(["/invite UltraSkillPlayer "]);
  });

  it("replaces unsent text in the box for text without a channel prefix", async () => {
    chat.draft = "unsent words";
    await type("hi", true);
    expect(chat.sent).toEqual(["hi"]);
  });

  it("leaves the text in the box without send", async () => {
    await type("#trade WTB", false);
    expect(chat.input).toBe("#trade WTB");
    expect(chat.sent).toEqual([]);
  });

  it("writes the text copied before back after the command with Restore clipboard on", async () => {
    chat.clipboardText = "copied text";
    const clipboard = new HostClipboard(new Logger(new FakeServer()));
    clipboard.updateOptions(true);

    await typeInChat("hi", true, clipboard);

    expect(chat.sent).toEqual(["hi"]);
    expect(chat.clipboardText).toBe("copied text");
  });

  it("logs a failed clipboard read and types the next command", async () => {
    const logger = new Logger(new FakeServer());
    const clipboard = new HostClipboard(logger);
    chat.clipboardError = new Error("The clipboard is locked");

    await typeInChat("first", true, clipboard);
    await typeInChat("second", true, clipboard);

    expect(logger.history).toContain(
      "error [Clipboard] The clipboard is locked",
    );
    expect(chat.sent).toEqual(["second"]);
  });
});
