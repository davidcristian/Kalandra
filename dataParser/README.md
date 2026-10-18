# Data Parser

See [main.py](./src/main.py) for the main entry point. This should be ran from the dataParser folder with the following command:

```bash
python ./src/main.py
```

You can use `--help` to see all options. Running with images will take forever so keep that in mind.

## Updating the app's data

`--push` copies the generated `stats.ndjson`, `items.ndjson` and `client_strings.js` for each language into
`renderer/public/data/`. `--main-repo-path` sets the repo root and defaults to `..`, the parent of this folder.
After a push, run `npm run make-index-files` in `renderer/` to rebuild the index files.
