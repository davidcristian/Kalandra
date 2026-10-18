# The static file and /uploads routes serve files outside their folders

**Status:** done 2026-10-18
**Area:** main
**Origin:** [main/src/server.ts](../../../../main/src/server.ts)
**Verified:** 2026-10-18

The static file handler in `main/src/server.ts` streams `path.join(__dirname, filePath)`, where
`filePath` is `req.url`. The `GET /uploads/` handler in `main/src/host-files/file-uploads.ts`
streams `path.join(uploadsPath, req.url.slice("/uploads/".length))`. Neither checks that the joined
path stays inside its folder. Node's HTTP server does not normalize `req.url`, and `path.join`
resolves `..` segments, so a request such as `GET /uploads/../../<file>` reads a file outside the
folder. A browser removes `..` segments from a URL before it sends one, so the request needs a
program that sends the path as written, such as `curl --path-as-is`.

By default the server listens on `127.0.0.1`, so any process on the computer can send such a
request. With `--listen=0.0.0.0`, any device on the network can, as
[docs/cmd-flags.md](../../../cmd-flags.md) warns.

Done looks like: both handlers resolve the path, return 404 when it is outside their folder, and
have a test that sends a path with `..` segments. `main/` has no test runner yet, and
[008](008-listen-option-without-value.md) decides where its tests run. The same commit removes "and
read files on this computer" from the warning in docs/cmd-flags.md.

## History

- 2026-10-18: Found while docs/cmd-flags.md and the main module doc were written, by reading both
  handlers. A copy of the `GET /uploads/` handler in a scratch Node 24 script received
  `/uploads/../../secret.txt` unchanged and returned that file from two folders up. Not sent to a
  running app.
- 2026-10-18: Closed. Both routes call `sendFile()` in `main/src/served-file.ts`, which returns 404
  for a path outside the folder and for a missing file, where the old code left the request open.
  `main/specs/server.test.ts` sends `/uploads/../../secret.txt` and `/../package.json` to the real
  routes; with the old uploads handler the first one returned the file.
