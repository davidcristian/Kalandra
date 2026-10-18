# origin holds Exiled Exchange 2's branches, including dev

**Status:** open
**Area:** repo
**Origin:** [.github/workflows/test.yml](../../../../.github/workflows/test.yml)
**Verified:** 2026-10-18

`git ls-remote --heads origin` lists nine branches besides `master`: `dev`, `app_i18n`,
`awakened-upstream`, `features/CvRemnants`, `features/itemEditorV2`,
`features/linkingTradeStats`, `features/removePseudo`, `fix-autohide-pinning` and
`fix/dumpTabPrice`. Each one is at the same commit as the branch with the same name on
`upstream`. `dev` is at `d95f53e1` and has three commits by Kvan7 that `origin/master` does not
have (`git log origin/master..origin/dev`).

`.github/workflows/test.yml` runs on pushes and pull requests to `master` and `dev`. So a
contributor can read `dev` as Kalandra's development branch and base a pull request on it. Merging
that pull request brings in those three commits at once, without the review of one commit that a
cherry-pick gets ([ADR-0001](../../adr/ADR-0001-kalandra-continues-exiled-exchange-2.md)).

Done looks like: a decision for the maintainer. Either the inherited branches are deleted from
`origin`, which is outward facing and needs the maintainer, or `dev` stays and
[DEVELOPING.md](../../../../DEVELOPING.md) states its role. Then `test.yml` names only the
branches Kalandra uses. The docs that say `test.yml` runs on `dev` change in the same commit:
DEVELOPING.md, `docs/dev/architecture.md`, ADR-0008, `docs/dev/modules/price-service.md`,
`docs/dev/runbooks/release.md` and `docs/dev/runbooks/docs-site.md`.

## History

- 2026-10-18: Found while the cherry-pick runbook was written, by comparing `origin/dev` with
  `upstream/dev` and `origin/master`.
