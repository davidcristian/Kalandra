---
title: OCR guide
---

OCR (optical character recognition) reads text from an image. Kalandra uses it for one task: reading skill gem names
from the game screen. When you press the OCR key, Kalandra takes a screenshot of the game window, reads the gem names
in it, and adds each matching gem to the Item search widget with its price from Kalandra's price service.
[Extra widgets](/extra-widgets#item-search) describes that widget.

OCR works only on Windows, and only when the **Language** setting on the **General** settings page is English or
Russian. When Kalandra starts with any other language, the OCR key does nothing and shows no error. The OCR key is the
**Perform an OCR for a Skill Gem** setting of the Item search widget, and it has no default.

## What the OCR key reads

Kalandra searches the screenshot for a small lock icon, the image in the file `heist-lock.bmp`. When it finds two
lock icons on the same line, it reads the text between them as one gem name. It skips a line when its text
recognition score is 30 or less out of 100.

Kalandra then compares each name it read with every skill gem name in its game data, written with the prefix
Anomalous, Divergent or Phantasmal in the language of the **Language** setting. It adds the gem with the closest name
to the widget, without the prefix. These prefixes name the alternate quality gems of Heist, a Path of Exile 1
feature. No item in Kalandra's Path of Exile 2 item data has one of these prefixes.

The gems appear in the row at the top of the widget. [Extra widgets](/extra-widgets#item-search) describes how many
items the row holds, how it sorts them and what a click on one does.

## Install the OCR files

1. Download [cv-ocr.zip](https://github.com/SnosMe/awakened-poe-trade/releases/download/v3.20.10007/cv-ocr.zip)
   (about 5 MB) from release v3.20.10007 of Awakened PoE Trade on GitHub. Kalandra does not publish its own copy of
   these files.

2. Right-click the Kalandra icon in the system tray and click **Open config folder**. This opens
   `%APPDATA%\kalandra\apt-data`.

   ![Tray menu of Kalandra with the Open config folder item](/reference-images/toolbar-config.png)

3. Extract the `cv-ocr` folder from the archive into that folder, so that the files are in
   `%APPDATA%\kalandra\apt-data\cv-ocr`:

   ```
   apt-data/
   ├── config.json
   └── cv-ocr/
       ├── eng.traineddata
       ├── heist-lock.bmp
       ├── opencv.js
       ├── tesseract-core-simd.js
       ├── tesseract-core-simd.wasm
       └── ... more files ...
   ```

   Kalandra reads `tesseract-core-simd.js` (the Tesseract text recognition library), `opencv.js` (the OpenCV image
   library), `heist-lock.bmp` and one language file: `eng.traineddata` for English or `rus.traineddata` for Russian.

4. Restart Kalandra. It loads the OCR files only when it starts. If the files are missing or in the wrong folder, the
   OCR key does nothing and shows no error.

## Set the OCR key

1. Press `Shift + Space`, the default overlay key, to open the overlay. Click the magnifier next to the cog icon
   to show the Item search widget. Leave the widget shown when you close the overlay, because the OCR results appear
   in it.

   ![The main button bar with the cog icon, then the magnifier of the Item search widget](/reference-images/mainWidget.png)

2. Hover the widget and click **edit**. This opens the **Item search** settings page.

3. Set a key for **Perform an OCR for a Skill Gem** and click **Save**.

## Use the OCR key

1. Open the game screen that lists the gem names. A lock icon must be fully visible at each end of a gem name, because
   Kalandra reads only the text between two icons.
2. Make sure that no health bar or other element covers a gem name.
3. Press the OCR key. When it adds a gem while the overlay is closed, the Item search widget shows over the game for
   4 seconds with the gems and their prices.
