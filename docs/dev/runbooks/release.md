# Runbook: releasing a version

A release is a published GitHub release on `davidcristian/Kalandra`. Its files are what the
[download page](../../download.md) links to and what the auto updater in installed copies downloads
([ADR-0001](../adr/ADR-0001-kalandra-continues-exiled-exchange-2.md), decision 1). Releasing is the
maintainer's job. Every push, tag and release below needs the maintainer's go-ahead
([AGENTS.md](../../../AGENTS.md#safety)). Setting up a machine:
[DEVELOPING.md](../../../DEVELOPING.md).

On 2026-10-18 Kalandra has no published release, and the five version places read `0.16.3`, the
Exiled Exchange 2 version Kalandra started from. `origin` also holds 90 tags inherited from Exiled
Exchange 2, the newest `v0.16.3`, and each one points at an Exiled Exchange 2 commit:
`git ls-remote --tags --refs origin` lists them. A version whose tag already exists on `origin`
cannot be released with these steps, because GitHub attaches a new release to the existing tag and
its commit. So the first release sets a version whose tag does not exist, such as one above
`0.16.3`.

## How the Build workflow publishes

`.github/workflows/main.yml`, the workflow named Build, packages the app.
[architecture.md](../architecture.md#ci) lists which pushes start it and what each job runs. A
merged pull request into `master` is a push to `master`. A tag push never starts Build
(`tags-ignore: '**'`), so pushing a tag releases nothing.

- The `tests` job calls `test.yml` as a reusable workflow with `all_jobs: true`, so every job of
  that workflow runs on the pushed commit, whatever the changed paths.
- The `renderer` job keeps `renderer/dist` as the `renderer-dist` workflow artifact for one day.
- The `package` job starts only after `tests` and `renderer` pass, so a commit on which a job of
  `test.yml` fails uploads nothing. It runs on `windows-2025`, `ubuntu-22.04` and `macos-14`. Each
  runs `npm ci` and `npm run build` in `main/`, then `npm run package "--" -p onTagOrDraft`, which
  is electron-builder with `GH_TOKEN` set to the workflow's `GITHUB_TOKEN`. The job gives that
  token `contents: write`, because GitHub lists draft releases only to a token with write access. A
  last step prints `latest.yml`, `latest-linux.yml` or `latest-mac.yml`.
- `main/electron-builder.yml` sets the targets: an NSIS installer and a portable exe on Windows, an
  AppImage on Linux and a universal dmg on macOS.
- Nothing is signed. `mac.identity` is `null`, and the workflow gives electron-builder no
  certificate for Windows. The download page tells users the app is unsigned.

`-p onTagOrDraft` makes electron-builder (26.8.1, locked in `main/package-lock.json`) look for a
GitHub release whose tag is `v` plus the `version` in `main/package.json`, and upload only into a
draft. The `npm run package` step of each `package` job logs one of three outcomes:

| Release with that tag | Log | Result |
| --- | --- | --- |
| A draft | `uploading` with `file=<name>` for each file | The files go into the draft. A file with the same name is replaced (`overwrite published file`). |
| None | `skipped publishing` with reason `release doesn't exist and not created because "publish" is not "always" and build is not on tag` | The packages are built and discarded. Every push before the first release ends here. |
| A published release | `GitHub release not created` with reason `existing type not compatible with publishing type` | Nothing is uploaded. Every push after a release, until the next version is set, ends here. |

So the draft must exist before the push that builds the version, and while it exists, every Build
run for that version replaces its files.

Build runs one at a time. The `concurrency` group in `main.yml` makes a new run wait until the
running one ends, and a newer push replaces a run that still waits. So the run for the newest
commit uploads last, and no run is cancelled in the middle of its uploads.

## The five version places

`scripts/versioncheck.py` fails unless these have the same version. It prints `Version mismatch detected:` and the
version it read from each place, and exits with 1, or prints `Version check passed. All versions are consistent.`
It exits with 2 when it cannot read a file or a package file has no version string
([scripts.md](../modules/scripts.md#versioncheckpy)).

| File | What `versioncheck.py` reads |
| --- | --- |
| `README.md` | The first `Kalandra-Setup-X.Y.Z`, in the downloads badge |
| `.github/ISSUE_TEMPLATE/bug-report.yml` | The first list line that is a version: the top option of the Version dropdown |
| `docs/.vitepress/config.js` | `appVersion: 'X.Y.Z'`, which the download links are built from |
| `main/package.json` | `version`, which `app.getVersion()` returns and electron-builder names files and the tag with |
| `main/package-lock.json` | The top `version` and `packages[""].version` |

`renderer/package.json` stays at `0.0.0`. Nothing reads it: the About page shows the version that
main returns on `/config`. The pre-commit hook runs `versioncheck.py` when a `.js`, `.md`, `.yml` or
`.json` file or the script itself changes, and the Lint & Format job of `test.yml` runs every hook
([architecture.md](../architecture.md#ci)).

## Steps

1. **Check master.** The Lint & Format, Tests, Price service and Docs jobs of `test.yml` pass on the
   head of `master`.
2. **Create the draft.** First check that `git ls-remote --tags origin vX.Y.Z` prints nothing.
   Then on GitHub: Releases, Draft a new release. Tag `vX.Y.Z`, created on publish, target
   `master`, title `vX.Y.Z`. Save it as a draft and do not publish it. You should see the draft on
   the Releases page, and `git ls-remote --tags origin vX.Y.Z` still prints nothing, because GitHub
   creates the tag when the release is published.
3. **Set the version** in a working tree based on `master`:
   - in `main/`, `npm version X.Y.Z --no-git-tag-version`, which writes `package.json` and both
     versions in `package-lock.json` and makes no commit or tag;
   - in `README.md`, the version in the downloads badge;
   - in `bug-report.yml`, a new `- X.Y.Z` line at the top of the Version options, and `default`
     increased by one so it still selects `Change me`;
   - in `docs/.vitepress/config.js`, `appVersion`.

   From the repo root, `python scripts/versioncheck.py` prints
   `Version check passed. All versions are consistent.`
4. **Run the checks** that [AGENTS.md](../../../AGENTS.md#what-every-change-must-pass) lists for
   the parts changed since the last release, and `pre-commit run --all-files` for the bump itself.
5. **Commit the bump on its own**, for example `chore: set the version to X.Y.Z`.
6. **Push to master.** You should see:
   - a Build run, whose `tests` jobs pass, whose three `package` jobs each log `uploading` once per
     file, and whose Hash step prints a `latest*.yml` with `version: X.Y.Z`;
   - a run of the Docs workflow (`pages.yml`), because the bump changes
     `docs/.vitepress/config.js`. The site then links to the `vX.Y.Z` files, which return 404
     until step 8, so do not wait long between the push and publishing.
7. **Check the draft.** It has the four files the download page links to, with exactly these
   names: `Kalandra-Setup-X.Y.Z.exe`, `Kalandra-X.Y.Z.exe`, `Kalandra-X.Y.Z.AppImage` and
   `Kalandra-X.Y.Z-universal.dmg`. It also has `latest.yml`, `latest-linux.yml` and
   `latest-mac.yml`, which the auto updater reads. Install the Windows build on a test machine and
   run the entries of [in-game-check.md](in-game-check.md) that the release touches.
8. **Write the release notes and publish.** GitHub creates the tag `vX.Y.Z` on the head of `master`
   when you publish, so publish before anything else is pushed to `master`. You should see:
   - the download page links work;
   - an installed copy finds the update at its next check, which runs at startup and every 16
     hours (`main/src/AppUpdater.ts`). The NSIS install and the AppImage download it and install
     it on exit. The portable exe only reports it. The macOS build reports it as not supported,
     but `autoDownload` stays on there, so electron-updater still starts a download.
     [Refinement 009](../refinements/tasks/009-macos-updater-auto-download.md) describes why that
     download fails.
9. `git ls-remote --tags origin vX.Y.Z` then prints the tag, on the commit that was the head of
   `master` when you published.

To upload the files again for the version already set, while its draft exists, open the latest
Build run on `master` in the Actions tab and choose Re-run all jobs.

## When it fails

- **`Version mismatch detected:`** The lines after it name each file and the version read there.
  Fix the file that differs and run `python scripts/versioncheck.py` again.
- **`git ls-remote --tags origin vX.Y.Z` prints a tag in step 2.** The tag exists on `origin`, from
  Exiled Exchange 2 or from an earlier release, and a release made now would point at its commit.
  Set a version whose tag does not exist.
- **The `package` jobs are skipped.** A job under `tests` failed on that commit, so nothing was
  uploaded. Its log names the failed step. Fix the cause on `master` and push, and the new Build
  run uploads.
- **`skipped publishing` although the draft exists.** The draft's tag is not `vX.Y.Z` for the
  version in `main/package.json`, or the token cannot see drafts: GitHub lists draft releases only
  to a token with write access, which `permissions: contents: write` on the `package` job in
  `main.yml` gives. Fix the cause, then choose Re-run all jobs on that Build run. Re-running only
  `package` needs the `renderer-dist` artifact, which is kept for one day.
- **An upload fails with HTTP 403.** The token cannot write releases. Check that the `package` job
  in `main.yml` still has `permissions: contents: write`.
- **`GitHub release not created`.** A published release already has this version, and
  electron-builder uploads nothing into a published release. Set a new version and start again
  from step 2.
- **One `package` job fails.** The matrix uses the default `fail-fast`, so GitHub cancels the other
  `package` jobs, and the draft can hold files from some platforms only. Fix the cause and choose
  Re-run all jobs; the new uploads replace the files with the same names.
- **A download link returns 404 after publishing.** A file name in the release differs from the
  name `docs/download.md` builds from `appVersion`. Compare the two.
