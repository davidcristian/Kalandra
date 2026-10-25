import pytest

from constants.client_string_data import CLIENT_STRING_KEY_VALUES, CLIENT_STRING_REGEX
from constants.lang import ENGLISH, FRENCH, KOREAN, LANG, SPANISH

ENGLISH_WAYSTONE_CLIENT_STRINGS = {
    "ItemDisplayMapTier": "Waystone Tier",
    "NumberOfPortalsPerWaystone": "[LimitedRespawn|Revives Available]",
    "ItemDisplayMapPack": "[Pack|Pack Size]",
    "ItemDisplayMapMagicMonsterQuantityBonus": "Magic Monsters",
    "ItemDisplayMapRareMonsterQuantityBonus": "Rare Monsters",
    "ItemDisplayMapWaystoneDropChance": "Waystone Drop Chance",
    "ItemDisplayMapItemRarity": "[ItemRarity|Item Rarity]",
}


def test_waystone_client_strings_read_the_ids_of_the_current_game():
    waystone = [s for s in CLIENT_STRING_KEY_VALUES if s.my_key.startswith("WAYSTONE_")]

    values = {
        s.my_key: s.value(ENGLISH_WAYSTONE_CLIENT_STRINGS.__getitem__, ENGLISH)
        for s in waystone
    }

    assert values == {
        "WAYSTONE_TIER": "Waystone Tier: ",
        "WAYSTONE_REVIVES": "Revives Available: ",
        "WAYSTONE_PACK_SIZE": "Pack Size: ",
        "WAYSTONE_MAGIC_MONSTERS": "Magic Monsters: ",
        "WAYSTONE_RARE_MONSTERS": "Rare Monsters: ",
        "WAYSTONE_DROP_CHANCE": "Waystone Drop Chance: ",
        "WAYSTONE_RARITY": "Item Rarity: ",
    }


@pytest.mark.parametrize(
    ("key", "lang", "game_text", "expected"),
    [
        (
            "LOG_LEVEL_UP",
            KOREAN,
            {"HUDContactCharacterLevelChanged": "{0}의 레벨이 {1}이(가) 되었습니다"},
            r"(?<char_name>.*) \((?<char_class>.*)\)의 레벨이 (?<level>\d+)이\(가\) 되었습니다",
        ),
        (
            "LOG_LEVEL_UP",
            FRENCH,
            {"HUDContactCharacterLevelChanged": "{0} vient de passer au niveau {1}."},
            r"(?<char_name>.*) \((?<char_class>.*)\) vient de passer au niveau (?<level>\d+)\.",
        ),
        (
            "EATER_IMPLICIT",
            SPANISH,
            {
                "ModDescriptionLineGreatTangleImplicit": "Mod. implícito del Devorador de mundos ({0})"
            },
            r"Mod\. implícito del Devorador de mundos \((?<rank>.+)\)",
        ),
        (
            "FLASK_CHARGES",
            ENGLISH,
            {"ItemDisplayChargesNCharges": "Currently has {0} Charges"},
            r"Currently has \d+ Charges",
        ),
        (
            "MODIFIER_LINE",
            ENGLISH,
            {
                "ModDescriptionLineTier": " (Tier: {0})",
                "ModDescriptionLineRank": " (Rank: {0})",
            },
            r'(?<type>[^"]+)(?:\s+"(?<name>[^"]*)")?(?:\s*\(Tier: (?<tier>\d+)\))?(?:\s*\(Rank: (?<rank>\d+)\))?',
        ),
    ],
)
def test_regex_client_strings_match_the_game_text_literally(
    key: str, lang: LANG, game_text: dict[str, str], expected: str
):
    (client_string,) = [s for s in CLIENT_STRING_REGEX if s.my_key == key]

    assert client_string.value(game_text.__getitem__, lang) == expected
