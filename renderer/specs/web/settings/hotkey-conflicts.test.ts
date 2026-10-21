import { afterEach, describe, expect, it } from "vitest";
import type { Config } from "@/web/Config";
import { settingsDraft } from "@/web/settings/draft";
import {
  duplicateHotkeys,
  isDuplicateInDraft,
} from "@/web/settings/hotkey-conflicts";
import { hotkeyConfig, widgetEntry } from "../hotkey-config";

function openDraft(edit: (config: Config) => void): Config {
  const config = hotkeyConfig();
  edit(config);
  settingsDraft.open(config);
  return settingsDraft.copy.value!;
}

afterEach(() => {
  settingsDraft.close(hotkeyConfig());
});

describe("hotkeys that more than one action uses", () => {
  it("finds none when each action has its own hotkey", () => {
    expect(duplicateHotkeys(hotkeyConfig())).toEqual(new Set());
  });

  it("finds each hotkey that settings on different pages share", () => {
    const config = hotkeyConfig();
    config.overlayKey = "Ctrl + D";
    config.commands = [
      { text: "/hideout", hotkey: "Ctrl + Alt + D", send: true },
      { text: "/exit", hotkey: "F5", send: true },
    ];

    expect(duplicateHotkeys(config)).toEqual(
      new Set(["Ctrl + D", "Ctrl + Alt + D"]),
    );
  });

  it("leaves out a stash search whose hotkeys are off, as main does", () => {
    const config = hotkeyConfig();
    const entries = [
      { id: 1, name: "", text: "rune", hotkey: "Shift + Space" },
    ];
    config.widgets.push(
      widgetEntry(5, "stash-search", { enableHotkeys: false, entries }),
    );

    expect(duplicateHotkeys(config)).toEqual(new Set());
  });
});

describe("the duplicate mark of a field in the Settings window", () => {
  it("marks a field whose hotkey another action has in the edited config", () => {
    openDraft((config) => {
      config.overlayKey = "Ctrl + Alt + D";
    });

    expect(isDuplicateInDraft("Ctrl + Alt + D")).toBe(true);
    expect(isDuplicateInDraft("Alt + X")).toBe(false);
    expect(isDuplicateInDraft(null)).toBe(false);
  });

  it("checks the price check key field by the hotkey main registers for it", () => {
    openDraft((config) => {
      config.overlayKey = "Ctrl + D";
    });

    expect(isDuplicateInDraft("D", "Ctrl + D")).toBe(true);
    expect(isDuplicateInDraft("D")).toBe(false);
    expect(isDuplicateInDraft(null, "Ctrl + null")).toBe(false);
  });

  it("follows each change to the edited config", () => {
    const draft = openDraft(() => {});
    expect(isDuplicateInDraft("F5")).toBe(false);

    draft.commands.push(
      { text: "/hideout", hotkey: "F5", send: true },
      { text: "/exit", hotkey: "F5", send: true },
    );
    expect(isDuplicateInDraft("F5")).toBe(true);

    draft.commands[1].hotkey = "F6";
    expect(isDuplicateInDraft("F5")).toBe(false);
  });

  it("marks no field while the window is closed", () => {
    const config = openDraft((config) => {
      config.overlayKey = "Ctrl + D";
    });
    settingsDraft.close(config);

    expect(isDuplicateInDraft("D", "Ctrl + D")).toBe(false);
  });
});
