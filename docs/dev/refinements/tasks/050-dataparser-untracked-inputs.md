# dataParser's inputs and image cache are neither committed nor ignored

**Status:** done 2026-10-27
**Area:** dataparser
**Origin:** [dataParser/src/services/image_provider.py](../../../../dataParser/src/services/image_provider.py)
**Verified:** 2026-10-27

`ImageProvider` in `image_provider.py` reads the item image cache `src/services/itemImageCache.json`,
which is not committed. Its constructor creates that file when it is missing, and `main()` in `main.py`
copies it to a backup, `itemImageCache.old.json`, once per run. With the default `--image-mode noLookup`, `get_image()` returns
`%NOT_FOUND%` for every item the cache does not hold. `build_items_ndjson()` in
`nd_builder_service.py` then replaces the icon only for the items that the trade site's
`static.json` has an image for. So a `noLookup` run without the cache writes `%NOT_FOUND%` for
every other item. On 2026-10-18, `grep -c '%NOT_FOUND%' renderer/public/data/en/items.ndjson` counts 445 lines
with that value in the committed data.

The inputs that `--pull` writes are the game export under `data/vendor/tables/` and `data/vendor/files/`
and the trade data under `data/json/<lang>/`. Neither they nor the two cache files match an entry
in any `.gitignore`: `git check-ignore` prints nothing for `data/vendor/tables/English/x.json`,
`data/json/en/stats.json`, `src/services/itemImageCache.json` or
`src/services/itemImageCache.old.json`. So `git status` lists them as untracked after a run.

Done looks like: the maintainer decides where the cache is kept. It is committed, or it is kept
outside the repo at a place that [runbooks/game-data-update.md](../../runbooks/game-data-update.md)
names. Then `dataParser/.gitignore` ignores the game export, the trade data, the backup and, when
the cache stays outside the repo, the cache. The `.gitkeep` files stay tracked.

## History

- 2026-10-18: Found while the game data update runbook was written, by running `git check-ignore`
  on the paths a run writes.
- 2026-10-25: The backup moved from the `ImageProvider` constructor to `main()`. The other claims
  still hold: no `.gitignore` matches these paths, and the count is still 445.
- 2026-10-27: The maintainer chose to keep the cache local to each machine. Left:
  `dataParser/.gitignore` ignores the cache, its backup, the game export and the trade data and
  keeps the `.gitkeep` files, and the game data update runbook says the cache is local.
- 2026-10-27: chore(dataparser): ignore the inputs and image cache a run writes. The
  game data update runbook says the cache is local to each machine.
