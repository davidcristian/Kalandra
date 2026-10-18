# testUpdate.sh runs npm install instead of npm ci

**Status:** open
**Area:** release
**Origin:** [testUpdate.sh](../../../../testUpdate.sh)
**Verified:** 2026-10-18

`testUpdate.sh` at the repo root removes `renderer/dist` and `main/dist`. It then runs
`npm install`, `npm run make-index-files` and `npm run build` in `renderer/`, and `npm install`,
`npm run build` and `npm run package` in `main/`. Every workflow job that installs Node packages
runs `npm ci`, which installs exactly the versions in `package-lock.json` and never changes that
file. `npm install` can rewrite `package-lock.json` in both folders and can install other versions
than CI does, so a package built locally can differ from one CI builds.

The script also has no `set -e`, so a failed step does not stop it. When the renderer build fails,
the script still runs `npm run package`, although `renderer/dist`, which `main/electron-builder.yml`
packages, is missing or incomplete.

[DEVELOPING.md](../../../../DEVELOPING.md#package-locally) describes the script under Package
locally, and warns that `npm install` can rewrite `package-lock.json`.

Done looks like: the script runs `npm ci` in both folders and stops at the first failed command,
and the Package locally section of DEVELOPING.md changes to match, without that warning.

## History

- 2026-10-18: Found while the release runbook was written, by comparing the script with the CI
  jobs.
- 2026-10-18: The task review found that DEVELOPING.md already describes the script, removed that
  from the done part, and added the missing `set -e`.
