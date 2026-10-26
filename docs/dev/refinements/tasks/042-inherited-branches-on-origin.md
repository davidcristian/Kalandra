# origin holds Exiled Exchange 2's branches, including dev

**Status:** done 2026-10-26
**Area:** repo
**Origin:** [.github/workflows/test.yml](../../../../.github/workflows/test.yml)
**Verified:** 2026-10-26

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
- 2026-10-26: The maintainer deleted eight inherited branches from `origin`, and `dev` stays there
  until the maintainer decides. Each deleted tip is still in Kvan7/Exiled-Exchange-2:
  - `app_i18n` at `fdede1bc408344fd3395bc9a512974b21468971f`
  - `awakened-upstream` at `ce551eb7a9b704fbdcc2478eebb26be8f91786c7`
  - `features/CvRemnants` at `165c9fc531cddf381a4a235afb24e46cc28de116`
  - `features/itemEditorV2` at `5f1e48baa39632f7339c3eb3eba314d979755067`
  - `features/linkingTradeStats` at `245ccec32b77d6fc281597a0b59327ceae1f0b77`
  - `features/removePseudo` at `993840d2fc7530d6dfabcaf8be5cd7d7eb411cbc`
  - `fix-autohide-pinning` at `41f5647694355523311acebfef0c0616fb6809c9`
  - `fix/dumpTabPrice` at `b5e935f8f7be9ffeb2df6af7db5d70b4bf06796b`
- 2026-10-26: Done. The maintainer deleted `dev` from `origin`, at
  `d95f53e11b40f0071491389834b9b54ca11b6288`, after its three commits were checked. That tip is
  still on Exiled Exchange 2's `dev`. The bug that its Mask of the Sanguimancer commit fixes is not
  in Kalandra, and the parser case `KeystoneUniqueLine` tests that item. Its match v2 commit is
  task [104](104-stat-group-lines.md). `ci: run the test workflow only for master` removed `dev`
  from `test.yml` and from the CI table in `docs/dev/architecture.md`.
