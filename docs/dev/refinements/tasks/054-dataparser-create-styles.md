# create-styles.py copies to a folder the repo does not have

**Status:** done 2026-10-27
**Area:** dataparser
**Origin:** [modules/dataparser.md](../../modules/dataparser.md)
**Verified:** 2026-10-27

`create-styles.py` builds three CSS user styles for the trade site: `tagOnly`, `tagOnlyCompact`
and `kvanRules`. In one loop it writes each style to `output/css/<name>.user.css`, then calls
`shutil.copy` to `../gist-trade-highlight/<name>.user.css`. The script must run from `dataParser/`,
because `output/css/` is relative to the working directory. From there, the target is a
`gist-trade-highlight/` folder at the repo root, which does not exist. So the first copy raises
`FileNotFoundError` after the first style is written, and the other two are not built.

The folder has the name of the repo that each style's header points at: `USER_STYLE_PREFIX` in
`src/constants/css.py` sets `@author Kvan7` and an `@updateURL` in `Kvan7/gist-trade-highlight` on
GitHub. So a style built here names Exiled Exchange 2's author and that author's repo as its
update source. The app does not read these styles.

Done looks like: a decision for the maintainer. Remove the styles and their constants, or keep them
with a target folder that is a setting and an `@updateURL` that Kalandra controls.
[modules/dataparser.md](../../modules/dataparser.md) says what the styles are for, or no longer
lists the script.

## History

- 2026-10-18: Found while the dataParser module doc was written.
- 2026-10-27: The maintainer chose to remove the script, its constants in `src/constants/css.py` and
  its mention in modules/dataparser.md.
- 2026-10-27: refactor(dataparser): remove the trade site user styles. It also removes the
  modules only the script read (the CSS rules, the style builder and `TaggedStats`), their
  tests, the tag constants in `src/constants/other.py` and the built styles in `output/css/`.
