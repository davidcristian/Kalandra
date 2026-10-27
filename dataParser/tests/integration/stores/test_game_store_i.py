import re

import pytest

from constants.filenames import GAME_API_TABLES, STAT_DESCRIPTION_FILES
from constants.lang import LANG, LANGUAGES
from stores.game_store import GameStore
from tests.inputs import needs_game_export


pytestmark = needs_game_export

MARKUP = re.compile(r"[\[\]\|\{\}]")

# Ids whose game text in that language has markup the parser cannot read, such as
# "[Rarity||raros]", "[Split|Divisent|" or "{0]%". A game patch can fix or break more.
BROKEN_GAME_TEXT: dict[LANG, set[str]] = {
    "cmn-Hant": {
        "empower_barrage_damage_-%_final_with_repeated_projectiles",
        "map_expedition_monster_spawn_additional_missing_life_%",
    },
    "de": {"temporal_chains_gem_level_+"},
    "fr": {
        "allies_in_font_of_blood_radius_leech_%_of_my_physical_damage_as_life",
        "allies_in_font_of_mana_radius_leech_%_of_my_physical_damage_as_mana",
        "base_cannot_be_ignited",
        "cannot_be_poisoned",
        "expedition_elite_%_to_drop_rare_jewellery",
        "instilling_all_damage_%_to_gain_as_instilling_type",
        "modifiers_to_number_of_projectiles_instead_apply_to_splitting",
        "projectile_number_to_split",
    },
    "ja": {
        "map_ritual_contains_defiance_of_destiny",
        "remove_all_damaging_ailments_on_warcry",
        "skill_empowers_next_x_melee_attacks",
    },
    "ko": {"from_league_item_quantity_+%_permyriad"},
    "pt": {
        "map_dropped_waystones_are_rare_and_corrupted_chance_%",
        "map_expedition_rare_monsters_+%",
        "map_strongboxes_have_%_chance_to_be_rare_corrupted_max_mods",
    },
    "ru": {
        "base_skill_seal_gain_interval_ms",
        "brequel_reward_anaemia_crafted_modifier_chance_%",
        "buff_effect_on_self_+%",
        "cast_when_stunned_gain_X_centienergy_when_stunned",
        "expedition_elite_%_to_drop_rare_jewellery",
        "local_display_supported_by_level_x_awakened_weapon_elemental_damage",
        "stun_threshold_+_per_10_maximum_ward",
    },
}


def keeps_markup(text: str) -> bool:
    if "<nemesismod>" in text or "<enchanted>" in text or "<附魔>" in text:
        text = re.sub(r"\{\{.*?\}\}", "", text)
    return bool(MARKUP.search(text)) and "{0%}" not in text


@pytest.mark.parametrize("lang", sorted(LANGUAGES))
def test_get_description_keeps_markup_only_in_the_known_broken_game_text(lang: LANG):
    store = GameStore(lang)
    broken: set[str] = set()

    for filename in STAT_DESCRIPTION_FILES:
        df = store.get_description(filename)

        for _, row in df.iterrows():
            if any(keeps_markup(matcher["string"]) for matcher in row["matchers"]):
                broken.add(row["id"])

        for val in df["matchers"]:
            for matcher in val:
                if "value" in matcher:
                    assert isinstance(matcher["value"], int), (
                        f"{filename} - values: invalid content found: {val}"
                    )

    known = BROKEN_GAME_TEXT.get(lang, set())
    assert broken == known, (
        f"markup left in: {sorted(broken - known)}, fixed: {sorted(known - broken)}"
    )


@pytest.mark.parametrize("lang", LANGUAGES)
@pytest.mark.parametrize("table", GAME_API_TABLES)
def test_game_store_get_table_loads_without_error(lang, table):
    store = GameStore(lang)
    df = store.get(table)
    assert df is not None
