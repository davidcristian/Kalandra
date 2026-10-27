# No ESLint config checks type assertions on object literals

**Status:** done 2026-10-27
**Area:** rules
**Origin:** [renderer/eslint.config.mjs](../../../../renderer/eslint.config.mjs)
**Verified:** 2026-10-27

An assertion such as `{ name: "x" } as Item` gives an object literal a type without checking its
fields against that type, so a missing or misnamed field fails later, at the line that reads it. A
type annotation (`const item: Item = { ... }`) or `satisfies Item` checks the fields.
`@typescript-eslint/consistent-type-assertions` with `objectLiteralTypeAssertions: "never"` finds
these assertions, and neither `main/eslint.config.mjs` nor `renderer/eslint.config.mjs` turns it
on. A run with it on finds 31 in 9 renderer files and 2 in `main/specs/FileWriter.test.ts`. In the
renderer, 30 are in the specs, most in `specs/Parser/parsers.test.ts` and
`specs/web/price-check/filters/pseudo/index.test.ts`, and 1 is in `src/parser/modifiers.ts`. This
command in `renderer/` or `main/` counts them again:

```shell
npx eslint src specs --rule '{"@typescript-eslint/consistent-type-assertions": ["error", {"assertionStyle": "as", "objectLiteralTypeAssertions": "never"}]}'
```

Done looks like: each of these assertions becomes an annotation or `satisfies`, and both ESLint
configs set the rule with `objectLiteralTypeAssertions: "never"`.

## History

- 2026-10-26: Filed from a TODO comment in `renderer/eslint.config.mjs` that turned the rule off
  until a change to the IPC code. No IPC file breaks the rule now. The line that turned it off was
  removed with the comment, since no config that the renderer extends turns it on.
- 2026-10-27: A new count found 32 in 9 renderer files (1 in `src/parser/modifiers.ts`) and the
  same 2 in main. None hid a missing or misnamed field. They became a reduce type parameter, typed
  spec builders, and in main a helper that takes a `Partial` of the session start event that the
  test sends without a field on purpose. Both configs set the rule: "build: fail the lint on a
  type assertion of an object literal".
