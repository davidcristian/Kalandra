---
title: Invalid JSON
---

A price check can fail with an error whose message starts with `Unexpected token` and ends with
`is not valid JSON`:

![The Trade site request failed error box with an Unexpected token message that ends in is not valid JSON, and the buttons Retry and Browser](/reference-images/jsonError.png)

The error box is titled **Trade site request failed** and shows the line
`Error: Unexpected token '<', "<!DOCTYPE "... is not valid JSON`. It can appear on an item search and on a bulk
search, such as a currency price check.

JSON is the data format of the trade site's responses. The error means that the trade site sent a web page where
Kalandra expected JSON: a web page starts with `<!DOCTYPE`, and its first character `<` is the unexpected token. The
trade site sends a web page when it is down or under maintenance, or when it shows a bot check: a page that tells
people from automated programs.

## Fix it

1. Open the trade site in your normal browser. If it does not load, wait until it is back, then click **Retry**.
2. If the trade site works, click **Browser** in the error box. It opens the same search on the trade site in the
   [built-in browser](/price-check#built-in-browser). Complete any check the page shows.
3. Click **Retry**. A check passed in the built-in browser also applies to Kalandra's own trade requests.

On a bulk search, **Browser** opens the built-in browser only with **Enable builtin browser** on (Settings,
**Price check** page). Otherwise it opens your default browser, and a check passed there does not apply to
Kalandra. Turn on **Enable builtin browser** and click **Save**, then price check the item again and click
**Browser**.

[Failed to load leagues](/failed-load-leagues) describes the same bot check when it blocks the list of leagues.

If the error stays while the trade site works in your browser, [open an issue](https://github.com/davidcristian/Kalandra/issues)
with the full error text and the lines from the **Debug** settings page
([Where can I find the logs?](/faq#where-can-i-find-the-logs)).
