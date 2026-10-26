# The Settings window does not show the hotkeys that main cannot register

**Status:** done 2026-10-26
**Area:** main
**Origin:** [main/src/shortcuts/Shortcuts.ts](../../../../main/src/shortcuts/Shortcuts.ts)
**Verified:** 2026-10-26

The Settings window outlines a hotkey field in red when another action in the edited config has
the same key (`renderer/src/web/settings/hotkey-conflicts.ts`). The other reasons main does not
register a hotkey reach only main's log, which Settings, Debug shows:

- `withKnownKeys()` in `main/src/shortcuts/accelerator.ts` drops a hotkey with a key name that
  `KeyToElectron` lacks.
- `updateActions()` in `Shortcuts.ts` drops a key that the game uses. The copy keys among them
  depend on the advanced item descriptions key, which main reads from the game's config file and
  the renderer does not know.
- `register()` in `Shortcuts.ts` fails for a key that another program has registered. Only main
  finds this out, each time the game window becomes active.

Done looks like: a new `IpcEvent` member in its own file under `ipc/`, as `ipc/library.ts` is, that
sends the hotkeys main did not register with the reason for each. Its sender is in `Shortcuts.ts`,
which also sends the list to a client that connects later, as `server.ts` does with the log
history. A handler in the renderer keeps the list, and `HotkeyInput.vue` marks the field with a
hint for the reason from `app_i18n.json`. `Shortcuts.ts` and `ipc/types.ts` are over the line limit
(`scripts/long-files.txt`), so the code that drops hotkeys first moves out of `Shortcuts.ts` in its
own commit. [ipc.md](../../modules/ipc.md) lists the new event.

## History

- 2026-10-21: Left out when the Settings window started to mark hotkeys that two actions share,
  because main's reasons need a new event, a split of `Shortcuts.ts` and a handler in the renderer.
- 2026-10-26: Closed by "fix: mark hotkey fields whose key main did not register", after
  "refactor(main): move the hotkey filter out of Shortcuts.ts". main sends the list in reply to
  each `update-host-config`, which every page sends when it loads, so `server.ts` sends nothing
  on connect. A field with a key the game uses or another program holds is marked after Save. The
  red outline for a key another program holds is in host check
  [003](../../host/tasks/003-overlay-key-and-focus.md).
