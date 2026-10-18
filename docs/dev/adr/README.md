# Decision records

An architecture decision record (ADR) states one decision as it stands today: what was decided, why, and what
follows from it. A reader opens one to learn the rule that applies now, so it is short enough to read in full and
contains nothing that is no longer true. The catalogue of every record, one line each, is in
[the developer index](../index.md).

## The rules

- **One decision per record, at most 250 lines.** Every markdown file in the repo has that limit
  ([AGENTS.md](../../../AGENTS.md), What every change must pass, File size). A record that needs more is two
  decisions, or it contains history that belongs in git.
- **Edited in place.** When the decision changes, the record is rewritten to state the new decision and its
  `**Status:**` date moves. Git keeps every earlier version, so nothing is appended: a record never ends with a dated
  list of later changes.
- **Number and file name are permanent.** A record is `ADR-NNNN-slug.md` and is never renumbered, so every link to
  it keeps working. A new record takes the next free number. A decision replaced by another keeps its file, and its
  status names the record that replaced it.
- **Headings are stable.** Other documents link to a section by its anchor, so a heading is renamed only together
  with every link to it.
- **A figure states its date and the command that measures it again.** There is no directory of measurements
  ([ADR-0008](ADR-0008-developer-docs-layout.md)), so the figure, its date and its method are written together in
  the sentence that uses them.
- **A commit names the decision, never the ADR number.** A commit message is self-contained
  ([AGENTS.md](../../../AGENTS.md), Commits): it says what the decision does, such as "serve prices from
  Kalandra's own price service", so it reads correctly to someone who has no record open.
- **A new record gets a row in [the developer index](../index.md).** A rule it adds for every change goes into
  [AGENTS.md](../../../AGENTS.md) with a link to the record, which holds the reason.

The prose rules in [AGENTS.md](../../../AGENTS.md) apply in full.

## The format

```
# ADR-NNNN: <title>

**Status:** Accepted (<date the decision last changed>)   or   Superseded by ADR-MMMM (<date>)

## Context
Why a decision was needed, in a few short paragraphs.

## Decision
The numbered decisions, each with its reason in a sentence or two. Subsections with stable
headings are fine.

## Consequences
What follows: the rules a contributor keeps, the costs, and what the decision rules out.

## Alternatives rejected
Only the ones a future reader would otherwise propose again, one or two lines each.

## Related
Module docs, runbooks, other ADRs and the files that implement the decision.
```
