# The README's graph image is on imgur

**Status:** open
**Area:** docs
**Origin:** [README.md](../../../../README.md)
**Verified:** 2026-10-18

The Acknowledgments section of README.md ends with `![graph](https://i.imgur.com/MATqhv7.png)`.
Awakened PoE Trade's author added it to that README in 2022, and Kalandra inherited it. It is the
only fixed image file in the repo's markdown that a third-party host serves. The badges at the top
of README.md come from `img.shields.io`, which draws them on each request, and the user pages keep
their images in `docs/reference-images/`.

Nobody has checked what the image shows, and the alt text `graph` does not say. The Acknowledgments
section credits other projects, so removing the image without looking at it can remove a credit.

Done looks like: the maintainer looks at the image and either removes it or adds it to the repo
with an alt text that says what it shows. Downloading it needs the maintainer's go-ahead.

## History

- 2026-10-18: Found by a search for `imgur` in `docs/` and `README.md` after the user pages moved
  their images into the repo.
- 2026-10-18: Checked against the tree. Replaced "the last image that a third-party host serves",
  because the shields.io badges in README.md are also served by a third party.
