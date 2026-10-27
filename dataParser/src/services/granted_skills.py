"""Builds the stats of the skills that a weapon or shield base grants, such as Parry."""

import re

import pandas as pd

from constants.filenames import BASE_ITEM_TYPES, CLIENT_STRINGS
from stores.game_store import GameStore

# The gems of the skills that a base item grants without a level, which the trade site
# does not list as a stat; the game export has no table that links the bases to them
GRANTED_SKILL_GEMS = (
    "Metadata/Items/Gem/SkillGemParry",
    "Metadata/Items/Gem/SkillGemShieldBlock",
    "Metadata/Items/Gem/SkillGemPlayerDefaultSpearThrow",
)
GRANTED_SKILL_TEXT = "ItemDisplayGrantedSkillNoScaling"
MARKUP = re.compile(r"<[^>]*>|[{}]")


def granted_skill_text(template: str, name: str) -> str:
    """Returns the client string's line for a skill name, without its markup."""
    return MARKUP.sub("", template.replace("{0}", name))


def skill_names(store: GameStore) -> list[str]:
    """Returns the names of the granted skill gems, in GRANTED_SKILL_GEMS order."""
    names = store.get(BASE_ITEM_TYPES).set_index("Id")["Name"]
    return [str(names[gem]) for gem in GRANTED_SKILL_GEMS]


def granted_skill_stats(store: GameStore, ref_store: GameStore) -> pd.DataFrame:
    """Returns one stat per granted skill, with the text of the store's language."""
    template = store.get(CLIENT_STRINGS).set_index("Id")["Text"][GRANTED_SKILL_TEXT]
    ref_template = ref_store.get(CLIENT_STRINGS).set_index("Id")["Text"][
        GRANTED_SKILL_TEXT
    ]
    rows = [
        {
            "ref": granted_skill_text(str(ref_template), ref_name),
            "better": 0,
            "matchers": [{"string": granted_skill_text(str(template), name)}],
            "trade": {"ids": None},
            "id": ref_name.lower().replace(" ", "_"),
        }
        for name, ref_name in zip(skill_names(store), skill_names(ref_store))
    ]
    return pd.DataFrame(rows)
