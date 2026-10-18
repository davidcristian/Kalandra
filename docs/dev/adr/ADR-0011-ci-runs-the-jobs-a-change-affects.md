# ADR-0011: CI runs the test jobs a change can affect

**Status:** Accepted (2026-10-18)

## Context

`.github/workflows/test.yml` ran every job on every push and pull request: the renderer and main tests, the price
service, the scripts and the docs build. A change only to a developer doc or a README still waited for all of them,
and the renderer suite alone installs its packages and builds the game data index files before it runs. Cortex, the
maintainer's other repo, picks its CI jobs from the changed paths with a small script and runs every job for a path
the script does not know.

## Decision

**1. `scripts/ci_paths.py` maps each changed path to the jobs it affects.** The Changed paths job of `test.yml`
lists the paths with `git diff --name-only`, from the merge base for a pull request and from the push's `before`
commit for a push, and passes them to the script. Each of the Tests, Price service, Scripts and Docs jobs runs only
when a path affects it. Reason: a change to the docs alone runs the docs build alone, and the rules are Python with a
unit test, not a list inside the workflow that nothing checks.

**2. The first matching rule applies, and every job runs when no rule matches or no diff can be read.** A file rule
comes before the rule for its folder, and `test_ci_paths.py` fails when an earlier rule hides a later one. The first
push of a branch, or a force push whose `before` commit is gone, has no diff, so every job runs. Reason: a path that
nobody listed, such as a new top-level folder, must not skip the tests it can break.

**3. A change to a workflow or to `scripts/` runs every job.** Reason: those files decide what CI runs, including
this script.

**4. Lint & Format runs on every push.** Reason: its pre-commit hooks include the checks that read every file of the
repo (line limits, dashes, prose, links and the backlog indexes), so no path is outside it.

**5. The Tests job keeps its name and checks its own steps.** It runs when the renderer or main is affected, and
each half runs only for its own paths. Reason: a required status check named Tests keeps working, and GitHub
counts a skipped job as passed.

## Consequences

- A push that changes only `docs/dev/` or a markdown file at the repo root runs Changed paths and Lint & Format.
- A new folder runs every job until a rule names it. A change to `ipc/` runs both halves of Tests, and a change to
  `namespaceMap.json` or the price service's fixtures runs the renderer tests and the price service.
- The Build and Docs workflows keep their own `paths` filters ([architecture.md](../architecture.md#ci)).

## Alternatives rejected

- **A path filter action from the marketplace.** It is a dependency that reads its own YAML rules, and nothing in
  the repo tests those.
- **A `paths` filter on the whole workflow.** A workflow that does not run leaves its required checks waiting, so a
  pull request could not merge.

## Related

- [modules/scripts.md](../modules/scripts.md): `ci_paths.py` and its rules.
- [ADR-0010](ADR-0010-scripts-check-the-written-rules.md): the checks that Lint & Format runs.
