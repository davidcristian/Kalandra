# Refinements

This folder holds deferred work that anyone can pick up: a bug or an inconsistency in the code or
the docs, a missing test or feature, or a decision the maintainer has to make. Each task is one file
in [tasks/](tasks/). A task keeps its file after it closes, because its Status and History record
what the work became.

**Checks that need Path of Exile 2 running on Windows are in [host/](../host/index.md)** instead. A
refinement needs no game: an agent or a contributor with the repo can work it, although some wait
for the maintainer's decision or go-ahead first. A host task is a check that only the maintainer
can run. When a host check finds a bug, the bug is filed here.

Rule 8 of [AGENTS.md](../../../AGENTS.md#what-every-change-must-pass) says work deliberately left
for later gets a task file here. [ADR-0008](../adr/ADR-0008-developer-docs-layout.md) gives the
layout and its reasons.

## How to work a task

1. **Pick** a task from the list below. The list gives no status, so open the file:
   `**Status:** open` means it is still to do.
2. **Check the task's claim against the code before you start.** The `**Verified:**` line is the
   day someone last did that. The code moves, so search for the files and symbols the task names,
   since a task never gives line numbers. If the tree no longer matches, update the file, or close
   it with a History line that says what changed. Write the day you checked on the Verified line.
3. **Work it** under [AGENTS.md](../../../AGENTS.md): tests, docs and one logical change per
   commit. A task that names a decision for the maintainer waits for that decision, and the
   decision goes into its History.
4. **Close it in its own file.** Change the Status line to `done <date>` or `declined <date>` and
   add a History line that says what the task became, such as the commit subject or the reason for
   declining it. Do not write the status in this list, in a title or in another task
   ([ADR-0008](../adr/ADR-0008-developer-docs-layout.md), decision 6).
5. **File what the close opened.** A close often leaves narrower work. Give it a new file with the
   next free number, and name it in the History of both tasks.
6. **Add the new task to this list by hand**, with its number, title and link, in the same commit
   as its file. `scripts/backlogcheck.py` checks that the list and the task files match: each file
   listed once, in number order, with its heading as the title and one status from the list below.
   It also checks each file against the template below: one of each `**Name:**` line, an Area from
   its list, a link as the Origin, a date as Verified, and a History of `- <date>: ` lines.

## Statuses

- `open`: still to do.
- `done <date>`: finished on that date; the History says how.
- `declined <date>`: decided against on that date; the History says why.

## A task file

```markdown
# <What is wrong, as a statement>

**Status:** open
**Area:** <config, main, renderer, parser, trade, docs, data, dataparser, priceservice, ci, release, repo or rules>
**Origin:** [<the file or doc it came from>](<relative link>)
**Verified:** <date the claim was last checked against the code>

<What is wrong, with the files and symbols that show it. What done looks like.>

## History

- <date>: <how it was found, or what happened to it>
```

## Tasks

- 001: [A failed read of config.json can replace the saved config with defaults](tasks/001-failed-config-read-saves-defaults.md)
- 002: [A config.json that is not valid JSON stops the renderer from starting](tasks/002-unparsable-config-stops-renderer.md)
- 003: [Save in the Settings window does not write config.json at once](tasks/003-settings-save-writes-config-late.md)
- 004: [An older Kalandra uses a config written by a newer version without a check](tasks/004-older-version-uses-newer-config.md)
- 005: [No test covers upgradeConfig, defaultConfig or getConfigForHost](tasks/005-config-upgrade-tests.md)
- 006: [The static file and /uploads routes serve files outside their folders](tasks/006-server-files-outside-folders.md)
- 007: [The /events WebSocket accepts a connection from any origin](tasks/007-events-websocket-origin.md)
- 008: [--listen without = stops the local server from starting](tasks/008-listen-option-without-value.md)
- 009: [macOS reports updates as not supported but still downloads them](tasks/009-macos-updater-auto-download.md)
- 010: [OCR errors are dropped by empty catch blocks](tasks/010-ocr-errors-dropped.md)
- 011: [client-log.ndjson drops its first entry and can mix up its lines](tasks/011-client-log-file-writer.md)
- 012: [The test registration of the copy keys never runs](tasks/012-copy-key-test-registration.md)
- 013: [Renderer errors such as a missing price file do not reach Settings, Debug](tasks/013-renderer-errors-not-in-debug.md)
- 014: [The Map check remove button also clears the marks of later profiles](tasks/014-map-check-remove-clears-profiles.md)
- 015: [Three default Map check marks are not in the game data](tasks/015-default-map-marks-outdated.md)
- 016: [Augments saved for martial weapons are never applied](tasks/016-martial-weapon-augments.md)
- 017: [The complex query hint names a setting that does not exist](tasks/017-complex-query-hint.md)
- 018: [Decide what happens to the poeprices price prediction setting](tasks/018-price-prediction-setting.md)
- 019: [UI text that is not in the English app_i18n.json](tasks/019-ui-text-not-in-app-i18n.md)
- 020: [The About page subreddit label does not match its link](tasks/020-about-page-subreddit-label.md)
- 021: [The XP button does not follow the Client.txt setting until a Save](tasks/021-xp-button-and-client-log-setting.md)
- 022: [Category checks for item kinds the Path of Exile 2 data does not have](tasks/022-category-checks-for-missing-item-kinds.md)
- 023: [The OCR handler throws when no gem name has a close length](tasks/023-ocr-handler-no-close-match.md)
- 024: [The player-death charName starts with a colon and a space](tasks/024-player-death-char-name.md)
- 025: [The bulk search Browser button does not always open the built-in browser](tasks/025-bulk-search-browser-button.md)
- 026: [The wrong language message can name English for an item in another language](tasks/026-wrong-language-message.md)
- 027: [Map check and Item info are two hotkey rows for one setting](tasks/027-map-check-item-info-hotkey.md)
- 028: [A TradeData.ts comment gives the wrong interest window](tasks/028-trade-data-interest-comment.md)
- 029: [remnants.json and two dataParser output files are unused](tasks/029-unused-data-files.md)
- 030: [The price prediction code has no tests](tasks/030-rate-limiter-and-league-tests.md)
- 031: [Decide whether the Path of Exile 1 features stay](tasks/031-path-of-exile-1-features.md)
- 032: [The README's graph image is on imgur](tasks/032-readme-imgur-graph.md)
- 033: [Take current screenshots of the Settings window and the add widget menu](tasks/033-app-screenshots.md)
- 034: [Check the cv-ocr.zip file list and decide where the archive comes from](tasks/034-cv-ocr-archive.md)
- 035: [crowdin.yml maps translations while AGENTS.md says no service is connected](tasks/035-crowdin-config.md)
- 036: [Issues and Discussions are off on the GitHub repo that the app and the docs link](tasks/036-discussions-links.md)
- 037: [The type check hooks do not run for a change only in ipc/](tasks/037-type-check-hooks-skip-ipc.md)
- 038: [The Build workflow runs for pushes that change no file of the app](tasks/038-build-workflow-paths.md)
- 039: [The Build workflow does not set the token permissions a release upload needs](tasks/039-build-workflow-permissions.md)
- 040: [testUpdate.sh runs npm install instead of npm ci](tasks/040-test-update-script-npm-ci.md)
- 041: [Choose the first Kalandra version above the inherited tags](tasks/041-first-release-version.md)
- 042: [origin holds Exiled Exchange 2's branches, including dev](tasks/042-inherited-branches-on-origin.md)
- 043: [The league, stat and item list requests use no rate limiter](tasks/043-trade-list-requests-without-limiter.md)
- 044: [Adding a widget needs a cast that AGENTS.md rule 7 forbids](tasks/044-widget-registry-cast.md)
- 045: [main recognizes copied item text with string literals](tasks/045-item-text-literals-in-main.md)
- 046: [Record why Kalandra is under the AGPL v3](tasks/046-agpl-reason.md)
- 047: [The source and version of the game export command are not recorded](tasks/047-dataparser-export-command.md)
- 048: [dataParser declares none of its Python dependencies](tasks/048-dataparser-dependencies.md)
- 049: [dataParser has no data/json/fr folder, so a French pull fails](tasks/049-dataparser-french-folder.md)
- 050: [dataParser's inputs and image cache are neither committed nor ignored](tasks/050-dataparser-untracked-inputs.md)
- 051: [dataParser tests need files the repo does not have, and CI does not run them](tasks/051-dataparser-tests-and-ci.md)
- 052: [This copy of dataParser produces older data than the app ships](tasks/052-dataparser-older-than-committed-data.md)
- 053: [The image lookup searches a fixed league](tasks/053-dataparser-image-league.md)
- 054: [create-styles.py copies to a folder the repo does not have](tasks/054-dataparser-create-styles.md)
- 055: [dataParser uses a different Korean trade host from the app](tasks/055-dataparser-korean-host.md)
- 056: [A null list in a poe.ninja response stops the price service](tasks/056-price-service-null-lists.md)
- 057: [Check the GitHub, Cloudflare and Docker behaviors the runbooks describe](tasks/057-outside-service-behaviors.md)
- 058: [A stat without a trade id for its modifier type makes a filter without a trade id](tasks/058-stat-without-trade-id-for-its-type.md)
- 059: [The parser cannot distinguish items that share a translated name and defences](tasks/059-shared-translated-item-names.md)
- 060: [The clipboard restore after a chat command can come before the game pastes](tasks/060-clipboard-restore-before-paste.md)
- 061: [The Carapace Catalyst matches no modifier tag that Path of Exile 2 copies](tasks/061-carapace-catalyst-defences-tag.md)
- 062: [The price check looks up a base item price that the price file never has](tasks/062-base-item-estimate.md)
- 063: [The trade site's item and stat lists match only English item text](tasks/063-trade-lists-english-only.md)
- 064: [The parser cannot distinguish some stats that share a text](tasks/064-shared-stat-texts.md)
- 065: [The stats.ndjson files of the languages differ in their refs and stats](tasks/065-stat-refs-differ-between-languages.md)
- 066: [ConfigStore sends config-changed before the save is written](tasks/066-config-changed-before-write.md)
- 067: [An event the page sends while the events socket reopens is lost](tasks/067-events-sent-while-socket-reopens.md)
- 068: [The listing tooltip names an unidentified item's tier in English](tasks/068-unidentified-tier-tag.md)
- 069: [The Settings window does not show the hotkeys that main cannot register](tasks/069-unregistered-hotkeys-in-settings.md)
- 070: [Existing code in main and the renderer leaves promises floating](tasks/070-floating-promises-in-existing-code.md)
- 071: [Existing code in main breaks the empty catch checks of rule 7](tasks/071-type-and-catch-rules-in-existing-code.md)
- 072: [The preset Stash search widgets search English text](tasks/072-stash-search-presets-in-english.md)
- 073: [The client log parser matches most chat lines with English text](tasks/073-client-log-chat-lines-in-english.md)
- 074: [The parser reads modifier suffixes, separators and the socket letter with literals](tasks/074-parser-separators-and-suffixes.md)
- 075: [Hybrid armour bases start with every defence filter enabled](tasks/075-hybrid-armour-defence-filters.md)
- 076: [A ConfigStore test waits for real timers](tasks/076-main-tests-wait-for-real-timers.md)
- 077: [Item icons load from web.poecdn.com outside the proxy](tasks/077-item-icons-outside-proxy.md)
- 078: [Decide whether the app shows the Patreon links to Awakened PoE Trade's author](tasks/078-patreon-links-in-comments.md)
- 079: [The map property filters send only their minimum to the trade site](tasks/079-map-filters-send-only-minimum.md)
- 080: [The data loader imports the trade list loader from the web code](tasks/080-data-loader-imports-trade-data.md)
- 081: [The anointment filter decodes oil indexes with its own copy of a game table's order](tasks/081-oil-names-follow-game-table-order.md)
- 082: [Code still checks item names and fields that the Path of Exile 2 data does not have](tasks/082-checks-for-item-names-the-data-lacks.md)
- 083: [The Library widget saves mod options that nothing reads](tasks/083-library-mod-options-unread.md)
- 084: [The German data searches each Time-Lost jewel conqueror one option too low](tasks/084-german-time-lost-jewel-ids.md)
- 085: [Four committed client string regexes read game text characters as regex syntax](tasks/085-unescaped-client-string-regexes.md)
- 086: [The committed data has five unique items without a name and 18 client strings nothing reads](tasks/086-unique-names-and-unread-client-strings.md)
- 087: [The renderer build needs Vite's legacy CommonJS interop for vue3-apexcharts](tasks/087-legacy-commonjs-interop-for-apexcharts.md)
- 088: [Two tips name controls by labels the app does not show](tasks/088-tips-name-labels-the-app-does-not-show.md)
- 089: [The poedb button opens a flask's or a tablet's own page instead of its calculator](tasks/089-poe2db-flask-and-tablet-pages.md)
- 090: [The XP tracker page describes Over in words that differ from its formula at a safe zone step](tasks/090-xp-tracker-over-wording.md)
- 091: [Ten modules in main and the renderer have no spec that imports them](tasks/091-modules-without-a-spec.md)
- 092: [The default macOS Client.txt path is the folder of the Path of Exile 1 Mac client](tasks/092-macos-client-log-path.md)
- 093: [Existing code in main and the renderer uses non-null assertions](tasks/093-non-null-assertions-in-existing-code.md)
- 094: [No check follows a link to another site](tasks/094-no-check-for-links-to-other-sites.md)
- 095: [No ESLint config checks type assertions on object literals](tasks/095-object-literal-type-assertions.md)
- 096: [The trade site's league and item lists name no Hardcore league and no trade tag](tasks/096-trade-site-lists-lack-hardcore-and-trade-tags.md)
- 097: [A stat whose roll range crosses zero always gets the text without negate](tasks/097-stat-range-across-zero-text.md)
- 098: [Saved configs of versions 2 to 21 upgrade without some keys of defaultConfig()](tasks/098-old-configs-lack-default-keys.md)
- 099: [A saved config without a price check widget stops the overlay from starting](tasks/099-config-without-price-check-throws.md)
- 100: [No test covers getConfigForHost](tasks/100-host-config-tests.md)
- 101: [The clipboard restore after a stash search can come before the game pastes](tasks/101-clipboard-restore-before-stash-search.md)
