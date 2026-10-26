# crowdin.yml maps translations while AGENTS.md says no service is connected

**Status:** done 2026-10-26
**Area:** repo
**Origin:** [AGENTS.md](../../../../AGENTS.md#architecture-rules)
**Verified:** 2026-10-26

`crowdin.yml` at the repo root tells the Crowdin translation service to take
`/renderer/public/data/en/app_i18n.json` as the source and write each translation to
`/renderer/public/data/%two_letters_code%/%original_file_name%`. The file comes from Awakened PoE
Trade, and its last change is from 2023-04-13. Exiled Exchange 2 used a different service: its
history has `Translated using Weblate` commits and a merge of a Weblate branch into its `dev` on
2026-09-05.

[AGENTS.md](../../../../AGENTS.md#architecture-rules) says no translation service is connected to
this project, and that other languages get a string only when someone who speaks them adds it. So
either the file is a leftover or the rule is wrong. `%two_letters_code%` also does not produce the
folder name `cmn-Hant` that the app uses.

Done looks like: a decision for the maintainer. Remove `crowdin.yml`, or connect a service and
change the rule in AGENTS.md, with the folder names that service writes checked against
`renderer/src/assets/make-index-files.mjs`.

## History

- 2026-10-18: Found by a review of the repo against the maintainer's engineering practices, which
  listed it as an open question.
- 2026-10-26: Done. The maintainer chose to remove `crowdin.yml` and its rule in
  `scripts/ci_paths.py`. No translation service is connected, as AGENTS.md says, so nothing read
  the file. The Origin links AGENTS.md, since the file is gone.
