# No hook runs ESLint or Prettier on ipc/

**Status:** done 2026-10-27
**Area:** ci
**Origin:** [.pre-commit-config.yaml](../../../../.pre-commit-config.yaml)
**Verified:** 2026-10-27

The lint and format hooks in `.pre-commit-config.yaml` match only `^main/` and `^renderer/`, and
run ESLint on `src` and Prettier on `.` inside those two folders. So no hook lints or formats
`ipc/`, locally or in CI. Adding such a hook needs three changes, each tried on 2026-10-27:

- ESLint 9 skips a file outside the folder of its config, so `eslint ../ipc` from `main/` lints
  nothing. Run from the repo root with `-c main/eslint.config.mjs`, or the renderer's config,
  the typed rules fail to parse each file in `ipc/`, because no `tsconfig.json` includes it.
- With a `tsconfig.json` in `ipc/` that extends `main/tsconfig.json`, main's config reports one
  error, `consistent-type-definitions` in `types.ts`, and the renderer's config reports none. The
  two configs have different rule sets, so `ipc/` needs one of them chosen.
- Prettier finds no config for `ipc/` from the repo root, so it needs `--config` with the
  `.prettierrc` that `main/` and `renderer/` share. With it, Prettier rewrites 136 lines of
  `KeyToCode.ts` (quotes, semicolons and trailing commas); the other four files pass.

Done looks like: a commit that formats `KeyToCode.ts` alone, then hooks that run ESLint and
Prettier on `ipc/` for a change there and in CI. main's config is the first choice, since `ipc/`
holds plain TypeScript and no Vue. Prove each hook by staging a lint or format error in `ipc/`
alone.

## History

- 2026-10-27: Split from [037](037-type-check-hooks-skip-ipc.md) when the type check hooks started
  to run for a change in `ipc/`.
- 2026-10-27: Done in `chore(ipc): format KeyToCode.ts with the shared prettier config` and
  `build: run eslint and prettier on ipc/ in the pre-commit hooks`, which uses main's ESLint config
  and makes `BaseLogEvent` in `types.ts` an interface for its `consistent-type-definitions` rule.
