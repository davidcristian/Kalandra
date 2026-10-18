# The test registration of the copy keys never runs

**Status:** open
**Area:** main
**Origin:** [main/src/shortcuts/Shortcuts.ts](../../../../main/src/shortcuts/Shortcuts.ts)
**Verified:** 2026-10-18

`updateActions()` in `main/src/shortcuts/Shortcuts.ts` adds an action of type `test-only` for the
copy keys: `Ctrl + C` merged with the game's advanced item descriptions key, so `Ctrl + Alt + C` by
default. `register()` registers each action with Electron's `globalShortcut`, writes
`Failed to register a shortcut "<keys>". It is already registered by another application.` when
that fails, and unregisters a `test-only` action right after. That log line is the only effect such
an action can have.

The copy keys are also in `allShortcuts`, the set of keys reserved for the game, and
`actions.filter((action) => !allShortcuts.has(action.shortcut))` removes every action with such a
key, the `test-only` one included. It is never registered, so the line never names the copy keys.

Two user pages say it can: the Read the logs section of
[docs/nothing-happens.md](../../../nothing-happens.md) and the list in
[docs/no-item-mods.md](../../../no-item-mods.md).
[modules/ipc.md](../../modules/ipc.md) states the current behavior.

Done looks like: a decision, then one commit. Either the filter keeps the `test-only` action, and a
check on Windows with a program that holds `Ctrl + Alt + C` shows the line; or the action is removed
and the two pages stop saying that the line can name the copy keys.

## History

- 2026-10-18: Found while the ipc module doc was written, by reading `updateActions()` and
  `register()`.
