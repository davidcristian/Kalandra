# remnants.json and two dataParser output files are unused

**Status:** open
**Area:** data
**Origin:** [renderer/public/data/remnants.json](../../../../renderer/public/data/remnants.json)
**Verified:** 2026-10-27

Three tracked files have no reader:

- `renderer/public/data/remnants.json` holds a `recipes` map. Its keys have the form `Adaptive|1|2`
  and its values are lists of numbers. It was added in the Exiled Exchange 2 data update commit of
  2026-09-03 and changed in the one of 2026-09-05. A search for `remnants` in the `.ts`, `.vue`,
  `.js`, `.mjs` and `.py` files outside `renderer/public/data/` and `dataParser/output/` finds
  nothing, so no code reads the file. `dataParser/` does not write it, and
  [modules/dataparser.md](../../modules/dataparser.md) lists it among the files that are not that
  tool's output. Nothing records where it comes from.
- `dataParser/src/output.ndjson` holds stat lines in UTF-16 and `dataParser/src/output_i.ndjson`
  holds item lines in Russian. `dataParser/src/main.py` writes only to `output/<lang>/`, and a
  search of the tree finds no reference to either name.

Vite copies everything under `renderer/public/` into the build, so `remnants.json` (about 170 KB)
is in every release.

Done looks like: the maintainer confirms each file is unused and removes it, or names its reader
and its generator in modules/dataparser.md, so that the next data update writes it again.

## History

- 2026-10-18: Found while the renderer and dataParser module docs were written, by searching the
  tree for each file name.
- 2026-10-18: Checked against the tree. Replaced the search result for `remnant`: the game data
  and the test data contain the word in many item and stat names, and no code file contains it.
- 2026-10-27: The maintainer confirmed that the three files are unused and chose to remove them.
  Checked again: no code reads any of them.
