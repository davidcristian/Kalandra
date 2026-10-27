# A fix outside the app does not start the Build run that a failed upload needs

**Status:** open
**Area:** ci
**Origin:** [.github/workflows/main.yml](../../../../.github/workflows/main.yml)
**Verified:** 2026-10-27

The Build workflow in `.github/workflows/main.yml` runs only for a push to `master` that changes
`main/`, `renderer/`, `ipc/`, `main.yml` or `test.yml` (`paths`). Its `tests` job calls
`test.yml` with `all_jobs: true`, so it also runs the Lint & Format, Price service, Scripts, Docs
and Data tool jobs, which read files outside those paths. When one of them fails, the `package`
job is skipped and nothing is uploaded. A fix under `priceService/`, `scripts/`, `docs/` or
`dataParser/` does not start Build, and Re-run all jobs builds the commit of the failed run again.
So the draft release gets no files until the next push that changes the app. A version bump also
changes `README.md` and `docs/.vitepress/config.js`, which the hooks and the Docs job read, so a
release can fail this way.

Done looks like: a decision for the maintainer, such as a `workflow_dispatch` trigger on
`main.yml` so that Build can be started by hand on the head of `master`, or no change. The
[release runbook](../../runbooks/release.md) describes the case under When it fails and changes
with the decision.

## History

- 2026-10-27: Found when a `paths` list replaced `paths-ignore` in `main.yml`
  ([038](038-build-workflow-paths.md)).
