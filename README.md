# ![Perfect Jewelers Orb](./renderer/public/images/jeweler.png) Kalandra

[![GitHub Downloads (specific asset, latest release)](https://img.shields.io/github/downloads/davidcristian/Kalandra/latest/Kalandra-Setup-0.16.3.exe?style=plastic)](https://tooomm.github.io/github-release-stats/?username=davidcristian&repository=Kalandra)
[![GitHub Tag](https://img.shields.io/github/v/tag/davidcristian/Kalandra?style=plastic&label=latest%20version)](https://github.com/davidcristian/Kalandra/releases/latest)
[![GitHub commits since latest release (branch)](https://img.shields.io/github/commits-since/davidcristian/Kalandra/latest/master?style=plastic)](https://github.com/davidcristian/Kalandra/commits/master/)
[![license: AGPL-3.0](https://img.shields.io/badge/license-AGPL--3.0-3b82f6)](LICENSE)

Path of Exile 2 overlay program for price checking items, among many other loved features.

Kalandra continues [Exiled Exchange 2](https://github.com/Kvan7/Exiled-Exchange-2) by Kvan7, which is a fork of
[Awakened PoE Trade](https://github.com/SnosMe/awakened-poe-trade) by SnosMe.

The only official download sites are <https://davidcristian.github.io/Kalandra/download> and
<https://github.com/davidcristian/Kalandra/releases>. Any other location is not official and may be malicious.

## Moving from Exiled Exchange 2

Kalandra installs beside Exiled Exchange 2 and keeps its settings in its own folder.

1. Download the latest release from [releases](https://github.com/davidcristian/Kalandra/releases) and run the installer
2. Run Kalandra once, then quit it
3. Quit Exiled Exchange 2
4. Copy `apt-data` from `%APPDATA%\exiled-exchange-2` to `%APPDATA%\kalandra`, replacing the one there
5. Start Kalandra

## Moving from POE1/Awakened PoE Trade

1. Download latest release from [releases](https://github.com/davidcristian/Kalandra/releases)
2. Run installer
3. Run Kalandra
4. Launch PoE2 to generate correct files
5. Quit PoE2 and Kalandra after seeing the banner popup that Kalandra loaded
6. Copy `apt-data` from `%APPDATA%\awakened-poe-trade` to `%APPDATA%\kalandra` to copy your previous settings
  - Resulting directory structure should look like this:
  - `%APPDATA%\kalandra\apt-data\`
    - `config.json`
7. Edit `config.json` and change the value of "windowTitle": "Path of Exile" to instead be "Path of Exile 2", otherwise it will open only for poe1
8. Start Kalandra and PoE2

## FAQ

<https://davidcristian.github.io/Kalandra/faq>

## Tool showcase

| Gem                                                | Rare                                                 | Unique                                                   | Currency                                                     |
| -------------------------------------------------- | ---------------------------------------------------- | -------------------------------------------------------- | ------------------------------------------------------------ |
| ![Gem Check](./docs/reference-images/GemCheck.png) | ![Rare Check](./docs/reference-images/RareCheck.png) | ![Unique Check](./docs/reference-images/UniqueCheck.png) | ![Currency Check](./docs/reference-images/CurrencyCheck.png) |

### Development

See [DEVELOPING.md](./DEVELOPING.md). The rules every change follows are in [AGENTS.md](./AGENTS.md).

### Acknowledgments

- [Exiled Exchange 2](https://github.com/Kvan7/Exiled-Exchange-2)
- [awakened-poe-trade](https://github.com/SnosMe/awakened-poe-trade)
- [libuiohook](https://github.com/kwhat/libuiohook)
- [RePoE](https://github.com/brather1ng/RePoE)
- [poeprices.info](https://www.poeprices.info/)
- [poe.ninja](https://poe.ninja/)

![graph](https://i.imgur.com/MATqhv7.png)

## License

Kalandra is licensed under the [GNU Affero General Public License v3.0](LICENSE). It contains code from Awakened
PoE Trade and Exiled Exchange 2 under the [MIT License](LICENSES/MIT.txt).
