# --listen without = stops the local server from starting

**Status:** open
**Area:** main
**Origin:** [main/src/server.ts](../../../../main/src/server.ts)
**Verified:** 2026-10-18

`startServer()` takes the first argument that starts with `--listen` and reads
`listenOpt.split("=")[1].split(":")`. For `--listen` alone, or `--listen 0.0.0.0` with a space,
`split("=")[1]` is `undefined`, so `.split(":")` throws a `TypeError`. `startServer()` is awaited in
the `setTimeout` callback in `main/src/main.ts`, so the rejection ends that callback before
`overlay.loadAppPage(port)`. The overlay never loads its page.

The only trace is the `error [unhandledRejection]` line that the handler in `main.ts` writes to the
log. Settings, Debug cannot show it, because Settings is part of the page that did not load. The
check `arg.startsWith("--listen")` also matches any other argument that starts with that text, such
as `--listener=x`, and reads `x` as the host.

[docs/cmd-flags.md](../../../cmd-flags.md) tells users to write the value after `=` with no space
and says the server does not start otherwise.

Done looks like: the option is parsed without throwing, a value that cannot be read is logged and
the default address is used. The parsing moves into a function outside `server.ts`, which imports
Electron, so that a test can call it with `--listen`, `--listen=`, `--listen=:9001` and
`--listen=0.0.0.0:9001`. `main/package.json` has no test script, so this task also decides where
that test runs. The sentence in docs/cmd-flags.md changes in the same commit.

## History

- 2026-10-18: Found while docs/cmd-flags.md was rewritten, by reading `startServer()` and the start
  sequence in `main.ts`. The parsing expression, run in Node 24, throws `TypeError` for
  `--listen` and for `--listen 0.0.0.0`, and reads host `x` from `--listener=x`.
