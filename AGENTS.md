# Kalandra engineering rules

Every agent and every person working in this repo follows these rules. A change that breaks one of them is **not
done**, even when it works. This file is the contract. The detail is in `docs/dev/`, starting at
[docs/dev/index.md](docs/dev/index.md), with the map [docs/dev/architecture.md](docs/dev/architecture.md) and the
decisions in `docs/dev/adr/`. The development loop is in [DEVELOPING.md](DEVELOPING.md); the user docs are in `docs/`.

Read this file, then the module doc in `docs/dev/modules/` and the files of the part you are changing. Needing the
whole codebase in view to make one change means a boundary is missing: say so rather than reading everything.

## What this is

A Path of Exile 2 overlay for price checking items, with widgets for maps, stash search, XP tracking and more.
Kalandra continues [Exiled Exchange 2](https://github.com/Kvan7/Exiled-Exchange-2), which is a fork of
[Awakened PoE Trade](https://github.com/SnosMe/awakened-poe-trade). `origin` is `davidcristian/Kalandra`. One Electron
app in three parts, plus a data tool and a docs site:

- `main/`: the Electron main process (TypeScript, bundled by esbuild): hotkeys, key presses, the overlay window, the
  clipboard, the game's config and client log, the HTTP proxy to the trade sites, auto update and the tray.
- `renderer/`: the Vue 3, Vite and Tailwind UI in the overlay. `src/parser/` turns copied item text into a
  `ParsedItem`, `src/web/` holds the widgets and the trade queries, and `src/assets/data/` loads the game data.
- `ipc/`: types shared by both processes: `HostConfig`, `ShortcutAction` and the `IpcEvent` union.
- `dataParser/`: a Python tool that builds the per-language game data in `renderer/public/data/<lang>/` from game
  and trade exports, and the only source of that data ([dataParser/README.md](dataParser/README.md)). Exiled
  Exchange 2 developed it in a private repo, so the data committed here can be newer than this copy of the tool.
- `priceService/`: a Python service, standard library only, that builds the hourly price files from poe.ninja and
  serves them at `kalandra.ashoal.com` through a Cloudflare Tunnel ([priceService/README.md](priceService/README.md)).
- `docs/`: the VitePress user docs, published to GitHub Pages when `docs/` outside `docs/dev/` changes on `master`,
  or by hand from the Actions tab. `docs/dev/` holds the developer docs, read on GitHub.

## The one hard rule

**A user's saved config must survive every update.** Users install new versions over old ones and keep
`%APPDATA%\kalandra\apt-data\config.json`, which `main/src/host-files/ConfigStore.ts` stores and
`renderer/src/web/Config.ts` defines. A change to the `Config` type or to a widget's config type (in
`renderer/src/web/overlay/widgets.ts` or the widget's own `widget.ts`) does all of this in the same commit:

1. Add the field and its default to `defaultConfig()`.
2. Increase `configVersion` in `defaultConfig()` by one, and append an `if (config.configVersion < N)` step to
   `upgradeConfig()` that sets the field on an existing config and ends with `config.configVersion = N`.
3. Add a new top-level `Config` field to `defaultConfigMock` in `renderer/specs/vitest.setup.ts`, which the tests
   use in place of the real config. Its `widgets` list holds only the price check widget, so add another widget there
   only when a test reads its config.

Never edit, reorder or delete an existing upgrade step: a user can skip any number of versions, and every step runs
in order from theirs. A setting that `main` needs also goes through `getConfigForHost()` into `HostConfig`. The
reasons are [ADR-0003](docs/dev/adr/ADR-0003-config-survives-updates.md) and the code is
[docs/dev/modules/config.md](docs/dev/modules/config.md).

## Architecture rules

- **Only `main` reaches the operating system; `renderer` is web code.** Hotkeys, windows, the clipboard, files, game
  logs and network access to other hosts live in `main`. The renderer is a page that `main` serves over HTTP,
  without Node integration, and it never gets Node APIs.
- **The boundary is [ipc/types.ts](ipc/types.ts).** The two processes talk only through `IpcEvent` messages on the
  `/events` WebSocket and the `/config`, `/uploads` and `/proxy` HTTP routes of `main/src/server.ts`. A route listens
  on `httpRoutes`, behind its Host and Origin check
  ([ADR-0009](docs/dev/adr/ADR-0009-local-server-accepts-only-its-own-page.md)). An event name states its direction
  (`CLIENT->MAIN::save-config`). A new message starts as a new member of the `IpcEvent` union, then gets its sender
  and its handler ([ADR-0004](docs/dev/adr/ADR-0004-process-boundary.md)).
- **Other hosts are reached only through the proxy, except the item icons on `web.poecdn.com`.** The renderer requests
  `/proxy/<host>/...`, and `main/src/proxy.ts` forwards only to the hosts in `PROXY_HOSTS`. Adding a host is a
  deliberate change to that list. The official trade site bans clients that exceed its rate limits, so every search,
  fetch and exchange request goes through the `RateLimiter` sets in `renderer/src/web/price-check/trade/common.ts`
  ([ADR-0005](docs/dev/adr/ADR-0005-proxy-hosts-and-trade-rate-limits.md)).
- **Prices come from `priceService/`, never from poe.ninja directly.** poe.ninja asks apps to use their own backend,
  so `renderer/src/web/background/Prices.ts` reads `kalandra.ashoal.com/prices/<league>.json` and poe.ninja is not
  in `PROXY_HOSTS`. Both read the categories from `renderer/public/data/namespaceMap.json`. The app searches the
  price file's raw text, so its key order is a format: `priceService/tests/fixtures/price_file.json` is read by both
  test suites, and a format change updates the service, the app and that file in one commit
  ([ADR-0006](docs/dev/adr/ADR-0006-own-price-service.md)).
- **Widgets register in one place.** A widget is a Vue component with a static `widget: WidgetSpec`, added by one
  `registerWidget` line in `renderer/src/web/overlay/widget-registry.ts`. Its config type goes in
  `renderer/src/web/overlay/widgets.ts` or in a `widget.ts` in its own folder, and its defaults follow the hard rule
  above ([docs/dev/modules/renderer-widgets.md](docs/dev/modules/renderer-widgets.md)).
- **Game text comes from the game data, never from string literals.** The app supports every language listed in
  `renderer/src/assets/make-index-files.mjs`. The parser matches item text through `CLIENT_STRINGS`, loaded from
  `client_strings.js`, and through the stat matchers in `stats.ndjson`, so matching new item text means a client
  string, not an English regex.
- **Generated files are regenerated, not edited.** `stats.ndjson`, `items.ndjson` and `client_strings.js` under
  `renderer/public/data/<lang>/` are `dataParser` output: fix the generator or its inputs and run it again. If the
  copy here cannot produce the fix, stop and ask. The `*.index.bin` files are written by `npm run make-index-files`
  and ignored by git. Both rules are [ADR-0007](docs/dev/adr/ADR-0007-game-text-from-game-data.md).
- **English is the source of UI text.** A new UI string goes into `renderer/public/data/en/app_i18n.json`. No
  translation service is connected to this project, so other languages get the string only when someone who speaks
  them adds it, and until then a missing key falls back to English. The product name is not translated.
- **One version, five places.** `scripts/versioncheck.py` fails unless `README.md`, `docs/.vitepress/config.js`,
  `.github/ISSUE_TEMPLATE/bug-report.yml`, `main/package.json` and `main/package-lock.json` have the same version.
  Releasing follows [docs/dev/runbooks/release.md](docs/dev/runbooks/release.md) and is the maintainer's job.

## What every change must pass

`python scripts/check.py` runs every step below but the data tool's and names each one that failed: run it, after
`npm ci` in `renderer/`, `main/` and `docs/`, before calling a change done. [DEVELOPING.md](DEVELOPING.md#checks)
gives each step's own command. CI runs the same steps on Node 24, each job only for a change that can affect it,
except the renderer and main builds, which run only on a push to `master`.

1. **The pre-commit hooks** (`pre-commit run --all-files`) check whitespace, YAML, file sizes, ESLint, Prettier and
   `tsc` on `main/` and `renderer/`, Ruff and strict Pyright on `priceService/` and `scripts/`, and the checks of the
   version, line limits, dashes, prose, links, the backlog indexes and the allowScripts entries. The fixers rewrite
   files, so stage the result and run again until it passes. Never pass `--no-verify` unless the user asks.
2. **The renderer**: lint, Vitest and the build, after `npm run make-index-files` writes the index files they need.
   Write them again after any data change.
3. **The main process**: Vitest and the build. CI packages it on Windows, Linux and macOS, so platform-specific code
   needs a `process.platform` check.
4. **The price service, the scripts and the docs site**: both unit test suites, and the site build, which fails on a
   dead internal link or a missing image. **The data tool** is outside `check.py`: when `dataParser/` changes,
   run `python -m pytest` and the hooks in `dataParser/.pre-commit-config.yaml` there.
5. **Tests.** New behavior has tests, and a bug fix adds a test that fails without the fix. A parser fix adds the
   real copied item text as a case under `renderer/specs/Parser/`. Tests use saved responses, such as those in
   `renderer/specs/docs/`, and never call a live site. A test checks behavior, including the error and edge paths,
   through fakes (working stand-ins such as `FakeGet` in `priceService/tests/support.py`) rather than mocks that
   assert calls, and a test written only to run a line is a defect. CI fails when a suite's coverage drops below the
   floor in its `vitest.config.ts` or `.coveragerc`: raise a floor when tests cover more, and never lower one.
6. **File size.** A source file that is not a test or game data is at most 300 lines, and a markdown file at most 250,
   as `scripts/linecap.py` checks. The files already over 300 lines are in `scripts/long-files.txt` with their exact
   counts: put new, separable code in a new module rather than growing one, and lower its count when it shrinks.
   Splitting an existing file is its own commit, never a side effect of another change.
7. **Types and quality.** TypeScript is `strict` in both processes. New code adds no `any`, no `as unknown as` cast
   and no `@ts-ignore`, `@ts-expect-error` or `eslint-disable` without its reason on the same line. Errors are
   handled or passed on with a type, never dropped by an empty `catch`. Python has type annotations, raises typed
   exceptions, never uses a bare `except` or `eval`, and names the rule and its reason in every `noqa`.
8. **Documentation is part of done.** A change users can see updates its page in `docs/` (features, widgets, price
   check, FAQ). A change to a module's contract updates its doc in `docs/dev/modules/`, a change to a procedure
   updates its runbook in `docs/dev/runbooks/` or DEVELOPING.md, and work deliberately left for later gets a task
   file in [docs/dev/refinements/](docs/dev/refinements/index.md). A change that makes a rule here false updates
   this file in the same commit.
9. **The game is out of reach; everything else is not.** An agent cannot run Path of Exile 2, so hotkeys, overlay
   focus, clipboard capture and OCR inside the game need the maintainer on Windows. Check everything else yourself:
   parser cases with real item text, unit tests and both builds. In the summary, name each in-game behavior left to
   check and mark it unverified. [docs/dev/runbooks/in-game-check.md](docs/dev/runbooks/in-game-check.md) says how
   to check each one, and [docs/dev/host/](docs/dev/host/index.md) lists every host check.

## Prose

Write comments, docstrings, docs, issue forms, commit messages and the text of log and error messages in plain
English that a new reader understands on the first read. `scripts/prosecheck.py` and `scripts/dashcheck.py` check
the dash and banned-word rules; read your own diff for the rest.

- **Comments.** None unless strictly necessary: why a workaround exists, a constraint that is not visible (an
  ordering, a game or API quirk with its link, a measured number), or a directive a tool reads
  (`eslint-disable-next-line` with its reason). Delete a comment that repeats the code, tells history ("was X, now
  Y") or explains what a better name would say. One or two lines, three at most.
- **Docstrings.** One line saying what the module, class or function does, three at most, and none on a test.
- **Docs.** Say what a thing is and does, then why, when the why is not obvious. Keep facts, commands, paths and
  decisions. Cut the story of how the code got here, repeated explanations (link to the one place instead) and
  hedging.
- **Plain words.** Short sentences, one idea each, with the literal verb: "checks", "fails", "returns", "stores",
  "sends". Code does not know, notice, want, refuse, decide, believe, agree, argue, answer, promise or own anything,
  so say what it does. Define a technical term once, where it first appears. No metaphors, idioms, wordplay or
  invented terms. Game terms are exempt (Spell Damage, the Delve grid), and so is anything in backticks.
- **No dash as punctuation.** No em dash, en dash or spaced `--` in anything written here: restructure the sentence
  rather than swapping in another mark. Hyphenated words, CLI flags and the `--` before an `eslint-disable` reason
  are fine. Text the app matches or parses from the game or a trade site, and fixtures copied from it, keep their
  characters exactly. Any other dash that stays, such as a UI symbol, has `dashcheck: allow` and a reason on its line.
- **Banned words.** Do not write the words on the left, in any capitalization. The list is a minimum: rewrite any
  other figurative word the same way.

| Do not write | Write instead |
| --- | --- |
| gate, gates, gated, gating, ungated | check, must pass, enforced by |
| land, lands, landed, landing | commit, merge, add, end up |
| carry, carries, carried, carrying | contain, include, keep, pass |
| pin, pins, pinned, pinning | fix, lock, set exactly, assert |
| spell, spells, spelled, spelling, respell | write, name, define |
| arm, arms, armed, arming | variant, branch, set, enable |
| seam, seams | boundary, interface |
| sweep, sweeps, sitting, sittings | review, pass, run |
| heal, heals, healed, healing | fix, repair |
| bite, bites, earn, earns, earned | name the event that makes it matter, say why it is justified |
| ride, rides, riding, standing, in force | is sent with, current, in effect |
| needle, needles, knob, knobs, lever, levers | search text, setting, option |
| honest, honestly | accurate, correct, real |
| verdict, verdicts | result |
| re-derive, re-derived, rederive | recompute, check again |
| load-bearing, crucial, crucially, critically, fundamentally, robust, seamless, seamlessly, comprehensive | required, (state the specific fact) |
| leverage, leverages, delve, utilize, worth noting | use, look at, (state the fact) |
| footgun, tripwire, backstop, ratchet, chokepoint | describe the mechanism |
| under the hood, boils down, low-hanging, rabbit hole, north star, belt and braces, silver bullet | say it literally |

## Commits

[Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/), which conventional-pre-commit and
`scripts/commitlint.py` check as commit-msg hooks. The history inherited from Exiled Exchange 2 does not follow it.

- **Format:** `type(scope)?: subject`, imperative mood, lowercase subject, no trailing period, at most 72 characters.
  Types: `feat`, `fix`, `docs`, `test`, `refactor`, `perf`, `build`, `ci`, `chore`, `revert`. Scopes are optional
  and name one area: `main`, `renderer`, `parser`, `trade`, `ipc`, `data`, `dataparser`, `docs`, `ci`. Never repeat
  the type as the scope (`docs(docs)`). A breaking change adds `!` and a `BREAKING CHANGE:` footer.
- **The subject says what changed; the body says why.** Start with a verb of change (`add`, `fix`, `remove`,
  `split`, `rename`) and write a subject that reads correctly to someone who has not seen the diff. The body is two
  or three sentences and at most 50 words outside a code fence, the problem first and then what the change does
  about it, wrapped at 72. A code fence, or a line that starts with a `$ ` prompt, is pasted text, which the width,
  word count, dash and banned-word rules skip. Write no body when the subject says everything.
- **Self-contained.** No issue or PR numbers, commit hashes, or pointers into documents that change. Name the
  behavior instead. Link an issue in the PR description, where the link can be edited.
- **No banned word and no dash as punctuation**, as in [Prose](#prose).
- One logical change per commit. A version bump and a data update are each their own commit.

## Exiled Exchange 2

- **Kalandra does not merge Exiled Exchange 2.** The `upstream` remote, where it exists, points at
  `Kvan7/Exiled-Exchange-2` and is only read. A fix from there comes in by cherry-pick, one commit at a time, with its
  original author kept ([ADR-0001](docs/dev/adr/ADR-0001-kalandra-continues-exiled-exchange-2.md), steps in
  [docs/dev/runbooks/cherry-pick-upstream.md](docs/dev/runbooks/cherry-pick-upstream.md)).
- **Agent work never goes there.** Its contribution policy allows AI help only as end of line completion and asks
  contributors not to use agents. Never open an issue or PR against `Kvan7/Exiled-Exchange-2`; a PR an agent opens
  targets `origin`.
- **Credit stays.** Kalandra is under the AGPL v3 (`LICENSE`). The code inherited from Awakened PoE Trade and
  Exiled Exchange 2 is under the MIT License, whose notice must stay with it in `LICENSES/MIT.txt`; a fix
  cherry-picked from there is under the same notice ([ADR-0002](docs/dev/adr/ADR-0002-agpl-with-mit-notice.md)). The
  README credits both projects, and `.github/FUNDING.yml` keeps the Patreon account of Awakened PoE Trade's author.

## Safety

- **Ask before anything outward-facing.** Pushing, opening a PR, tagging and releasing need the user's go-ahead. A
  push to `master` that changes a file outside `docs/` and the root `README.md` runs the Build workflow, which
  packages the app on three platforms and uploads it to the draft GitHub release for the current version if one
  exists. Never force-push a published branch.
- **No secrets and no user files in the repo or the logs.** Never commit a `config.json`, a client log or anything
  from `%APPDATA%`. The only token is the `GITHUB_TOKEN` that CI provides. No log line contains a cookie, a token or
  a session ID.
- **External input is untrusted.** Clipboard item text, client log lines and trade responses can be malformed or
  come from a game patch the data does not know yet. Parse them without throwing and log what failed.
- **Be polite to other services.** No loops or tests against the live trade site, poe.ninja or poeprices. A
  `dataParser` run that pulls trade data or downloads images is slow and network heavy, so ask first. Only
  `priceService/` calls poe.ninja's API: one request at a time, at most once an hour per category, with its
  User-Agent. A live `python -m price_service --once` sends up to 277 requests (139 on 18 Oct 2026), so ask before
  running it.

## Working agreement

- **Read before you write.** Open the file and its call sites before editing; never edit from memory of its
  contents, and never invent an API. Check the signature.
- **Claims come with evidence.** Never report a check as passing without having run it in this session; show the
  command and its output. Label an unverified statement as an assumption.
- **Prove a check can fail.** After writing or changing a test or a check, break the thing it checks and watch it
  fail before trusting it. A check that cannot fail is a defect. Write that proof in the body of the commit that
  makes the change, as a table in a code fence: each break, the test suite run against it, and what failed.
- **Report faithfully.** Report a failing test with its output and name every step you skipped. Report a task as
  done only when it is: an inaccurate "done" costs more to undo than an accurate "not yet".
- **Stop when surprised.** When output contradicts your model of the system, work it out again from the evidence.
  Do not match it to the nearest familiar failure and push through.
- **Small, complete slices.** Each change is a thin end-to-end path that passes its checks and has its docs. No
  scaffolding of empty layers.
- **Decisions are written down.** A non-obvious choice gets its reason in the commit body, and one that governs
  future changes becomes an ADR in `docs/dev/adr/` (format in its README) plus a row in `docs/dev/index.md`, with any
  rule it adds written here. When a request is underspecified, record your reading of it, continue, and name the
  riskiest assumption in your summary.
- Keep this file and all docs short and full of pointers; context bloat is a defect.
