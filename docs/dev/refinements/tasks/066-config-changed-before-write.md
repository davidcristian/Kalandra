# ConfigStore sends config-changed before the save is written

**Status:** open
**Area:** config
**Origin:** [main/src/host-files/ConfigStore.ts](../../../../main/src/host-files/ConfigStore.ts)
**Verified:** 2026-10-26

On `CLIENT->MAIN::save-config`, `ConfigStore` queues the write and sends `MAIN->CLIENT::config-changed`
to every client at once, before the write ends. When the write or the rename fails, `ConfigStore` logs
the error and keeps running, but every client has already replaced its config with the text that is
not on disk.

Sending the event after the write ends would tell clients only about text that is on disk, and would
send nothing after a failed write. The sender gets the event too, and `initConfig()` in
`renderer/src/web/Config.ts` replaces the whole config with it. A widget's `wmWants` is part of the
config: `show()` in `OverlayWindow.vue` sets it when the price check hotkey opens the price check. The
overlay saves when it loses focus, so a price check opened before that save's event arrives would
close again when the event sets the older `wmWants`. Today the event leaves before the write starts.
After the move it would also wait for any queued read or write, the flush, and up to 750 ms of rename
retries while another program has `config.json` open. In development `ConfigStore` writes nothing, so
the event would still be sent at once.

Each way to move the event that keeps a newer `wmWants` changes the IPC contract or the overlay's
behavior in the game, so the maintainer chooses one of these:

- Number each save and send the number with `config-changed`, so a client drops an event older than
  its last save. This changes `IpcEvent` in `ipc/types.ts`
  ([ADR-0004](../../adr/ADR-0004-process-boundary.md)).
- Send the event after the write only to the other clients. `onEventAnyClient` in `main/src/server.ts`
  does not pass the sending socket, and when two clients save in turn, one can end with the other's
  text while `config.json` has its own.
- Keep the current order and decline this task. Each client keeps the config the user set, and the
  next save writes the whole config again.

Done looks like: a decision in the History. If the event moves after the write, a `ConfigStore` test
with a fake write that the test finishes checks that no `config-changed` is sent before the write ends
and none after a failed write, and the price check is checked in the game
([in-game-check.md](../../runbooks/in-game-check.md)).

## History

- 2026-10-20: Found while a failed save was changed to log its error and keep the app running.
- 2026-10-26: Checked again. Moving the event after the write would let a save on blur close a price
  check opened after it, so the change waits for the maintainer to choose one of the ways above.
