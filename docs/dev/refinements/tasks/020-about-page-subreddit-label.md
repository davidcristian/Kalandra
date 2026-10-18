# The About page subreddit label does not match its link

**Status:** open
**Area:** renderer
**Origin:** [renderer/src/web/settings/about.vue](../../../../renderer/src/web/settings/about.vue)
**Verified:** 2026-10-18

Settings, About has a link with the text `r/pathofexile` whose `href` is
`https://old.reddit.com/r/pathofexile2`. The text names the Path of Exile 1 subreddit and the link
opens the Path of Exile 2 one.

Done looks like: the text reads `r/pathofexile2`. [docs/settings.md](../../../settings.md)
already says the link opens the Path of Exile 2 subreddit and does not quote the text, so it needs
no change.

## History

- 2026-10-18: Found while docs/settings.md was written, by reading `about.vue`.
