# The Build workflow does not set the token permissions a release upload needs

**Status:** done 2026-10-20
**Area:** ci
**Origin:** [.github/workflows/main.yml](../../../../.github/workflows/main.yml)
**Verified:** 2026-10-20

The `package` job in `.github/workflows/main.yml` runs `npm run package "--" -p onTagOrDraft` with
`GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}`, and the workflow has no `permissions` key. So the token
gets the repository's default workflow permissions, which the repo files do not show.

electron-builder 26.8.1 finds the draft through the list of releases (`getOrCreateRelease` in
`electron-publish/out/gitHubPublisher.js`). GitHub lists draft releases only to a token with write
access to the repo. With a read-only token, the list has no draft, so electron-builder logs
`skipped publishing` and discards the packages
([runbooks/release.md](../../runbooks/release.md#when-it-fails)).

Done looks like: `permissions: contents: write` on the `package` job, so the upload no longer
depends on a repository setting, and the release runbook updated to match. The first release
checks it.

## History

- 2026-10-18: Found while the release runbook was written, by reading `main.yml` and how
  electron-builder looks up a draft release.
- 2026-10-20: Closed. The `package` job in `main.yml` has `permissions: contents: write`, the
  `renderer` job has `contents: read`, and the release runbook says so. The first release still
  checks the upload, as [057](057-outside-service-behaviors.md) lists.
