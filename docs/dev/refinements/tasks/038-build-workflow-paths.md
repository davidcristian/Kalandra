# The Build workflow runs for pushes that change no file of the app

**Status:** open
**Area:** ci
**Origin:** [.github/workflows/main.yml](../../../../.github/workflows/main.yml)
**Verified:** 2026-10-18

The Build workflow in `.github/workflows/main.yml` packages the app on Windows, Linux and macOS and
uploads the packages to the draft release for the current version, if one exists. It runs on a push
to `master` and ignores only `docs/**` and the root `README.md` (`paths-ignore`). Two statements do
not match that:

- The Safety section of [AGENTS.md](../../../../AGENTS.md#safety) says a push to `master` runs the
  Build workflow, with no exception. A push that changes only files under `docs/` or `README.md`
  does not run it.
- A push that changes only `priceService/`, `dataParser/`, `DEVELOPING.md` or `AGENTS.md` does run
  it, although none of them is part of the packaged app.

Done looks like: a decision for the maintainer on which paths skip Build, then `paths-ignore` and
the AGENTS.md sentence changed to match in one commit. Three docs describe the current rule and
change with it: the CI table in [architecture.md](../../architecture.md),
[runbooks/release.md](../../runbooks/release.md) and
[ADR-0008](../../adr/ADR-0008-developer-docs-layout.md).

## History

- 2026-10-18: Found while the release and price service runbooks were written, by comparing
  `paths-ignore` with the Safety section.
- 2026-10-18: The task review restated the title as a defect, added `priceService/` and
  `dataParser/` as paths that run Build, and added architecture.md to the docs that change.
