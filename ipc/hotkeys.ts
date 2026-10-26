/** Why main did not register a hotkey: a key name it has no accelerator for, a key the game uses, or a key another program holds. */
export type HotkeyFailure = "unknown-key" | "game-key" | "taken";

export interface UnregisteredHotkey {
  shortcut: string;
  reason: HotkeyFailure;
}

/** The hotkeys of the config that main did not register, sent after each `update-host-config` and each change. */
export interface IpcUnregisteredHotkeys {
  name: "MAIN->CLIENT::unregistered-hotkeys";
  payload: { hotkeys: UnregisteredHotkey[] };
}
