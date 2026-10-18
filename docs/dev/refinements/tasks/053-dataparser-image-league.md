# The image lookup searches a fixed league

**Status:** open
**Area:** dataparser
**Origin:** [dataParser/src/services/image_provider.py](../../../../dataParser/src/services/image_provider.py)
**Verified:** 2026-10-18

`SEARCH_URL` in `image_provider.py` is
`https://www.pathofexile.com/api/trade2/search/Fate%20of%20the%20Vaal`, so every image lookup
searches the trade league `Fate of the Vaal`. No other file in `dataParser/src/` names a league.
The poe.ninja league list committed on 18 Oct 2026 in
`priceService/tests/fixtures/ninja/leagues.json` lists `Forbidden Rites`, `Runes of Aldur`, their
`HC` leagues, `Standard` and `Hardcore`, and not that league. Agents send no request to the trade
site, so whether it still accepts a search in that league is not checked.

Step 3 of [runbooks/game-data-update.md](../../runbooks/game-data-update.md) tells the reader to
change `SEARCH_URL` to a current league in its own commit before each icon lookup.

Done looks like: the league is a setting of the tool or comes from the trade site's league list at
run time. [modules/dataparser.md](../../modules/dataparser.md) says which, and step 3 of the
runbook no longer asks for a code change.

## History

- 2026-10-18: Found while the game data update runbook was written.
