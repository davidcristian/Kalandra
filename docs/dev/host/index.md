# Host checks

This folder holds the checks that need Path of Exile 2 running on Windows. No agent can run the
game, so only the maintainer can run them. Each check is one file in [tasks/](tasks/), and it groups
the claims about one behavior: what the user pages and the developer docs say the game or the
overlay does, which the code is consistent with but cannot prove.

**Work that needs no game is in [refinements/](../refinements/index.md)**: code and docs fixes,
missing tests and decisions, which an agent or a contributor can pick up. A host task changes no
code by itself. When a check finds a bug, the bug becomes a refinement, and when it finds a page
wrong, the page is fixed.

Rule 9 of [AGENTS.md](../../../AGENTS.md#what-every-change-must-pass) says an agent names each
in-game behavior it could not check and marks it unverified. A behavior that waits for the
maintainer gets a task here. [runbooks/in-game-check.md](../runbooks/in-game-check.md) is the
procedure every task here follows: the setup, where the logs are, and what to press and see for each
behavior. [ADR-0008](../adr/ADR-0008-developer-docs-layout.md) gives the layout.

## How to work a check

1. **Pick** a task from the list below. The list gives no status, so open the file:
   `**Status:** never attempted` means nobody has run it.
2. **Check the task's claims against the code before you start.** The `**Verified:**` line is the
   day someone last did that. The code keeps moving while a check waits for the game, so search for
   the files and symbols the task names, and correct the file first if they changed. Write the day
   you checked on the Verified line.
3. **Run it** on Windows with the game, following
   [Before you start](../runbooks/in-game-check.md#before-you-start) and the runbook section the
   task links. Note the build (a version or a commit) and the game patch.
4. **Close it in its own file.** Change the Status line and add a History line with the date, the
   build, the game patch and what happened. Write the status on that line only
   ([ADR-0008](../adr/ADR-0008-developer-docs-layout.md), decision 6).
   A page or runbook that the run proved wrong is fixed in the same commit, since the run's result
   belongs in the doc that states the claim.
5. **File what the run opened.** A bug the run found becomes a refinement with the log lines it
   produced, named in this task's History. A new check gets a file here with the next free number.
6. **Add a new task to this list by hand**, with its number, title and link, in the same commit as
   its file. `scripts/backlogcheck.py` checks that the list and the task files match: each file
   listed once, in number order, with its heading as the title and one status from the list below.
   It also checks each file against the template below: one of each `**Name:**` line, a Needs line
   that starts as the template's does, a link as the Origin, a date as Verified, and a History of
   `- <date>: ` lines.

## Statuses

A check is not a design, so it has more outcomes than a refinement:

- `never attempted`: nobody has run it.
- `attempted <date>`: it ran and a claim failed. The History names the refinement filed for it, and
  the task is run again after the fix.
- `attempted <date>, inconclusive: <what happened>`: it ran and gave no answer, for example because
  the game was under maintenance or the setup was wrong. A problem with the setup is not a failed
  check.
- `done <date>`: every claim held, or the docs now state what the run found.

## A task file

```markdown
# <The behavior, as a statement>

**Status:** never attempted
**Needs:** Path of Exile 2 on Windows
**Origin:** [<the page or doc that makes the claims>](<relative link>)
**Verified:** <date the claims were last checked against the code>

**Claims.** <What the docs say and what the code shows.>

**Do.** <What to press, linking the runbook section.> **Pass.** <What to see.>
**Record.** <What to write down and where.>

## History

- <date>: <how it was filed, or what a run found>
```

## Tasks

- 001: [A price check in the game matches the price files at kalandra.ashoal.com](tasks/001-price-check-against-price-service.md)
- 002: [The overlay attaches to the game window in each display mode](tasks/002-overlay-attaches-to-game.md)
- 003: [The overlay key, focus and hiding behave as the pages say](tasks/003-overlay-key-and-focus.md)
- 004: [The game copies item text with the advanced item descriptions key](tasks/004-copy-with-advanced-descriptions.md)
- 005: [The price check window opens, stays and closes as the pages say](tasks/005-price-check-window.md)
- 006: [Trade site sign-in, bot check and listing marks through Kalandra](tasks/006-trade-site-sign-in.md)
- 007: [Chat commands do in the game what the pages say](tasks/007-chat-commands.md)
- 008: [Ctrl and the mouse wheel switch stash tabs](tasks/008-stash-tab-scrolling.md)
- 009: [Stash search and Find in Stash type into the game's search box](tasks/009-stash-search.md)
- 010: [Whether the Delve grid matches anything Path of Exile 2 shows](tasks/010-ocr-and-delve-grid.md)
- 011: [The XP tracker follows the game's Client.txt](tasks/011-xp-tracker.md)
- 012: [What the client log events mean in the game](tasks/012-client-log-events.md)
- 013: [The item check key opens Map check or Item info, and Map check marks modifiers](tasks/013-map-check.md)
- 014: [Item data collection writes rows, and new CSV samples for its page](tasks/014-item-data-collection.md)
- 015: [Item text and log lines from a game client in another language](tasks/015-other-game-languages.md)
- 016: [Install, update and moving settings on Windows](tasks/016-install-and-migration.md)
- 017: [Take Path of Exile 2 screenshots for the pages that lost theirs](tasks/017-game-screenshots.md)
- 018: [The price check reads the catalyst quality of rings, amulets and jewels](tasks/018-catalyst-quality-lines.md)
- 019: [The price check matches keystone lines to the stat the item has](tasks/019-keystone-lines.md)
- 020: [Copy the items whose parser cases are built by hand](tasks/020-copy-items-for-hand-built-parser-cases.md)
- 021: [Stash detection sees the open tab, and its grid and marks lie on the cells](tasks/021-stash-detection.md)
