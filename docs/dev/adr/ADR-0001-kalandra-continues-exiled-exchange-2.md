# ADR-0001: Kalandra continues Exiled Exchange 2 as its own project

**Status:** Accepted (2026-10-22)

## Context

Awakened PoE Trade, by SnosMe, is a price check overlay for Path of Exile. Exiled Exchange 2, by Kvan7, is its fork
for Path of Exile 2. Kalandra starts from Exiled Exchange 2 version 0.16.3 and is developed in its own repo,
`davidcristian/Kalandra`, which is the `origin` remote. The `upstream` remote points at `Kvan7/Exiled-Exchange-2`.

The code as forked named Exiled Exchange 2 in the app, the docs and the issue templates, and sent users, bug reports
and auto updates to Kvan7's repo. Exiled Exchange 2 also has a contribution policy, its `AI_POLICY.md`: it allows AI
help only as end of line completion and asks contributors not to use agents. Kalandra accepts agent work under the
rules in [AGENTS.md](../../../AGENTS.md).

## Decision

**1. Kalandra is its own app.** The name is Kalandra. `main/electron-builder.yml` sets the app ID
`io.github.davidcristian.kalandra` and the product name `Kalandra`, and `main/package.json` sets the package name
`kalandra` and the repository `davidcristian/Kalandra`. The app, the docs and the issue templates send users and bug
reports to that repo, and auto updates come from its GitHub releases (`publish: github` in
`main/electron-builder.yml`). Reason: users, bug reports and updates reach the project that ships the build.

**2. Settings live in their own folder.** Electron names the app's `userData` folder after the package name,
`kalandra`, so Kalandra keeps its settings in `%APPDATA%\kalandra\apt-data\` on Windows (`ConfigStore` in
`main/src/host-files/ConfigStore.ts`). Reason: Kalandra installs beside Exiled Exchange 2, and neither app reads or
writes the other's `config.json`. A user who wants the old settings copies `apt-data` from
`%APPDATA%\exiled-exchange-2`, as the [download page](../../download.md) describes.

**3. Kalandra never merges Exiled Exchange 2.** The `upstream` remote is only read. A fix from there comes in by
cherry-pick, one commit at a time, with its original author kept. Reason: one merge brings in every upstream commit
that Kalandra does not have, at once, and upstream messages do not follow Conventional Commits (one is
`data update`). A merge also conflicts wherever an upstream change touches a line that Kalandra changed, and
Kalandra's commits change files across the tree: the rename commit alone changed 46 files, in `main/`, `renderer/`,
`dataParser/`, `docs/`, `.github/` and the repo root. A cherry-pick takes one change, which is reviewed on its own,
and keeps its author.

**4. A cherry-picked commit gets a Conventional Commits message and no hash.** It is made with
`git cherry-pick -e <commit>`, which keeps the author and opens the message for editing, and never with `-x`, which
appends the upstream commit hash. Reason: every new commit follows Conventional Commits, and a commit message holds no
commit hashes ([AGENTS.md](../../../AGENTS.md), Commits).

**5. Agent work never goes to Exiled Exchange 2.** No agent opens an issue or a pull request against
`Kvan7/Exiled-Exchange-2`, and a pull request an agent opens targets `origin`. Reason: that project's contribution
policy asks contributors not to use agents.

**6. Credit stays.** The README credits both projects, and `.github/FUNDING.yml` keeps the Patreon account of Awakened
PoE Trade's author. The settings window shows Awakened PoE Trade's patrons from `renderer/public/data/patrons.json`
under a label that names that project. The Patreon links in `renderer/src/web/price-check/CheckedItem.vue` and
`renderer/src/web/settings/SettingsWindow.vue` are inside HTML comments, which Exiled Exchange 2 added before the
fork, so the app shows neither. Reason: Kalandra is built on their code. The license side of this, the MIT notice, is
[ADR-0002](ADR-0002-agpl-with-mit-notice.md).

## Consequences

- The rename is a breaking change for anyone moving from Exiled Exchange 2: the rename commit has a
  `BREAKING CHANGE:` footer that says settings live in `%APPDATA%\kalandra` and that a user copies `apt-data` to keep
  them.
- A fix made upstream after the fork is not in Kalandra until someone cherry-picks it. The steps are in
  [the cherry-pick runbook](../runbooks/cherry-pick-upstream.md).
- The history inherited from Awakened PoE Trade and Exiled Exchange 2 does not follow Conventional Commits. Every
  commit Kalandra adds does, a cherry-pick included.
- The folder inside `userData` is named `apt-data`, after Awakened PoE Trade. `ConfigStore` reads
  `apt-data/config.json`, so after a rename of the folder it would find no saved config
  ([ADR-0003](ADR-0003-config-survives-updates.md)).

## Alternatives rejected

- **Merging upstream branches to stay current.** The reasons are in decision 3.
- **Cherry-picking with `-x`.** It writes the upstream hash into the message, which commit messages here never
  contain.
- **Keeping the Exiled Exchange 2 app ID and folder.** The two apps would then share one settings folder, and each
  would read and write the other's `config.json`.

## Related

- [ADR-0002](ADR-0002-agpl-with-mit-notice.md): the license and the MIT notice.
- [Cherry-pick runbook](../runbooks/cherry-pick-upstream.md): the steps for taking one fix from upstream.
- [AGENTS.md](../../../AGENTS.md), section Exiled Exchange 2: the rules this record gives the reasons for.
- [README.md](../../../README.md) and the [download page](../../download.md): the credits and the moving steps.
