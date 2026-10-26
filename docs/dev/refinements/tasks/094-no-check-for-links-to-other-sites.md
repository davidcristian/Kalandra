# No check follows a link to another site

**Status:** declined 2026-10-26
**Area:** docs
**Origin:** [scripts/linkcheck.py](../../../../scripts/linkcheck.py)
**Verified:** 2026-10-26

`scripts/linkcheck.py` skips every link with a scheme, and the VitePress build checks only the
links between its own pages. So a link to another site, in the user docs, the README, the issue
forms or the app, is found dead only by a reader. [Task 036](036-discussions-links.md) names links
to the GitHub repo that already return 404.

Such a check needs the network, so it cannot run in `check.py` or in CI: the tests of `scripts/`
run without network, and the Safety rules in [AGENTS.md](../../../../AGENTS.md#safety) forbid
loops against the trade site, poe.ninja and poeprices. Most of these links go to GitHub, and the
rest to game wikis, video sites and Kalandra's own sites.

Done looks like: the maintainer decides whether a script run by hand, such as before a release, is
worth the code and tests it needs. If it is, a standard library script in `scripts/` sends one
request per distinct address and none to the trade site, poe.ninja or poeprices, has tests through
a fake opener, stays out of `check.py` and CI, and gets a step in the release runbook and a section
in `docs/dev/modules/scripts.md`. If it is not, this task is declined with the reason.

## History

- 2026-10-26: Filed when AGENTS.md was corrected to say that the docs build fails on a dead
  internal link only. No script was added, since one needs the network and a rule for the hosts it
  may contact.
- 2026-10-26: Declined. The docs build checks the internal links. The 70 distinct links to other
  sites in the tracked markdown files, most of them to GitHub, do not justify a script and tests that
  need the network and could not run in CI.
