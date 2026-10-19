---
title: Download
---

<script setup>
import { useData } from 'vitepress'

const { theme } = useData()
</script>

Download Kalandra only from this page or from the
[releases page on GitHub](https://github.com/davidcristian/Kalandra/releases). A copy from any other site can
contain malware.

| Download | Updates itself |
| --- | --- |
| <a :href="`${theme.github.releasesUrl}/download/v${theme.appVersion}/Kalandra-Setup-${theme.appVersion}.exe`">Windows 10 or later (installer)</a> | Yes |
| <a :href="`${theme.github.releasesUrl}/download/v${theme.appVersion}/Kalandra-${theme.appVersion}.exe`">Windows 10 or later (portable)</a> | No |
| <a :href="`${theme.github.releasesUrl}/download/v${theme.appVersion}/Kalandra-${theme.appVersion}.AppImage`">Linux (AppImage)</a> | Yes |
| <a :href="`${theme.github.releasesUrl}/download/v${theme.appVersion}/Kalandra-${theme.appVersion}-universal.dmg`">macOS (dmg)</a> | No |

These links download version {{ theme.appVersion }}. If a link returns an error, open the
[releases page](https://github.com/davidcristian/Kalandra/releases), which lists every published version.

The portable download runs without being installed. It starts slower than an installed copy because it unpacks
itself on each start. The macOS file is a universal build that runs on both Intel and Apple silicon Macs.

*Kalandra is not code signed, so Windows SmartScreen and macOS Gatekeeper show a warning before its first start. On
Windows, click More info and then Run anyway. On macOS, follow
[Apple's steps to open an app anyway](https://support.apple.com/en-us/HT202491#openanyway).*{:.text-sm}

## After installing

Kalandra runs in the background with an icon in the system tray (the menu bar on macOS). Right-click the icon for the
[tray menu](/settings#tray-menu). When Kalandra finds the Path of Exile 2 window, it shows "Is ready and running in
background" over the game for a few seconds. [Quick start](/quick-start) shows the default hotkeys.

## Requirements

- Path of Exile 2 display mode: Windowed or Windowed Fullscreen. The overlay does not work in Fullscreen mode.
- Path of Exile 2 language: English, Russian, Portuguese (Brazil), French, German, Spanish, Korean, Traditional
  Chinese or Japanese. Kalandra does not support Thai. Set the same language in Kalandra under Settings, General,
  **Language**.
- Kalandra does not need administrator rights. If you run Path of Exile 2 as administrator, run Kalandra as
  administrator too. Windows does not let a program without administrator rights send key presses to one that has
  them. When Kalandra finds the game window but cannot reach it, it shows the error "Path of Exile 2 is running with
  administrator rights."
- Kalandra reads the item text from the clipboard of the computer it runs on. It does not work with GeForce NOW or
  any other cloud gaming service that does not copy the game's clipboard to your computer.

Some parts depend on the operating system:

- **Windows.** OCR, which reads skill gem names from a screenshot ([OCR guide](/ocr-guide)), works only on Windows.
- **macOS.** Kalandra needs the Accessibility permission to read hotkeys and send key presses. When it starts without
  the permission, macOS asks you to grant it. Kalandra waits 15 seconds for the permission and starts when you grant
  it. If you do not grant it in that time, Kalandra quits: grant it in System Settings under Privacy & Security,
  Accessibility, then start Kalandra again.
- **Linux.** If Kalandra does not find the game's log file or config file, enter its path in Settings, General
  ([Settings](/settings) lists both).

## Updates

Kalandra checks GitHub for a new version shortly after it starts and every 16 hours while it runs. **Check now** in
Settings, About checks at once. What happens when a new version exists depends on the download you installed:

- **Windows installer and Linux AppImage.** Kalandra downloads the update in the background and installs it when you
  quit Kalandra. Settings, About then shows "It will be installed automatically on exit" and an **Install now**
  button, which closes Kalandra and installs the update at once.
- **Windows portable and macOS.** These downloads do not update themselves. Download the new version from the
  releases page yourself: **Open the Downloads page** in Settings, About opens it. On the portable download, Settings,
  About and the price check window show "Update available" with the version number and "You can download it from
  GitHub".

The [`--no-updates` option](/cmd-flags) turns off the download on the installer and the AppImage. Kalandra still
checks for updates and shows "You have disabled automatic updates download" when one exists.

An update keeps your settings.

## Where Kalandra keeps your settings

Kalandra stores its settings in `config.json` in a folder named `apt-data`. On Windows this folder is
`%APPDATA%\kalandra\apt-data\`. To open it, type `%APPDATA%\kalandra` in the File Explorer address bar, or use the
tray menu item **Open config folder**, which opens `apt-data` on every operating system. The same folder holds the
other files Kalandra saves, such as uploaded images and the OCR files.

## Moving from Exiled Exchange 2

Kalandra installs beside Exiled Exchange 2 and keeps its settings in its own folder. To copy your Exiled Exchange 2
settings on Windows:

1. Download the Windows installer above and install Kalandra.
2. Start Kalandra once, so that it creates the folder `%APPDATA%\kalandra`. Then quit it: right-click its tray icon
   and click **Quit**.
3. Quit Exiled Exchange 2.
4. Copy the `apt-data` folder from `%APPDATA%\exiled-exchange-2` to `%APPDATA%\kalandra`, replacing the one there if
   it exists. Your settings are then in `%APPDATA%\kalandra\apt-data\config.json`.
5. Start Kalandra.

## Moving from Awakened PoE Trade (Path of Exile 1)

Awakened PoE Trade is the Path of Exile 1 overlay that Exiled Exchange 2 was forked from. To copy its settings on
Windows:

1. Download the Windows installer above and install Kalandra.
2. Start Kalandra.
3. Start Path of Exile 2, so that the game writes its config file
   `Documents\My Games\Path of Exile 2\poe2_production_Config.ini`. Kalandra reads that file to learn the game's
   advanced item descriptions key.
4. When the notification "Is ready and running in background" appears over the game, quit Path of Exile 2 and
   Kalandra.
5. Copy the `apt-data` folder from `%APPDATA%\awakened-poe-trade` to `%APPDATA%\kalandra`, replacing the one there if
   it exists. Your settings are then in `%APPDATA%\kalandra\apt-data\config.json`.
6. Open `config.json` in a text editor and change `"windowTitle": "Path of Exile"` to
   `"windowTitle": "Path of Exile 2"`. Awakened PoE Trade saved the Path of Exile 1 window title, and Kalandra
   attaches the overlay to the window with this title. Later you can change it in Settings, General,
   **PoE window title**.
7. Start Kalandra and Path of Exile 2.
