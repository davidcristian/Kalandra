# Check the GitHub, Cloudflare and Docker behaviors the runbooks describe

**Status:** open
**Area:** release
**Origin:** [docs/dev/runbooks/release.md](../../runbooks/release.md)
**Verified:** 2026-10-18

Several runbook statements describe how a service outside the repo behaves. Their writers took
them from that service's documentation and from the repo's configuration, and observed none of
them:

- [runbooks/release.md](../../runbooks/release.md): GitHub lists draft releases only to a token
  with write access; a new release for an existing tag uses that tag's commit; Re-run all jobs on a
  Build run uploads the files again and replaces the files with the same names; the matrix's
  default `fail-fast` cancels the other `package` jobs when one fails.
- [runbooks/docs-site.md](../../runbooks/docs-site.md): `configure-pages` or `deploy-pages` fails
  when the Pages source is not GitHub Actions, or when the branch rule of the `github-pages`
  environment does not allow the branch.
- [runbooks/cherry-pick-upstream.md](../../runbooks/cherry-pick-upstream.md): GitHub's pull request
  form for a fork can offer the parent repo as the base.
- [runbooks/price-service-deploy.md](../../runbooks/price-service-deploy.md): Cloudflare caches the
  JSON files only with a cache rule; `cf-cache-status` reads `HIT`, `MISS` or `DYNAMIC`; Cloudflare
  returns `502` or `530` when its tunnel or the `web` container is down; Docker shows a container's
  health as `starting`, then `healthy`, and as `unhealthy` after three failed checks.

The maintainer can check each one the next time its step runs: the first release, the next docs
deploy, the next cherry-pick and the next look at the price service. The first release also checks
the token permissions in [039](039-build-workflow-permissions.md).

Done looks like: each statement confirmed, or corrected in its runbook, with the date of the check
in the sentence. Close this task when all four runbooks are checked, or split it per runbook.

## History

- 2026-10-18: Collected from the writers of the four runbooks, who could not observe these
  services.
