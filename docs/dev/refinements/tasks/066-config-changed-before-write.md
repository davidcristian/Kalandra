# ConfigStore sends config-changed before the save is written

**Status:** open
**Area:** config
**Origin:** [main/src/host-files/ConfigStore.ts](../../../../main/src/host-files/ConfigStore.ts)
**Verified:** 2026-10-20

On `CLIENT->MAIN::save-config`, `ConfigStore` queues the write and sends `MAIN->CLIENT::config-changed`
to every client at once, before the write ends. When the write or the rename fails, `ConfigStore` logs
the error and keeps running, but every client has already replaced its config with the text that is
not on disk.

Sending the event after the write ends would tell clients only about text that is on disk, and would
send nothing after a failed write. It needs the maintainer's decision first, because it also delays
the event that the sender gets back. `initConfig()` in `renderer/src/web/Config.ts` replaces the
config with each `config-changed` it receives, so after two saves in a row the event of the first can
arrive after the client has changed its config again, and set the older text until the second event
arrives. A later event makes that more likely. In development `ConfigStore` writes nothing, so the
event would still be sent at once.

Done looks like: a decision. If the event moves after the write, a `ConfigStore` test with a fake
write that the test finishes checks that no `config-changed` is sent before the write ends, and none
after a failed write.

## History

- 2026-10-20: Found while a failed save was changed to log its error and keep the app running.
