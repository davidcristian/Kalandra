# Kalandra engineering rules

Every agent and every person working in this repo follows these rules. A change that breaks one of them is **not
done**, even when it works. This file is the contract. How to build and release is in [DEVELOPING.md](DEVELOPING.md),
and the user documentation is the VitePress site in [docs/](docs/index.md).

Read this file, then only the files of the part you are changing. Needing the whole codebase in view to make one
change means a boundary is missing: say so rather than reading everything.

## What this is

A Path of Exile 2 overlay for price checking items, with widgets for maps, stash search, XP tracking and more.
Kalandra continues [Exiled Exchange 2](https://github.com/Kvan7/Exiled-Exchange-2), which is a fork of
[Awakened PoE Trade](https://github.com/SnosMe/awakened-poe-trade). `origin` is `davidcristian/Kalandra`. One Electron
app in three parts, plus a data tool and a docs site:

- `main/`: the Electron main process (TypeScript, bundled by esbuild). Global hotkeys (`uiohook-napi`), the overlay
  window over the game (`electron-overlay-window`), clipboard, the game config and client log files, the HTTP proxy
  to the trade sites, auto update and the tray.
- `renderer/`: the Vue 3, Vite and Tailwind UI shown in the overlay. `src/parser/` turns copied item text into a
  `ParsedItem`, `src/web/` holds the widgets, `src/web/price-check/trade/` builds trade queries and
  `src/assets/data/` loads the game data.
- `ipc/`: types shared by both processes: `HostConfig`, `ShortcutAction` and the `IpcEvent` union.
- `dataParser/`: a Python tool that builds the per-language game data in `renderer/public/data/<lang>/` from game
  and trade exports. This copy is the only source of the data: a new game patch needs a new run of it
  ([dataParser/README.md](dataParser/README.md)). Exiled Exchange 2 developed it in a private repo, so the data
  committed here can be newer than this copy of the tool.
- `priceService/`: a Python service, standard library only, that builds the hourly price files from poe.ninja and
  serves them at `kalandra.ashoal.com` through a Cloudflare Tunnel ([priceService/README.md](priceService/README.md)).
- `docs/`: the VitePress user docs, published to GitHub Pages when `docs/**` changes on `master`.

## The one hard rule

**A user's saved config must survive every update.** Users install new versions over old ones and keep
`%APPDATA%\kalandra\apt-data\config.json`, which `main/src/host-files/ConfigStore.ts` stores and
`renderer/src/web/Config.ts` defines. A change to the `Config` type or to a widget's config type
(`renderer/src/web/overlay/widgets.ts`) does all of this in the same commit:

1. Add the field and its default to `defaultConfig()`.
2. Increase `configVersion` in `defaultConfig()` by one, and append an `if (config.configVersion < N)` step to
   `upgradeConfig()` that sets the field on an existing config and ends with `config.configVersion = N`.
3. Add the field to `defaultConfigMock` in `renderer/specs/vitest.setup.ts`, which the tests use in place of the
   real config.

Never edit, reorder or delete an existing upgrade step: a user can skip any number of versions, and every step runs
in order from theirs. A setting that `main` needs also goes through `getConfigForHost()` into `HostConfig`.

## Architecture rules

- **`main` owns the operating system; `renderer` is web code.** Hotkeys, windows, the clipboard, files, game logs
  and network access to other hosts live in `main`. The renderer is a page that `main` serves over HTTP, without
  Node integration, and it never gets Node APIs.
- **The boundary is [ipc/types.ts](ipc/types.ts).** The two processes talk only through `IpcEvent` messages on the
  `/events` WebSocket and the `/config`, `/uploads` and `/proxy` HTTP routes that `main/src/server.ts` serves. An
  event name states its direction (`CLIENT->MAIN::save-config`, `MAIN->CLIENT::item-text`). A new message starts as
  a new member of the `IpcEvent` union, then gets its sender and its handler.
- **Other hosts are reached only through the proxy.** The renderer requests `/proxy/<host>/...`, and
  `main/src/proxy.ts` forwards only to the hosts in `PROXY_HOSTS`. Adding a host is a deliberate change to that
  list. The official trade site rate limits and bans clients that exceed its limits, so every trade request goes
  through the `RateLimiter` sets in `renderer/src/web/price-check/trade/common.ts`.
- **Prices come from `priceService/`, never from poe.ninja directly.** poe.ninja asks apps to use their own backend,
  so `renderer/src/web/background/Prices.ts` reads `kalandra.ashoal.com/prices/<league>.json` and poe.ninja is not
  in `PROXY_HOSTS`. Both read the categories from `renderer/public/data/namespaceMap.json`. The app searches the
  price file's raw text, so its key order is a format: `priceService/tests/fixtures/price_file.json` is read by both
  test suites, and a format change updates the service, the app and that file in one commit.
- **Widgets register in one place.** A widget is a Vue component with a static `widget: WidgetSpec`, added by one
  `registry.widgets.push` line in `renderer/src/web/overlay/widget-registry.ts`. Its config type goes in
  `renderer/src/web/overlay/widgets.ts`, and its defaults follow the hard rule above.
- **Game text comes from the game data, never from string literals.** The app supports every language listed in
  `renderer/src/assets/make-index-files.mjs`. The parser matches item text through `CLIENT_STRINGS`, loaded from
  `client_strings.js`, and through the stat matchers in `stats.ndjson`, so matching new item text means a client
  string, not an English regex.
- **Generated files are regenerated, not edited.** `stats.ndjson`, `items.ndjson` and `client_strings.js` under
  `renderer/public/data/<lang>/` are `dataParser` output: fix the generator or its inputs and run it again. If the
  copy here cannot produce the fix, stop and ask. The `*.index.bin` files are written by `npm run make-index-files`
  and ignored by git.
- **English is the source of UI text.** A new UI string goes into `renderer/public/data/en/app_i18n.json`. No
  translation service is connected to this project, so other languages get the string only when someone who speaks
  them adds it, and until then a missing key falls back to English. The product name is not translated.
- **One version, five places.** `versionCheck.py` fails unless `README.md`, `.github/ISSUE_TEMPLATE/bug-report.yml`,
  `docs/.vitepress/config.js`, `main/package.json` and `main/package-lock.json` agree. Releasing follows
  DEVELOPING.md and is the maintainer's job.

## What every change must pass

CI uses Node 24. No single command runs everything: run each step a change can affect, and all of them for a change
to shared code (`ipc/`, `Config.ts`, the parser) before calling it done.

1. **The pre-commit hooks**, from the repo root after `npm ci` in `main/` and `renderer/`:
   `pre-commit run --all-files`. They check whitespace, end of file, YAML, files over 2 MB and `versionCheck.py`,
   then run ESLint with `--fix`, Prettier with `--write` and `tsc --noemit` on `main/` and `renderer/`. The fixers
   rewrite files, so stage the result and run again until it passes. CI runs the same hooks. Never pass
   `--no-verify` unless the user asks.
2. **The renderer**, in `renderer/`: `npm ci`, `npm run make-index-files`, `npm run lint`, `npx vitest run`,
   `npm run build`. The index files must exist before the tests, `npm run dev` or a build, and must be written again
   after any data change. `npm test` starts Vitest in watch mode in an interactive terminal, so use `npx vitest run`.
3. **The main process**, in `main/`: `npm ci`, `npm run build` (`tsc --noEmit`, then the esbuild bundle). CI packages
   it on Windows, Linux and macOS, so a platform-specific path or API needs a `process.platform` check.
4. **The data tool**, only when `dataParser/` changes: `python -m pytest` in `dataParser/`, plus Ruff, Bandit and the
   other hooks in `dataParser/.pre-commit-config.yaml`.
   **The price service**, when `priceService/`, `namespaceMap.json`, `Prices.ts` or `price-source.ts` changes:
   `python -m unittest discover -s tests` in `priceService/`, which CI also runs.
5. **Tests.** New behavior has tests, and a bug fix adds a test that fails without the fix. A parser fix adds the
   real copied item text as a case under `renderer/specs/Parser/`. Tests use saved responses, such as those in
   `renderer/specs/docs/`, and never call a live site. There is no coverage threshold, but a change must not lower
   the coverage of the files it touches (`npx vitest run --coverage`).
6. **File size.** A new source file is at most 300 lines. Many existing files are far over that (`Parser.ts`,
   `pathofexile-trade.ts`): put new, separable code in a new module and call it, rather than growing them. Splitting
   an existing file is its own commit, never a side effect of another change.
7. **Types and quality.** TypeScript is `strict` in both processes. New code adds no `any`, no `as unknown as` cast
   and no `@ts-ignore`, `@ts-expect-error` or `eslint-disable` without its reason on the same line. Errors are
   handled or passed on with a type, never dropped by an empty `catch`. Python has type annotations, no `eval` and no
   blanket `noqa`.
8. **Documentation is part of done.** A change users can see updates its page in `docs/` (features, widgets, price
   check, FAQ). A change to how the app is built or released updates DEVELOPING.md. A change that makes a rule here
   false updates this file in the same commit.
9. **The game is out of reach; everything else is not.** An agent cannot run Path of Exile 2, so hotkeys, overlay
   focus, clipboard capture and OCR inside the game need the maintainer on Windows. Check everything else yourself:
   parser cases with real item text, unit tests and both builds. In the summary, name each in-game behavior left to
   check and mark it unverified.

## Prose

Write comments, docs and commit messages in plain English that a new reader understands on the first read. No
script checks these rules in this repo, so read your own diff for them.

- **Comments.** None unless strictly necessary: why a workaround exists, a constraint that is not visible (an
  ordering, a game or API quirk with its link, a measured number), or a directive a tool reads
  (`eslint-disable-next-line` with its reason). Delete a comment that repeats the code, tells history ("was X, now
  Y") or explains what a better name would say. One or two lines, three at most.
- **Docs.** Say what a thing is and does, then why, when the why is not obvious. Keep facts, commands, paths and
  decisions. Cut the story of how the code got here, repeated explanations (link to the one place instead) and
  hedging.
- **Plain words.** Short sentences, one idea each, with the literal verb: "checks", "fails", "returns", "stores",
  "sends". Code does not know, want, refuse or decide anything, so say what it does. No metaphors, idioms or invented
  terms. Game terms are exempt, and so is anything in backticks.
- **No dash as punctuation.** No em dash, en dash or spaced `--` in anything written here: restructure the sentence
  rather than swapping in another mark. Hyphenated words and CLI flags are fine. Text the app matches or parses from
  the game or a trade site keeps its characters exactly as written there, and so do fixtures copied from it.
- **Banned words.** Do not write the words on the left, in any capitalization. The list is a minimum: rewrite any
  other figurative word the same way.

| Do not write | Write instead |
| --- | --- |
| gate, gates, gated, gating | check, must pass, enforced by |
| land, lands, landed, landing | commit, merge, add |
| carry, carries, carried, carrying | contain, include, pass |
| seam, seams | boundary, interface |
| honest, honestly | accurate, correct, real |
| verdict, verdicts | result |
| load-bearing, crucial, critically, fundamentally | required, (state the fact) |
| robust, seamless, comprehensive | (state the specific fact) |
| leverage, utilize, worth noting | use, (state the fact) |
| footgun, tripwire, backstop, under the hood, boils down | describe the mechanism, say it literally |

## Commits

[Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/). No hook enforces it here and the history
inherited from Exiled Exchange 2 does not follow it, but every new commit does.

- **Format:** `type(scope)?: subject`, imperative mood, lowercase subject, no trailing period, at most 72 characters.
  Types: `feat`, `fix`, `docs`, `test`, `refactor`, `perf`, `build`, `ci`, `chore`, `revert`. Scopes are optional
  and name one area: `main`, `renderer`, `parser`, `trade`, `ipc`, `data`, `dataparser`, `docs`, `ci`. Never repeat
  the type as the scope (`docs(docs)`). A breaking change adds `!` and a `BREAKING CHANGE:` footer.
- **The subject says what changed; the body says why.** Start with a verb of change (`add`, `fix`, `remove`,
  `split`, `rename`) and write a subject that reads correctly to someone who has not seen the diff. The body is two
  or three sentences and at most 50 words, the problem first and then what the change does about it, wrapped at 72.
  Write no body when the subject says everything.
- **Self-contained.** No issue or PR numbers, commit hashes, or pointers into documents that change. Name the
  behavior instead. Link an issue in the PR description, where the link can be edited.
- **No banned word and no dash as punctuation**, as in [Prose](#prose).
- One logical change per commit. A version bump and a data update are each their own commit.

## Exiled Exchange 2

- **Kalandra does not merge Exiled Exchange 2.** The `upstream` remote, where it exists, points at
  `Kvan7/Exiled-Exchange-2` and is only read. A fix from there comes in by cherry-pick, one commit at a time, with its
  original author kept.
- **Agent work never goes there.** Its contribution policy allows AI help only as end of line completion and rejects
  agent-written code. Never open an issue or PR against `Kvan7/Exiled-Exchange-2`; a PR an agent opens targets
  `origin`.
- **Credit stays.** Kalandra is under the AGPL v3 (`LICENSE`). The code inherited from Awakened PoE Trade and
  Exiled Exchange 2 is under the MIT License, whose notice must stay with it in `LICENSES/MIT.txt`; a fix
  cherry-picked from there is under the same notice. The README credits both projects, and the Patreon links to
  Awakened PoE Trade's author stay.

## Safety

- **Ask before anything outward-facing.** Pushing, opening a PR, tagging and releasing need the user's go-ahead. A
  push to `master` runs the Build workflow, which packages the app on three platforms and uploads it to the draft
  GitHub release for the current version if one exists. Never force-push a published branch.
- **No secrets and no user files in the repo.** Never commit a `config.json`, a client log or anything from
  `%APPDATA%`. The only token is the `GITHUB_TOKEN` that CI provides.
- **External input is untrusted.** Clipboard item text, client log lines and trade responses can be malformed or
  come from a game patch the data does not know yet. Parse them without throwing and log what failed.
- **Be polite to other services.** No loops or tests against the live trade site, poe.ninja or poeprices. A
  `dataParser` run that pulls trade data or downloads images is slow and network heavy, so ask first. Only
  `priceService/` calls poe.ninja's API: one request at a time, at most once an hour per category, with its
  User-Agent. A live `python -m price_service --once` sends about 140 requests, so ask before running it.

## Working agreement

- **Read before you write.** Open the file and its call sites before editing; never edit from memory of its
  contents, and never invent an API. Check the signature.
- **Claims come with evidence.** Never report a check as passing without having run it in this session; show the
  command and its output. Label an unverified statement as an assumption.
- **Prove a check can fail.** After writing or changing a test or a check, break the thing it checks and watch it
  fail before trusting it. A check that cannot fail is a defect.
- **Report faithfully.** Report a failing test with its output and name every step you skipped. Report a task as
  done only when it is: an inaccurate "done" costs more to undo than an accurate "not yet".
- **Stop when surprised.** When output contradicts your model of the system, work it out again from the evidence.
  Do not match it to the nearest familiar failure and push through.
- **Small, complete slices.** Each change is a thin end-to-end path that passes its checks and has its docs. No
  scaffolding of empty layers.
- **Decisions are written down.** A non-obvious choice gets its reason in the commit body, and one that governs
  future changes goes into this file or DEVELOPING.md. When a request is underspecified, record your reading of it,
  continue, and name the riskiest assumption in your summary.
- Keep this file and all docs short and full of pointers; context bloat is a defect.
