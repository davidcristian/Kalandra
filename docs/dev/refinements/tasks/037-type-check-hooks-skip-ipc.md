# The type check hooks do not run for a change only in ipc/

**Status:** done 2026-10-27
**Area:** ci
**Origin:** [.pre-commit-config.yaml](../../../../.pre-commit-config.yaml)
**Verified:** 2026-10-27

The `type-check-main` and `type-check-renderer` hooks in `.pre-commit-config.yaml` run only for
files that match `^main/` and `^renderer/`. Both processes import from `ipc/`, such as
`types.ts`, and `KeyToCode.ts` for the hotkey names. So a local commit that changes only `ipc/`
runs no type check. CI still runs one, because `pre-commit/action` runs the hooks over all files,
so the gap is in the local check only.

The lint and format hooks also match only `^main/` and `^renderer/`, and their commands run
ESLint on `src` and Prettier on `.` inside those two folders. So no hook lints or formats `ipc/`,
in CI either.

Done looks like: both type check hooks also match `^ipc/`. Prove the change by staging a type error
in `ipc/types.ts` alone and watching `pre-commit run` fail. ESLint and Prettier cover `ipc/` in the
same change, or the task's History says why not.

## History

- 2026-10-18: Found while the ipc module doc was written, by reading the `files` patterns of the
  hooks.
- 2026-10-18: The task review tested the four patterns against `ipc/types.ts` and
  `ipc/KeyToCode.ts` (none matches) and added the lint and format gap.
- 2026-10-27: Done in `build: type check main and renderer for a change in ipc/`. ESLint and
  Prettier still skip `ipc/`, since covering it needs a tsconfig for `ipc/`, a choice between the
  two ESLint configs and a reformat of `KeyToCode.ts`; that work is
  [105](105-no-lint-or-format-for-ipc.md).
