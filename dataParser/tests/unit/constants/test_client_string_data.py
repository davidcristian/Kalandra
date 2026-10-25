from constants.client_string_data import CLIENT_STRING_KEY_VALUES
from constants.lang import ENGLISH

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
