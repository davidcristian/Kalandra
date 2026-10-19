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
function type(text: string, send: boolean) {
  typeInChat(text, send, new HostClipboard(new Logger(new FakeServer())));
}

beforeEach(() => {
  chat.reset();
});

describe("typeInChat", () => {
  it("whispers the last whisperer the text after @last and a space", () => {
    type("@last Good luck!", true);
    expect(chat.sent).toEqual(["@UltraSkillPlayer Good luck!"]);
  });

  it("whispers a player whose name starts with last", () => {
    type("@lasthope hi", true);
    expect(chat.sent).toEqual(["@lasthope hi"]);
  });

  it("opens a whisper to the last whisperer for @last alone", () => {
    type("@last", false);
    expect(chat.input).toBe("@UltraSkillPlayer ");
    expect(chat.sent).toEqual([]);
  });

  it("puts the last whisperer's name in place of @last at the end", () => {
    type("/invite @last", true);
    expect(chat.sent).toEqual(["/invite UltraSkillPlayer "]);
  });

  it("replaces unsent text in the box for text without a channel prefix", () => {
    chat.draft = "unsent words";
    type("hi", true);
    expect(chat.sent).toEqual(["hi"]);
  });

  it("leaves the text in the box without send", () => {
    type("#trade WTB", false);
    expect(chat.input).toBe("#trade WTB");
    expect(chat.sent).toEqual([]);
  });
});
