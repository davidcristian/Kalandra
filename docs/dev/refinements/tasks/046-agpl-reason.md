# Record why Kalandra is under the AGPL v3

**Status:** open
**Area:** rules
**Origin:** [docs/dev/adr/ADR-0002-agpl-with-mit-notice.md](../../adr/ADR-0002-agpl-with-mit-notice.md)
**Verified:** 2026-10-18

[ADR-0002](../../adr/ADR-0002-agpl-with-mit-notice.md) records that Kalandra is under the GNU
Affero General Public License v3 and what that license requires. Decisions 2 to 4 each give a
reason, and decision 1, the license itself, gives none. The record does not say why the AGPL v3
was chosen over keeping the MIT License of the inherited code, or over the GPL v3, and its
Alternatives rejected section lists neither license. The relicense commit,
`chore: relicense the project under the GNU AGPL v3`, says what changed and gives no reason for
the license. Only the maintainer can give the reason.

Done looks like: the maintainer states the reason, decision 1 of ADR-0002 gives it, and
Alternatives rejected lists the licenses not chosen.

## History

- 2026-10-18: Found while ADR-0002 was written. A review of the repo against the maintainer's
  documentation practices listed it as an open question.
