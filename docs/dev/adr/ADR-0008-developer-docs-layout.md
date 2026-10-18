# ADR-0008: Developer docs live in docs/dev/ and are left out of the user site

**Status:** Accepted (2026-10-18)

## Context

`docs/` is the user documentation: a VitePress site that `.github/workflows/pages.yml` publishes to GitHub Pages at
<https://davidcristian.github.io/Kalandra/>, with `docs/index.md` as its home page. Contributors also need documents
the site does not hold: the decisions and their reasons, the contract of each part of the code, and procedures such
as a release. Those documents link to source files throughout. Their layout follows the maintainer's Cortex repo,
reduced to what a forked Electron app with one maintainer needs.

## Decision

**1. Developer docs live in `docs/dev/`.** The folder holds `index.md` (the entry point, listing every developer
doc), `architecture.md` (the components and the data flow), `adr/` (these records), `modules/` (one contract doc per
part of the code), `runbooks/` (procedures), `refinements/` (deferred work anyone can pick up) and `host/` (checks
that need Path of Exile 2 running on Windows). Reason: a push that changes only `docs/` does not run the Build
workflow (see Alternatives rejected), and one folder gives [AGENTS.md](../../../AGENTS.md) and the README one place
to link to.

**2. The site leaves them out.** `docs/.vitepress/config.js` sets `srcExclude: ['dev/**']`, so VitePress does not
build them, and they are read on GitHub. Reason: on GitHub a relative link to a source file or to `AGENTS.md` opens
that file. On the site every such link would have to be a full GitHub URL, and players would see contributor docs
next to the user pages.

**3. A user page links a developer doc by its GitHub URL**,
`https://github.com/davidcristian/Kalandra/blob/master/docs/dev/<path>`. Reason: the developer docs are not part of
the built site, so a relative link to one is a dead link and fails the docs build.

**4. The two kinds of page have different shapes.** A user page sets `title` in its frontmatter and has no H1 of its
own: `docs/.vitepress/theme/Layout.vue` shows that title as the heading on every page but the home page, and the
sidebar shows the group names from `config.js`. A developer doc is plain GitHub markdown: one H1, no frontmatter, and
relative links to other developer docs and to repo files. Reason: each kind is read where it renders, and GitHub
shows frontmatter as a table above the text.

**5. Every markdown file is at most 250 lines.** A longer file is split by subject. Reason: a reader can read a file
of that size in full.

**6. Deferred work is one file per task.** A refinement is `docs/dev/refinements/tasks/NNN-slug.md` and a host check
is `docs/dev/host/tasks/NNN-slug.md`. Each folder's `index.md` is kept by hand and lists every task by number and
title only. A task's status is written on its own `**Status:**` line and nowhere else. Reason: a status written in
two places goes out of date in one of them, and one place leaves nothing to reconcile.

**7. Two parts of Cortex's layout are left out.** There is no readings directory: a figure in a doc states its date
and the command that measures it again, in the sentence that uses it. The backlog indexes are kept by hand, not
generated, and `scripts/backlogcheck.py` compares them with the task files
([ADR-0010](ADR-0010-scripts-check-the-written-rules.md)). Reason: Kalandra has one maintainer and few measured
figures, so a directory of measurement records would hold few files, and a generator would replace little work.

## Consequences

- The Docs job of `.github/workflows/test.yml` fails on a dead internal link in a user page
  ([architecture.md](../architecture.md#ci) lists when it runs).
- The build does not read `docs/dev/`, so `scripts/linkcheck.py` checks the links of the developer docs and of the
  markdown files outside `docs/` ([ADR-0010](ADR-0010-scripts-check-the-written-rules.md)).
- A change only under `docs/dev/` neither deploys the site nor runs the three-platform Build workflow
  ([architecture.md](../architecture.md#ci)).
- A new decision that governs later changes becomes a record here and a row in [the developer index](../index.md)
  ([AGENTS.md](../../../AGENTS.md), Working agreement).

## Alternatives rejected

- **A developer section in the site's sidebar.** The reasons are in decision 2.
- **A top-level folder outside `docs/`.** `main.yml` ignores only `docs/**` and `README.md`, so a doc-only push to
  `master` would run the Build workflow, which packages the app on three platforms and uploads it to the draft
  release for the current version if one exists.
- **Cortex's readings directory and generated indexes.** The reasons are in decision 7.

## Related

- [Developer index](../index.md), [refinements](../refinements/index.md) and [host checks](../host/index.md).
- [Docs site runbook](../runbooks/docs-site.md): previewing, building and deploying the user site.
- [README.md](README.md) in this folder: the rules and the format of a decision record.
