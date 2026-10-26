# Existing code in main and the renderer uses non-null assertions

**Status:** open
**Area:** rules
**Origin:** [main/eslint.config.mjs](../../../../main/eslint.config.mjs)
**Verified:** 2026-10-26

A non-null assertion (`value!`) tells TypeScript that a value is not `null` or `undefined` without
checking it, so a missing value fails later, at the line that reads it. ESLint checks
`@typescript-eslint/no-non-null-assertion` in both processes, except for the code that broke it
when it was turned on. In main, `existingOffenders` in `main/eslint.config.mjs` turns the rule off
for the files listed, such as `req.url!` in `server.ts`. In the renderer,
`renderer/eslint-suppressions.json` holds the count of each file. Most are in `parser/Parser.ts`,
`web/Config.ts` and the price check filters, and many assert on a named group of a regex built
from `client_strings.js` or on state that an earlier line set.

Done looks like: each place narrows the value with a check that handles the missing case, uses
optional chaining where `undefined` is fine, or gets a type that cannot be missing. Then its file
leaves `existingOffenders`, and `npm run lint -- --prune-suppressions` in `renderer/` lowers its
count.

## History

- 2026-10-26: Filed when the rule was turned on in both ESLint configs: 11 assertions in 9 files
  in main and 485 in 104 files in the renderer, specs included.
