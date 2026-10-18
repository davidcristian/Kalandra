# Issues and Discussions are off on the GitHub repo that the app and the docs link

**Status:** open
**Area:** repo
**Origin:** [.github/ISSUE_TEMPLATE/config.yml](../../../../.github/ISSUE_TEMPLATE/config.yml)
**Verified:** 2026-10-18

On 2026-10-18 the GitHub API reports `"has_issues": false` and `"has_discussions": false` for
`davidcristian/Kalandra`, a fork of Exiled Exchange 2. With issues off, `/issues/new/choose`
returns 404. On a repo with issues on, the same page sends a signed-out
visitor to the sign-in page. So nobody can open an issue.

These send users to the issues page: the user pages `docs/index.md`, `docs/issues.md`,
`docs/invalid-json.md` and `docs/settings.md`, the About page (`about.vue`) and
`.github/ISSUE_TEMPLATE/bug-report.yml`. The price service also sends that page as its contact in
its User-Agent (`DEFAULT_CONTACT` in `priceService/price_service/__main__.py`).

`.github/ISSUE_TEMPLATE/config.yml` lists three `contact_links` for the page where a user picks an
issue type: Feature Request (`/discussions/categories/ideas`), Help/Q&A
(`/discussions/categories/q-a`) and Discussions (`/discussions`). All three return 404.

Measure it again with `curl -s https://api.github.com/repos/davidcristian/Kalandra` and read
`has_issues` and `has_discussions`.

Done looks like: the maintainer turns on Issues in the repo settings, and `/issues/new/choose`
shows the bug report form. Then a decision on Discussions: remove the three links from
`config.yml`, or turn Discussions on and check that the categories `ideas` and `q-a` exist.

## History

- 2026-10-18: Found while docs/issues.md was rewritten, and checked the same day through the GitHub
  API.
- 2026-10-18: The task review found that issues are off as well (`has_issues` is false, and
  `/issues/new/choose` returns 404), and widened the task from the Discussions links to both
  settings.
