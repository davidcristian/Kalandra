# client-log.ndjson drops its first entry and can mix up its lines

**Status:** done 2026-10-19
**Area:** main
**Origin:** [main/src/host-files/FileWriter.ts](../../../../main/src/host-files/FileWriter.ts)
**Verified:** 2026-10-19

With Item Data Collection on, `FileWriter` in `main/src/host-files/FileWriter.ts` writes each
`client-log-event` to `client-log.ndjson` in the Library output folder. It has three defects:

- The `client-log-event` branch calls `this.openChannel(filePath, FileChannel.ClientLog, true)`
  without `await` and calls `writeLine()` at once, while the handle is still `null`. So the first
  entry after each open is dropped with
  `error [FileWriter] Unable to write to channel client-log, channel closed.` An open happens after
  each start and after each click on Re-generate parsed log data in Settings, Leveling, since
  `flushClientLogFile()` closes the channel. Every entry that arrives before the open finishes
  starts another open in mode `"w"`, which empties the file again and leaves the earlier handles
  open.
- `this._state.clientLogFile.write(line + "\n")` is not awaited, so the order of the lines in the
  file is not guaranteed. Node's documentation for `filehandle.write()` says a second call before
  the first one settles is unsafe.
- Only `writeSessionStart()` creates the output folder. Before a Library session has created it,
  `fs.open` fails, the rejection is not handled, and no entry is written.

[docs/client-log-parser.md](../../../client-log-parser.md) describes all three as the current
behavior: the folder in its Turn it on section, and the other two in How Kalandra writes the file.

Done looks like: one awaited open at a time, writes in order, the folder created before the open, a
test for each defect, and the page updated in the same commit. `FileWriter` imports `app` from
Electron, so its tests in `main/specs/` replace Electron with `vi.mock`, as the main module doc
describes; `npm test` in `main/` runs them.

## History

- 2026-10-18: Found while docs/client-log-parser.md was rewritten, by reading `FileWriter`. Not
  reproduced in a running app.
- 2026-10-19: The first two defects are fixed by fix(main): write client log entries in
  order after the file opens. The output folder is still to do.
- 2026-10-19: Done by fix(main): create the output folder before opening the client log.
