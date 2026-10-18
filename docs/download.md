---
title: Download
---

<script setup>
import { useData } from 'vitepress'

const { theme } = useData()
</script>

You can download Kalandra here. Any other mirrors are not known
to the developer, downloading from them may be unsafe or malicious.

| Download link                                                                                                                                      | Automatic updates | Startup time |
| -------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------- | ------------ |
| <a :href="`${theme.github.releasesUrl}/download/v${theme.appVersion}/Kalandra-Setup-${theme.appVersion}.exe`">Windows 10+ (installer)</a> | ✔                 | Fast         |
| <a :href="`${theme.github.releasesUrl}/download/v${theme.appVersion}/Kalandra-${theme.appVersion}.exe`">Windows 10+ (portable)</a>        | ❌                 | Slower       |
| <a :href="`${theme.github.releasesUrl}/download/v${theme.appVersion}/Kalandra-${theme.appVersion}.AppImage`">Linux (AppImage)</a>         | ✔                 | n/a          |
| <a :href="`${theme.github.releasesUrl}/download/v${theme.appVersion}/Kalandra-${theme.appVersion}-universal.dmg`">macOS (dmg)</a>         | ❌                 | n/a          |

Latest version is <span class="bg-gray-100 border rounded px-1">{{ theme.appVersion }}</span>

*The app is unsigned, which means you'll have to bypass security
warnings on Windows and [macOS](https://support.apple.com/en-us/HT202491#openanyway) to open it.{:.text-sm}


---

### Requirements

- PoE display mode
  - ✔ Windowed Fullscreen, Windowed
  - ❌ Fullscreen
- PoE language
  - ✔ English, Russian, Portuguese, French, German, Spanish, Korean, Traditional Chinese, Japanese
  - ❌ Thai

No Administrator rights required, but\
⚠ **If you run PoE client as Admin, OS security boundaries take effect.
In order for Kalandra to have access to the PoE window, it must be started with Administrator rights.**

❌ **Not compatible with "GeForce Now" or any other cloud gaming service that do not forward clipboard data.**

---

### Moving from Exiled Exchange 2

Kalandra installs beside Exiled Exchange 2 and keeps its settings in its own folder.

1. Download and run the installer from above
2. Run Kalandra once, then quit it
3. Quit Exiled Exchange 2
4. Copy `apt-data` from `%APPDATA%\exiled-exchange-2` to `%APPDATA%\kalandra`, replacing the one there
  - Resulting directory structure should look like this:
  - `%APPDATA%\kalandrapt-data\`
    - `config.json`
5. Start Kalandra

### Moving from POE1/Awakened PoE Trade

**IMPORTANT:** If you are following this, all steps are required. Most problems occur with not doing step 7.

1. Download latest release from above
2. Run installer
3. Run Kalandra
4. Launch PoE2 to generate correct files
5. Quit PoE2 and Kalandra after seeing the banner popup that Kalandra loaded
6. Copy `apt-data` from `%APPDATA%wakened-poe-trade` to `%APPDATA%\kalandra` to copy your previous settings
  - Resulting directory structure should look like this:
  - `%APPDATA%\kalandrapt-data\`
    - `config.json`
7. **IMPORTANT:** Edit `config.json` and change the value of "windowTitle": "Path of Exile" to instead be "Path of Exile 2", otherwise it will open only for poe1
8. Start Kalandra and PoE2
