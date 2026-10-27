# Runbook: taking a fix from Exiled Exchange 2

Kalandra never merges Exiled Exchange 2. A fix from there comes in by cherry-pick, one commit at a
time, with its original author kept, and gets a Conventional Commits message
([ADR-0001](../adr/ADR-0001-kalandra-continues-exiled-exchange-2.md), decisions 3 and 4). The code
stays under the MIT notice it came with ([ADR-0002](../adr/ADR-0002-agpl-with-mit-notice.md)). The
rules are in [AGENTS.md](../../../AGENTS.md#exiled-exchange-2). Pushing and opening a pull request
need the maintainer's go-ahead.

## The upstream remote, read only

`upstream` is `https://github.com/Kvan7/Exiled-Exchange-2.git`, and nothing is ever pushed to it.
`git remote -v` shows whether a clone has it. Add it if it is missing, without its tags, and give
it a push address that does not exist, so a push to it fails:

```shell
git remote add --no-tags upstream https://github.com/Kvan7/Exiled-Exchange-2.git
git remote set-url --push upstream no-push
```

`git remote -v` then lists `no-push` as the push address of `upstream`, and `git push upstream`
stops with `fatal: 'no-push' does not appear to be a git repository`. A clone whose `git remote -v`
lists the GitHub address as the push address of `upstream` can push there: run the second command
in it.

`--no-tags` sets `remote.upstream.tagOpt`, so `git fetch upstream` copies no tags into the clone.
Exiled Exchange 2's tags use the same `vX.Y.Z` names as Kalandra's releases, and a later
`git push --tags` to `origin` would publish them there ([release.md](release.md)). In a clone that
already has the remote, `git config remote.upstream.tagOpt --no-tags` sets the same.

## Find the commit

```shell
git fetch upstream
git log --oneline --no-merges master..upstream/dev
git log --oneline --no-merges master..upstream/master
```

`git fetch` changes nothing on GitHub: it copies upstream's branches into the clone as
`upstream/<branch>`. Exiled Exchange 2 works on its `dev` branch and merges it into its `master` by
pull request, so a fix is on `upstream/dev` before it is on `upstream/master`. A commit taken
earlier is still listed, because a cherry-pick gets a new hash. `git cherry -v master upstream/dev`
marks with `-` each commit whose change is already in `master` unchanged, and with `+` the rest.

Read the commit with `git show <commit>` before taking it. Leave out a commit that undoes a
Kalandra decision: an upstream version bump, a link back to Kvan7's repo, or a change to where
prices come from ([ADR-0006](../adr/ADR-0006-own-price-service.md)). The two commits that add stat
group lines to `stats.ndjson` are declined, for the reasons in
[task 104](../refinements/tasks/104-stat-group-lines.md).

## Take it

1. **Branch** from an up-to-date `master`: `git switch -c fix/<name> master`.
2. **Cherry-pick one commit:**

   ```shell
   git cherry-pick -e <commit>
   ```

   Git applies the change, keeps the commit's author, records you as the committer, and opens the
   upstream message in the editor. Rewrite it in the format [AGENTS.md](../../../AGENTS.md#commits)
   sets: `type(scope)?: subject`, a body of at most 50 words, and no issue or pull request numbers,
   such as the `Fixes #<number>` at the end of some upstream messages.

   Without an editor, as in an agent's shell, run `git cherry-pick <commit>` and then
   `git commit --amend -m "<subject>" -m "<body>"`. An amend keeps the author.

   Never add `-x`: it appends `(cherry picked from commit <hash>)` to the message, and a commit
   message here contains no hashes. A merge commit is not taken as a whole: take the commits it
   merged, one at a time.
3. **Resolve conflicts.** Git stops with `CONFLICT` lines naming each file. A file conflicts when
   Kalandra and upstream changed the same lines, as the rename to Kalandra did across the tree: the
   names, the repo links, the app ID, the five version places ([release.md](release.md)) and the
   price source. Keep Kalandra's side for those and upstream's side for the fix. Then:

   ```shell
   git add <file>
   git cherry-pick --continue
   ```

   `git cherry-pick --abort` returns the branch to where it was before the cherry-pick.
4. **Check the author.** `git log -1 --format='%an <%ae> / %cn'` prints the upstream author, then
   you as the committer.
5. **Run the checks** that [AGENTS.md](../../../AGENTS.md#what-every-change-must-pass) lists for
   the parts the commit touches. A bug fix needs a test that fails without it, and a parser fix
   needs the real copied item text as a case under `renderer/specs/Parser/`. When the upstream
   commit has no test, add one in a commit of your own after it. Name each in-game behavior the
   fix changes by its entry in [in-game-check.md](in-game-check.md), for the maintainer to check.
6. **Keep the notice.** The code is under the MIT License notice in `LICENSES/MIT.txt`, which
   stays in the repo. The cherry-pick adds nothing to it.
7. **Open the pull request against `origin`**, for example
   `gh pr create --repo davidcristian/Kalandra`, and check on GitHub that the base repository is
   `davidcristian/Kalandra`. `davidcristian/Kalandra` is a GitHub fork of
   `Kvan7/Exiled-Exchange-2`, and GitHub's pull request form for a fork can offer the parent
   repository as the base.

Never open an issue or a pull request against `Kvan7/Exiled-Exchange-2`. Its contribution policy
asks contributors not to use agents.

## When it fails

- **`error: could not apply <hash>...`** with `CONFLICT` lines. Resolve as in step 3.
- **`The previous cherry-pick is now empty, possibly due to conflict resolution.`** The change is
  already in the branch. Run `git cherry-pick --skip`.
- **`error: commit <hash> is a merge but no -m option was given.`** The commit is a merge. Take the
  commits it merged instead.
- **`fatal: 'no-push' does not appear to be a git repository`.** A command tried to push to
  `upstream`. Push to `origin` instead.
- **A check fails after a clean cherry-pick.** One cause is an earlier upstream commit that the fix
  depends on and Kalandra does not have. `git log upstream/dev -- <file>` lists the upstream commits
  to a file. Take the earlier commit first, or adapt the fix in a commit of your own.
