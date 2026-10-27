# ADR-0011: CI runs the test jobs a change can affect

**Status:** Accepted (2026-10-21)

## Context

`.github/workflows/test.yml` ran every job on every push and pull request: the renderer and main tests, the price
service, the scripts and the docs build. A change only to a developer doc or a README still waited for all of them,
and the renderer suite alone installs its packages and builds the game data index files before it runs. Cortex, the
maintainer's other repo, picks its CI jobs from the changed paths with a small script and runs every job for a path
the script does not know.

## Decision

**1. `scripts/ci_paths.py` maps each changed path to the jobs it affects.** The Changed paths job of `test.yml`
lists the paths with `git diff --name-only --no-renames`, from the merge base for a pull request and from the push's
`before` commit for a push, and passes them to the script. Each of the Tests, Price service, Scripts, Docs and Data
tool jobs runs only when a path affects it. Reason: a change to the docs alone runs the docs build alone, and the
rules are Python with a unit test, not a list inside the workflow that nothing checks. `--no-renames` lists a moved
file under its old and its new path, because git otherwise prints only the new one, and a file moved out of `main/`
must still run the main tests.

**2. The first matching rule applies, and every job runs when no rule matches, no diff can be read or Changed paths
fails.** A file rule comes before the rule for its folder, and `test_ci_paths.py` fails when an earlier rule hides a
later one. The first push of a branch, or a force push whose `before` commit is gone, has no diff, so every job runs.
Each job's `if` starts with `!cancelled()` and runs the job when `needs.changes.result` is not `success`. Reason: a
path that nobody listed, such as a new top-level folder, must not skip the tests it can break, and a failed Changed
paths job must not skip the jobs that a required check names.

**3. A change to a workflow or to `scripts/` runs every job.** Reason: those files decide what CI runs, including
this script.

**4. Lint & Format runs on every push.** Reason: its pre-commit hooks include the checks that read every file of the
repo (line limits, dashes, prose, links and the backlog indexes), so no path is outside it.

**5. The Tests job keeps its name and checks its own steps.** It runs when the renderer or main is affected, and
each half runs only for its own paths. Reason: a required status check named Tests keeps working, and GitHub
counts a skipped job as passed.

**6. Build runs every job of `test.yml` before it packages.** The Build workflow calls `test.yml` as a reusable
workflow with `all_jobs: true`, which skips `ci_paths.py`, and its `package` job needs that call. Reason: `package`
uploads into the draft release, so its files come from a commit on which every job passed, and the paths of one push
do not show what an earlier push broke.

## Consequences

- A push that changes only `docs/dev/` or a markdown file at the repo root runs Changed paths and Lint & Format.
  `AGENTS.md` is the exception: it also runs Scripts, whose tests read its banned words table and its scope list.
  So does `docs/dev/refinements/index.md`, whose task template a Scripts test reads.
- A new folder runs every job until a rule names it. A change to `ipc/` runs both halves of Tests, and a change to
  `namespaceMap.json` or the price service's fixtures runs the renderer tests and the price service. A change to
  `renderer/src/assets/data/interfaces.ts` or `renderer/src/web/trade-host.ts` runs the renderer tests and the Data
  tool, whose tests read both files.
- The Build and Docs workflows keep their own `paths` filters ([architecture.md](../architecture.md#ci)).
- A push to `master` that starts Build runs the jobs of `test.yml` twice: the affected ones in `test.yml`'s own run
  and all of them inside Build.

## Alternatives rejected

- **A path filter action from the marketplace.** It is a dependency that reads its own YAML rules, and nothing in
  the repo tests those.
- **A `paths` filter on the whole workflow.** A workflow that does not run leaves its required checks waiting, so a
  pull request could not merge.
- **Starting Build with `workflow_run` when `test.yml` completes.** Build would run the workflow file of the default
  branch, check out the tested commit by hand and lose its `paths-ignore` filter.
- **Copying the test steps into Build.** Two copies of the same steps can differ after a later change.
- **A last job that fails when a job it needs failed.** The required checks would have to change to its name, in the
  repository settings, which the repo files do not show.

## Related

- [modules/scripts.md](../modules/scripts.md): `ci_paths.py` and its rules.
- [ADR-0010](ADR-0010-scripts-check-the-written-rules.md): the checks that Lint & Format runs.
