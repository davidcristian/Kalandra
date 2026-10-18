# Choose the first Kalandra version above the inherited tags

**Status:** open
**Area:** release
**Origin:** [docs/dev/runbooks/release.md](../../runbooks/release.md)
**Verified:** 2026-10-18

The five version places that `versionCheck.py` compares read `0.16.3`: `main/package.json`,
`main/package-lock.json`, `README.md`, `.github/ISSUE_TEMPLATE/bug-report.yml` and `appVersion` in
`docs/.vitepress/config.js`. `origin` holds 90 tags inherited from Exiled Exchange 2
(`git ls-remote --tags --refs origin`). Its tag `v0.16.3` points at `cca30662`, Kvan7's merge of
Exiled Exchange 2's `dev`. The release runbook says why its steps cannot release a version whose
tag already exists on `origin`: GitHub attaches the new release to the existing tag and its commit.

`origin` has no published release: on 2026-10-18 the GitHub API at
`https://api.github.com/repos/davidcristian/Kalandra/releases` returns an empty list.
[docs/download.md](../../../download.md) builds its download links from `appVersion`, so each link
returns 404, and the downloads badge in `README.md` has no release to count. The page has a
sentence that points to the releases page when a link fails.

Done looks like: a decision for the maintainer, then the first release by the runbook. Either the
first version is above `0.16.3`, set in all five places in one commit of its own (step 5 of the
runbook), or the inherited tags are deleted from `origin` first. Deleting them is destructive and
outward facing, so only the maintainer does it.

## History

- 2026-10-18: Found while docs/download.md and the release runbook were written, by checking the tag
  `v0.16.3` with `git log -1 v0.16.3`.
