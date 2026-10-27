from typing import Any

import pandas as pd

from services.nd_builder_service import NdBuilderService
from tests.inputs import needs_game_export


pytestmark = needs_game_export


class FakeTradeStore:
    """Returns the given rows as the trade site's stats."""

    def __init__(self, rows: list[dict[str, Any]]):
        self.rows = rows

    def stats(self) -> pd.DataFrame:
        return pd.DataFrame(self.rows)


class FakeGameStore:
    """Returns the given rows as the descriptions of every stat description file."""

    def __init__(self, rows: list[dict[str, Any]]):
        self.rows = rows

    def get_all_descriptions(self) -> pd.DataFrame:
        return pd.DataFrame(self.rows)

    def get_description(self, _name: str) -> pd.DataFrame:
        return pd.DataFrame(self.rows).iloc[0:0]


def service_with_trade_stats(
    english: list[dict[str, Any]], lang: list[dict[str, Any]]
) -> NdBuilderService:
    service = NdBuilderService("cmn-Hant", "noLookup")
    service.ref_trade_store = FakeTradeStore(english)
    service.trade_store = FakeTradeStore(lang)
    return service


def stat_row(ref: str, game_id: str, text: str, trade_id: str) -> dict[str, Any]:
    mod_type = trade_id.split(".")[0]
    return {
        "ref": ref,
        "id": game_id,
        "hash": [int(trade_id.split("_")[-1])],
        "matchers": [{"string": text}],
        "trade": {"ids": {mod_type: [trade_id]}},
        "dp": None,
    }


def test_dedupe_matchers_merges_only_the_given_refs():
    service = NdBuilderService("de", "noLookup")
    stats = pd.DataFrame(
        [
            stat_row(
                "#% increased Experience gain",
                "experience_gain_+%",
                "#% erhöhter Erfahrungsgewinn",
                "explicit.stat_3666934677",
            ),
            stat_row(
                "#% increased Experience gain in Map",
                "map_experience_gain_+%",
                "#% erhöhter Erfahrungsgewinn auf der Karte",
                "explicit.stat_57434274",
            ),
            stat_row(
                "Gain # Rage on Hit",
                "base_gain_x_rage_on_hit",
                "Erhaltet # Rausch bei Treffer",
                "explicit.stat_2258007247",
            ),
            stat_row(
                "Grants # Rage on Hit",
                "local_gain_X_rage_on_hit",
                "Erhaltet # Rausch bei Treffer",
                "implicit.stat_1725749947",
            ),
        ]
    )
    english_groups = pd.Series(
        [{"#% increased Experience gain", "#% increased Experience gain in Map"}]
    )

    result = service.dedupe_matchers(stats, english_groups).set_index("ref")

    assert sorted(result.index) == [
        "#% increased Experience gain",
        "Gain # Rage on Hit",
        "Grants # Rage on Hit",
    ]
    experience = result.loc["#% increased Experience gain"]
    assert sorted(experience["trade"]["ids"]["explicit"]) == [
        "explicit.stat_3666934677",
        "explicit.stat_57434274",
    ]
    assert len(experience["matchers"]) == 2


def test_descriptions_hashed_reads_the_descriptions_of_the_given_store():
    service = NdBuilderService("de", "noLookup")
    rows = [{"id": "base_maximum_life", "hash": 3299347043, "matchers": []}]

    result = service.descriptions_hashed(FakeGameStore(rows))

    assert result.to_dict("records") == rows


def test_fill_in_missing_matchers_gives_no_matcher_to_a_stat_without_language_text():
    service = service_with_trade_stats(
        [
            {"id": "rune.stat_1", "text": "Bonded: # to Dexterity", "type": "rune"},
            {"id": "explicit.stat_2", "text": "# to maximum Life", "type": "explicit"},
        ],
        [{"id": "explicit.stat_2", "text": "#最大生命"}],
    )
    stats = pd.DataFrame(
        [
            {"ref": "Bonded: # to Dexterity", "matchers": []},
            {"ref": "# to maximum Life", "matchers": []},
        ]
    )

    result = service.fill_in_missing_matchers(stats)

    assert result["matchers"].tolist() == [[], [{"string": "#最大生命"}]]


def test_set_timeless_matchers_keeps_the_matchers_of_a_stat_without_language_text():
    service = service_with_trade_stats(
        [
            {
                "id": "explicit.stat_1",
                "text": "Notable Passive Skills in Radius also grant #% to Cold Resistance",
                "type": "explicit",
            }
        ],
        [{"id": "explicit.stat_2", "text": "#最大生命"}],
    )
    _ = service.stats_combined_df()
    stats = pd.DataFrame(
        [
            {
                "ref": "Notable Passive Skills in Radius also grant #% to Cold Resistance",
                "matchers": [{"string": "範圍內的天賦技能也給予#%冰冷抗性"}],
            }
        ]
    )

    result = service.set_timeless_matchers(stats)

    assert result["matchers"].tolist() == [
        [{"string": "範圍內的天賦技能也給予#%冰冷抗性"}]
    ]


def test_value_trade_stats_df_leaves_out_the_values_without_language_text():
    service = service_with_trade_stats(
        [
            {"id": "explicit.stat_1|1", "text": "Allocates A", "type": "explicit"},
            {"id": "explicit.stat_1|2", "text": "Allocates B", "type": "explicit"},
        ],
        [{"id": "explicit.stat_1|2", "text": "配置 B"}],
    )

    result = service.value_trade_stats_df()

    assert result["text"].tolist() == ["配置 B"]
    assert result["value"].tolist() == ["2"]
