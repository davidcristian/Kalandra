# The default macOS Client.txt path is the folder of the Path of Exile 1 Mac client

**Status:** done 2026-10-26
**Area:** main
**Origin:** [main/src/host-files/GameLogWatcher.ts](../../../../main/src/host-files/GameLogWatcher.ts)
**Verified:** 2026-10-26

On macOS, `GameLogWatcher` looks for `Client.txt` only in `~/Library/Caches/com.GGG.PathOfExile/Logs/`,
the folder of the Path of Exile 1 Mac client, and [docs/settings.md](../../../settings.md) lists the
same folder. Every other default path in `GameLogWatcher.ts` and `GameConfig.ts` names Path of
Exile 2. The macOS path came with the macOS support of 2023, and the change of 2024-12-09 that moved
the other paths to Path of Exile 2 kept it. The macOS config path, `Path of Exile 2/Preferences/`
under the application data folder, came from that change as a text replacement, also without a
check on a Mac.

No file in the repo or the docs gives the folder where Path of Exile 2 writes `Client.txt` on
macOS, and a web search on 2026-10-25 found no source for it. The Path of Exile wiki's
[Mac guide](https://www.poewiki.net/wiki/Guide:Path_of_Exile_on_Mac_using_Windows_Client) says that
Path of Exile 2 has no native Mac client, so Mac players run the Windows client through a
compatibility layer, which writes the log inside its Windows prefix. A path picked without a source
would replace one guess with another, so the code is unchanged. Until then a Mac user enters the
path in **PoE log file**.

Done looks like: someone on a Mac with Path of Exile 2 finds `Client.txt` and
`poe2_production_Config.ini` for each way the game runs there, and one commit sets those paths in
`GameLogWatcher.ts`, `GameConfig.ts` and docs/settings.md. No host task covers macOS, because
[host/](../../host/index.md) holds only checks on Windows.

## History

- 2026-10-25: Found while the default file search was changed to log unreadable files, by
  comparing the default paths of each platform.
- 2026-10-26: The maintainer chose to stop guessing on macOS until a Mac user reports the Path of
  Exile 2 path. Done in `fix(main): stop guessing the macOS paths of the game log and config`.
  `defaultLogFiles()` and `defaultConfigFiles()` return no path on macOS, so the settings stay
  empty until the user enters each file, and no warning names a file at a guessed path.
