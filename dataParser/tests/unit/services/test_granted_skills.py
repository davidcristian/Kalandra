import pandas as pd

from constants.filenames import BASE_ITEM_TYPES, CLIENT_STRINGS
from services.granted_skills import granted_skill_stats, granted_skill_text


class FakeGameStore:
    """Returns the base item and client string tables of one language."""

    def __init__(self, names: list[str], template: str) -> None:
        gems = [
            "Metadata/Items/Gem/SkillGemPlayerDefaultSpearThrow",
            "Metadata/Items/Gem/SkillGemParry",
            "Metadata/Items/Gem/SkillGemShieldBlock",
        ]
        self.tables = {
            BASE_ITEM_TYPES: pd.DataFrame(
                [{"Id": "Metadata/Items/Rings/Ring1", "Name": "Iron Ring"}]
                + [{"Id": gem, "Name": name} for gem, name in zip(gems, names)]
            ),
            CLIENT_STRINGS: pd.DataFrame(
                [
                    {"Id": "ItemDisplayGrantsSkill", "Text": "Grants Skill"},
                    {"Id": "ItemDisplayGrantedSkillNoScaling", "Text": template},
                ]
            ),
        }

    def get(self, name: str) -> pd.DataFrame:
        return self.tables[name].copy()


ENGLISH = FakeGameStore(
    ["Spear Throw", "Parry", "Raise Shield"], "Grants Skill: <underline>{{{0}}}"
)
GERMAN = FakeGameStore(
    ["Speerwurf", "Parieren", "Schild heben"],
    "Gewährt Fertigkeit: <underline>{{{0}}}",
)


def test_granted_skill_text_puts_the_name_in_the_line_without_markup():
    assert (
        granted_skill_text("Octroie l'Aptitude: <underline>{{{0}}}", "Parade")
        == "Octroie l'Aptitude: Parade"
    )


def test_granted_skill_stats_give_each_skill_its_english_ref_and_language_text():
    stats = granted_skill_stats(GERMAN, ENGLISH)

    assert stats.to_dict(orient="records") == [
        {
            "ref": "Grants Skill: Parry",
            "better": 0,
            "matchers": [{"string": "Gewährt Fertigkeit: Parieren"}],
            "trade": {"ids": None},
            "id": "parry",
        },
        {
            "ref": "Grants Skill: Raise Shield",
            "better": 0,
            "matchers": [{"string": "Gewährt Fertigkeit: Schild heben"}],
            "trade": {"ids": None},
            "id": "raise_shield",
        },
        {
            "ref": "Grants Skill: Spear Throw",
            "better": 0,
            "matchers": [{"string": "Gewährt Fertigkeit: Speerwurf"}],
            "trade": {"ids": None},
            "id": "spear_throw",
        },
    ]
