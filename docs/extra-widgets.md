---
title: Extra widgets
---

This page covers five smaller widgets: the image strip, the stopwatch, the notepad, item search and the Delve grid.
[Widgets](/widgets) explains how to open the overlay and how the `hide`, `edit`, `move` and `delete` buttons work.

## Image strip

The Image strip widget shows a row of images over the game, such as cheat sheets. Hover over an image to show it at
full size in the center of the screen, up to the screen height. A large, high resolution image is the easiest to
read.

To add a strip, open the overlay (`Shift + Space` by default), hover over the three dots and click `Image strip`.
You can add more than one. A new strip has no title, shows `Untitled`, and has no images until you add them.

![The add widget menu with Image strip circled](/reference-images/AddImageStrip.png)

![An image shown at full size over the game while the mouse is over it](/reference-images/HoverImageStrip.jpg)

Click `edit` on the strip to change it:

1. Type a title in the `widget title` field.
2. Drag the arrows button in the middle of an image to change the order of the images.
3. Click the red cross on an image to remove it.
4. Click `Choose File` to add an image.

Click `edit` again to finish.

![The image strip in edit mode, with the title, move, remove and Choose File controls numbered 1 to 4](/reference-images/EditImageStrip.png)

Kalandra copies each added image into the `apt-data\files` folder of its data folder (`%APPDATA%\kalandra` on
Windows), so you can move or delete the original file. It adds PNG, JPEG, GIF, WebP, AVIF, BMP and ICO images, and
does not add another kind of file or an image larger than about 16 MB. When it does not add a file, a red message
under `Choose File` says so.

![An image strip titled Some Title with two images](/reference-images/SecondImageStripWidget.png)

![The first of the two images shown at full size over the game](/reference-images/SecondImageStrip.jpg)

## Stopwatch

The stopwatch counts hours, minutes and seconds. To add one, open the overlay, hover over the three dots and click
`Stopwatch`. You can add more than one, and each has its own hotkeys. A new stopwatch appears near the center of the
screen and shows `paused`.

![The add widget menu with Stopwatch circled](/reference-images/StopWatchAdd.png)

![A new stopwatch at 00:00:00 with the paused label](/reference-images/StopwatchPaused0.png)

Hover over the stopwatch to show its buttons. The play button starts it, the pause button stops it, and the circular
arrow resets the time.

![A stopwatch with the mouse over the play button](/reference-images/StopwatchHover.png)

![A running stopwatch with the mouse over the pause button](/reference-images/StopwatchPause.png)

To control the stopwatch while you play, click `edit` on it. Its page in the Settings window has two hotkeys,
`Start and Pause` and `Reset`, which start as `Not Set`. Set them and click `Save`. The hotkeys work while the game
window is active, without opening the overlay.

![The Stopwatch settings page with the Start and Pause and Reset hotkeys](/reference-images/StopwatchHotkeys.png)

A running stopwatch stays on screen after you close the overlay, and so does a paused one that holds one second or
more. A new or reset stopwatch closes with the overlay. The stopwatch has no `hide` button: delete it to remove it.

Kalandra does not save the time. When Kalandra starts again, every stopwatch starts at zero.

## Notepad

The Notepad widget is a text box for your own notes. To add one, open the overlay, hover over the three dots and click
`Notepad`. You can add more than one. A new notepad is named `Notepad` and shows `Type your notes here…` until you
type in it.

Kalandra saves the text in its config file when you close the overlay, so the notes are still there after a
restart.

Click `edit` on the notepad to change it:

- Type a new title in the field at the top.
- Click the minus and plus buttons next to `Width:` to switch between three widths: small, medium and large. A new
  notepad is medium.

Click `edit` again to finish.

## Item search

The Item search widget finds the price of an item by its name, so you can check an item that you cannot copy in the
game. Click the magnifier in the main button bar to show it.

1. Choose the kind of item after `Type of Item:`: `Skill Gems`, `Uniques` or `Base Items`. `Base Items` is
   selected when Kalandra starts.
2. Type the name in `Search by name…`. The widget lists the matches when there are five or fewer. Until you type
   three characters, and while more than five items match, it shows this message:
   `Too many items found, enter the name more precisely.` When three or more characters match no item, it shows
   `No items found.`
3. Click `Select` on a match. Kalandra adds the item to the row at the top of the widget, with its price from
   Kalandra's price service when the price file has one.
4. Click an item in the row to open the price check for it. A skill gem is checked at gem level 1.

The row holds five items, sorted from the highest price to the lowest. Selecting a sixth item starts a new row with
it, and selecting an item that is already in the row does nothing. `Reset items` clears the row.

Item search has only the `hide` and `move` buttons. It has no settings and no hotkey.

## Delve grid

The Delve grid draws a grid of 11 columns and 9 rows in the top center of the screen, sized for the Delve chart of
Path of Exile 1. Its size follows the height of the game window.

The grid has no hotkey by default. Set one at `Grid for Delve Chart` in Settings, `Hotkeys`, and click `Save`. The
hotkey shows or hides the grid over the game. The grid hides when you open the overlay, and it has no button in the
main button bar.
