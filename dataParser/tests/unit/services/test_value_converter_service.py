from unittest.mock import MagicMock, patch

import pandas as pd
import pytest

from constants.filenames import (
    BASE_ITEM_TYPES,
    BLIGHT_CRAFTING_ITEMS,
    BLIGHT_CRAFTING_RECIPES,
    BLIGHT_CRAFTING_RESULTS,
    PASSIVE_SKILLS,
)
from constants.known_stats import (
    ALLOCATES_NOTABLE,
    BETTER_LOOKUP,
    DISCONNECTED_PASSIVES_AROUND_KEYSTONE,
    JEWEL_RADIUS_CHANGE,
    JEWEL_RING_RADIUS,
    SUPPORTED_VALUES,
    TIME_LOST_HISTORIC_JEWEL,
    UNIQUE_JEWEL_PLUS_LEVEL,
    VALUE_TO_DESCRIPTION_ID,
    VALUE_TO_REF,
)
from constants.lang import ENGLISH, GERMAN
from services.value_converter_service import ValueConverterService
from tests.inputs import needs_game_export


def make_service() -> ValueConverterService:
    """Returns an English service with no blight oils, without reading the blight tables."""
    with patch.object(ValueConverterService, "get_blight", return_value={}):
        return ValueConverterService(lang=ENGLISH)


@pytest.mark.parametrize(
    "hash_val",
    [
        JEWEL_RADIUS_CHANGE,
        JEWEL_RING_RADIUS,
        ALLOCATES_NOTABLE,
        DISCONNECTED_PASSIVES_AROUND_KEYSTONE,
        UNIQUE_JEWEL_PLUS_LEVEL,
    ],
)
def test_agg_by_hash_builds_one_option_stat_from_the_rows_of_a_value_stat(hash_val):
    rows = pd.DataFrame(
        [
            {"text": "Second", "value": 2, "type": "explicit", "id": "explicit.stat_1"},
            {"text": "First", "value": 1, "type": "explicit", "id": "explicit.stat_1"},
        ],
        index=[hash_val, hash_val],
    )

    out = make_service().agg_by_hash(rows)

    assert out.to_dict("records") == [
        {
            "ref": VALUE_TO_REF[hash_val],
            "id": VALUE_TO_DESCRIPTION_ID[hash_val],
            "hash": hash_val,
            "better": BETTER_LOOKUP.get(hash_val, 1),
            "trade": {"ids": {"explicit": ["explicit.stat_1"]}, "option": True},
            "matchers": [
                {"string": "First", "value": 1},
                {"string": "Second", "value": 2},
            ],
        }
    ]


@needs_game_export
def test_agg_by_hash_builds_one_stat_per_row_of_a_historic_jewel():
    rows = pd.DataFrame(
        [
            {
                "ref": "Glorifying the defilement of # souls in tribute to Ulaman\nmore",
                "text": "Glorifying the defilement of # souls in tribute to Ulaman",
                "value": 28,
                "type": "explicit",
                "id": "explicit.stat_3418580811",
            }
        ],
        index=[TIME_LOST_HISTORIC_JEWEL],
    )

    out = make_service().agg_by_hash(rows)

    assert out["ref"].tolist() == [
        "Glorifying the defilement of # souls in tribute to Ulaman"
    ]
    assert out["trade"].tolist() == [
        {"ids": {"explicit": ["explicit.stat_3418580811|28"]}}
    ]
    assert "advanced" in out["matchers"].tolist()[0][0]


def test_agg_by_hash_returns_the_rows_of_another_stat_unchanged():
    rows = pd.DataFrame(
        [{"text": "dummy", "value": 1, "type": "explicit", "id": 123}], index=[999999]
    )

    pd.testing.assert_frame_equal(make_service().agg_by_hash(rows), rows)


def test_simple_agg_notable_blight_lookup():
    mock_blight = {123: ["oil1", "oil2"]}
    with patch.object(ValueConverterService, "get_blight", return_value=mock_blight):
        svc = ValueConverterService(lang=MagicMock())
        df = pd.DataFrame(
            [{"text": "some text", "value": 123, "type": "mod", "id": 42}]
        )
        df.index = [ALLOCATES_NOTABLE]
        out = svc.simple_agg(df)

        expected = pd.DataFrame(
            [
                {
                    "ref": VALUE_TO_REF[ALLOCATES_NOTABLE],
                    "id": VALUE_TO_DESCRIPTION_ID[ALLOCATES_NOTABLE],
                    "hash": ALLOCATES_NOTABLE,
                    "better": 0,
                    "trade": {"ids": {"mod": [42]}, "option": True},
                    "matchers": [
                        {"string": "some text", "value": 123, "oils": ["oil1", "oil2"]}
                    ],
                }
            ]
        )

        pd.testing.assert_frame_equal(out, expected)


def test_convert_value_stats_to_trade_filters_and_transforms():
    supported_hash = list(SUPPORTED_VALUES)[0]
    df = pd.DataFrame(
        [
            {
                "hash": supported_hash,
                "text": "example",
                "value": 100,
                "type": "mod",
                "id": 1,
            }
        ]
    )

    mock_output = pd.DataFrame(
        [
            {
                "ref": "ref1",
                "id": "desc1",
                "hash": supported_hash,
                "better": 1,
                "matchers": [{"string": "example", "value": 100}],
                "trade": {"ids": {"mod": [1]}},
            }
        ]
    )

    with (
        patch.object(ValueConverterService, "get_blight", return_value={}),
        patch.object(ValueConverterService, "agg_by_hash", return_value=mock_output),
    ):
        svc = ValueConverterService(lang=MagicMock())
        out = svc.convert_value_stats_to_trade(df)

        expected = mock_output.copy()
        expected["dp"] = None
        expected["hash"] = expected["hash"].apply(lambda x: [int(x)])
        expected = expected[["ref", "dp", "better", "matchers", "trade", "id", "hash"]]

        pd.testing.assert_frame_equal(
            out.reset_index(drop=True), expected.reset_index(drop=True)
        )


class FakeGameStore:
    """Returns the tables of a small game export per language, as GameStore reads them."""

    exports: dict[str, dict[str, pd.DataFrame]] = {}

    def __init__(self, lang: str) -> None:
        self.tables = self.exports[lang]

    def get(self, name: str) -> pd.DataFrame:
        return self.tables[name].copy()


def blight_export(oil_names: dict[int, str]) -> dict[str, pd.DataFrame]:
    """Returns two anointable passives, 101 and 102, and the oils of the game's first rows."""
    return {
        PASSIVE_SKILLS: pd.DataFrame(
            {"_index": [1, 2, 3], "PassiveSkillGraphId": [101, 102, 103]}
        ),
        BLIGHT_CRAFTING_RESULTS: pd.DataFrame(
            {"_index": [10, 20, 30], "PassiveSkill": [1, 2, 999]}
        ),
        BLIGHT_CRAFTING_RECIPES: pd.DataFrame(
            {
                "BlightCraftingResult": [10, 20, 999],
                "BlightCraftingItems": [[9, 0, 4], [10, 10, 0], [0, 0, 0]],
            }
        ),
        # The row order and base items of BlightCraftingItems in the game export
        BLIGHT_CRAFTING_ITEMS: pd.DataFrame(
            {
                "_index": [0, 4, 9, 10],
                "BaseItemType": [1111, 1115, 1120, 1131],
            }
        ),
        BASE_ITEM_TYPES: pd.DataFrame(
            {"_index": list(oil_names), "Name": list(oil_names.values())}
        ),
    }


def test_get_blight_names_each_oil_by_its_english_base_item(
    monkeypatch: pytest.MonkeyPatch,
):
    english = {
        1131: "Potent Liquid Melancholy",
        1111: "Diluted Liquid Ire",
        1120: "Concentrated Liquid Isolation",
        1115: "Liquid Envy",
    }
    german = {
        1131: "Wirkungsvolle Flüssige Melancholie",
        1111: "Verdünnter Flüssiger Zorn",
        1120: "Konzentrierte Flüssige Isolation",
        1115: "Flüssiger Neid",
    }
    FakeGameStore.exports = {
        ENGLISH: blight_export(english),
        GERMAN: blight_export(german),
    }
    monkeypatch.setattr("services.value_converter_service.GameStore", FakeGameStore)

    expected = {
        101: ["Concentrated Liquid Isolation", "Diluted Liquid Ire", "Liquid Envy"],
        102: [
            "Potent Liquid Melancholy",
            "Potent Liquid Melancholy",
            "Diluted Liquid Ire",
        ],
    }
    assert ValueConverterService(ENGLISH).blight == expected
    assert ValueConverterService(GERMAN).blight == expected


def test_convert_value_stats_to_trade_builds_one_stat_per_supported_hash():
    ring_id = f"explicit.stat_{JEWEL_RING_RADIUS}"
    notable_id = f"enchant.stat_{ALLOCATES_NOTABLE}"
    stats = pd.DataFrame(
        [
            {
                "hash": JEWEL_RING_RADIUS,
                "text": "Small Ring",
                "value": 2,
                "type": "explicit",
                "id": ring_id,
            },
            {
                "hash": JEWEL_RING_RADIUS,
                "text": "Tiny Ring",
                "value": 1,
                "type": "explicit",
                "id": ring_id,
            },
            {
                "hash": ALLOCATES_NOTABLE,
                "text": "Allocates #",
                "value": 200,
                "type": "enchant",
                "id": notable_id,
            },
            {
                "hash": 999999,
                "text": "Unsupported",
                "value": 1,
                "type": "explicit",
                "id": "explicit.stat_999999",
            },
        ]
    )

    out = make_service().convert_value_stats_to_trade(stats)

    assert out.to_dict("records") == [
        {
            "ref": VALUE_TO_REF[ALLOCATES_NOTABLE],
            "dp": None,
            "better": 0,
            "matchers": [{"string": "Allocates #", "value": 200}],
            "trade": {"ids": {"enchant": [notable_id]}, "option": True},
            "id": VALUE_TO_DESCRIPTION_ID[ALLOCATES_NOTABLE],
            "hash": [ALLOCATES_NOTABLE],
        },
        {
            "ref": VALUE_TO_REF[JEWEL_RING_RADIUS],
            "dp": None,
            "better": 0,
            "matchers": [
                {"string": "Tiny Ring", "value": 1},
                {"string": "Small Ring", "value": 2},
            ],
            "trade": {"ids": {"explicit": [ring_id]}, "option": True},
            "id": VALUE_TO_DESCRIPTION_ID[JEWEL_RING_RADIUS],
            "hash": [JEWEL_RING_RADIUS],
        },
    ]


@needs_game_export
def test_historic_agg_integration():
    df = pd.DataFrame(
        [
            {
                "hash": TIME_LOST_HISTORIC_JEWEL,
                "ref": "Remembrancing # songworthy deeds by the line of Vorana\nPassives in radius are Conquered by the Kalguur",
                "text": "Remembrancing # songworthy deeds by the line of Vorana\nPassives in radius are Conquered by the Kalguur",
                "value": 21,
                "type": "mod",
                "id": "explicit.stat_3418580811",
            },
            {
                "hash": TIME_LOST_HISTORIC_JEWEL,
                "ref": "Remembrancing # songworthy deeds by the line of Medved\nPassives in radius are Conquered by the Kalguur",
                "text": "Remembrancing # songworthy deeds by the line of Medved\nPassives in radius are Conquered by the Kalguur",
                "value": 22,
                "type": "mod",
                "id": "explicit.stat_3418580811",
            },
            {
                "hash": TIME_LOST_HISTORIC_JEWEL,
                "ref": "Remembrancing # songworthy deeds by the line of Olroth\nPassives in radius are Conquered by the Kalguur",
                "text": "Remembrancing # songworthy deeds by the line of Olroth\nPassives in radius are Conquered by the Kalguur",
                "value": 23,
                "type": "mod",
                "id": "explicit.stat_3418580811",
            },
            {
                "hash": TIME_LOST_HISTORIC_JEWEL,
                "ref": "Glorifying the defilement of # souls in tribute to Amanamu\nPassives in radius are Conquered by the Abyssals\nDesecration makes this item unstable",
                "text": "Glorifying the defilement of # souls in tribute to Amanamu\nPassives in radius are Conquered by the Abyssals\nDesecration makes this item unstable",
                "value": 24,
                "type": "mod",
                "id": "explicit.stat_3418580811",
            },
            {
                "hash": TIME_LOST_HISTORIC_JEWEL,
                "ref": "Glorifying the defilement of # souls in tribute to Kulemak\nPassives in radius are Conquered by the Abyssals\nDesecration makes this item unstable",
                "text": "Glorifying the defilement of # souls in tribute to Kulemak\nPassives in radius are Conquered by the Abyssals\nDesecration makes this item unstable",
                "value": 25,
                "type": "mod",
                "id": "explicit.stat_3418580811",
            },
            {
                "hash": TIME_LOST_HISTORIC_JEWEL,
                "ref": "Glorifying the defilement of # souls in tribute to Kurgal\nPassives in radius are Conquered by the Abyssals\nDesecration makes this item unstable",
                "text": "Glorifying the defilement of # souls in tribute to Kurgal\nPassives in radius are Conquered by the Abyssals\nDesecration makes this item unstable",
                "value": 26,
                "type": "mod",
                "id": "explicit.stat_3418580811",
            },
            {
                "hash": TIME_LOST_HISTORIC_JEWEL,
                "ref": "Glorifying the defilement of # souls in tribute to Tecrod\nPassives in radius are Conquered by the Abyssals\nDesecration makes this item unstable",
                "text": "Glorifying the defilement of # souls in tribute to Tecrod\nPassives in radius are Conquered by the Abyssals\nDesecration makes this item unstable",
                "value": 27,
                "type": "mod",
                "id": "explicit.stat_3418580811",
            },
            {
                "hash": TIME_LOST_HISTORIC_JEWEL,
                "ref": "Glorifying the defilement of # souls in tribute to Ulaman\nPassives in radius are Conquered by the Abyssals\nDesecration makes this item unstable",
                "text": "Glorifying the defilement of # souls in tribute to Ulaman\nPassives in radius are Conquered by the Abyssals\nDesecration makes this item unstable",
                "value": 28,
                "type": "mod",
                "id": "explicit.stat_3418580811",
            },
        ]
    )

    expected_df = pd.DataFrame(
        [
            {
                "ref": "Remembrancing # songworthy deeds by the line of Vorana",
                "id": "local_unique_jewel_alternate_tree_seed",
                "hash": TIME_LOST_HISTORIC_JEWEL,
                "better": 0,
                "matchers": [
                    {
                        "string": "Remembrancing # songworthy deeds by the line of Vorana\nPassives in radius are Conquered by the Kalguur",
                        "advanced": "Remembrancing # songworthy deeds by the line of Vorana(Vorana-Olroth)\nPassives in radius are Conquered by the Kalguur",
                    }
                ],
                "trade": {"ids": {"explicit": ["explicit.stat_3418580811|21"]}},
            },
            {
                "ref": "Remembrancing # songworthy deeds by the line of Medved",
                "id": "local_unique_jewel_alternate_tree_seed",
                "hash": TIME_LOST_HISTORIC_JEWEL,
                "better": 0,
                "matchers": [
                    {
                        "string": "Remembrancing # songworthy deeds by the line of Medved\nPassives in radius are Conquered by the Kalguur",
                        "advanced": "Remembrancing # songworthy deeds by the line of Medved(Vorana-Olroth)\nPassives in radius are Conquered by the Kalguur",
                    }
                ],
                "trade": {"ids": {"explicit": ["explicit.stat_3418580811|22"]}},
            },
            {
                "ref": "Remembrancing # songworthy deeds by the line of Olroth",
                "id": "local_unique_jewel_alternate_tree_seed",
                "hash": TIME_LOST_HISTORIC_JEWEL,
                "better": 0,
                "matchers": [
                    {
                        "string": "Remembrancing # songworthy deeds by the line of Olroth\nPassives in radius are Conquered by the Kalguur",
                        "advanced": "Remembrancing # songworthy deeds by the line of Olroth(Vorana-Olroth)\nPassives in radius are Conquered by the Kalguur",
                    }
                ],
                "trade": {"ids": {"explicit": ["explicit.stat_3418580811|23"]}},
            },
            {
                "ref": "Glorifying the defilement of # souls in tribute to Amanamu",
                "id": "local_unique_jewel_alternate_tree_seed",
                "hash": TIME_LOST_HISTORIC_JEWEL,
                "better": 0,
                "matchers": [
                    {
                        "string": "Glorifying the defilement of # souls in tribute to Amanamu\nPassives in radius are Conquered by the Abyssals\nDesecration makes this item unstable",
                        "advanced": "Glorifying the defilement of # souls in tribute to Amanamu(Amanamu-Ulaman)\nPassives in radius are Conquered by the Abyssals\nDesecration makes this item unstable",
                    }
                ],
                "trade": {"ids": {"explicit": ["explicit.stat_3418580811|24"]}},
            },
            {
                "ref": "Glorifying the defilement of # souls in tribute to Kulemak",
                "id": "local_unique_jewel_alternate_tree_seed",
                "hash": TIME_LOST_HISTORIC_JEWEL,
                "better": 0,
                "matchers": [
                    {
                        "string": "Glorifying the defilement of # souls in tribute to Kulemak\nPassives in radius are Conquered by the Abyssals\nDesecration makes this item unstable",
                        "advanced": "Glorifying the defilement of # souls in tribute to Kulemak(Amanamu-Ulaman)\nPassives in radius are Conquered by the Abyssals\nDesecration makes this item unstable",
                    }
                ],
                "trade": {"ids": {"explicit": ["explicit.stat_3418580811|25"]}},
            },
            {
                "ref": "Glorifying the defilement of # souls in tribute to Kurgal",
                "id": "local_unique_jewel_alternate_tree_seed",
                "hash": TIME_LOST_HISTORIC_JEWEL,
                "better": 0,
                "matchers": [
                    {
                        "string": "Glorifying the defilement of # souls in tribute to Kurgal\nPassives in radius are Conquered by the Abyssals\nDesecration makes this item unstable",
                        "advanced": "Glorifying the defilement of # souls in tribute to Kurgal(Amanamu-Ulaman)\nPassives in radius are Conquered by the Abyssals\nDesecration makes this item unstable",
                    }
                ],
                "trade": {"ids": {"explicit": ["explicit.stat_3418580811|26"]}},
            },
            {
                "ref": "Glorifying the defilement of # souls in tribute to Tecrod",
                "id": "local_unique_jewel_alternate_tree_seed",
                "hash": TIME_LOST_HISTORIC_JEWEL,
                "better": 0,
                "matchers": [
                    {
                        "string": "Glorifying the defilement of # souls in tribute to Tecrod\nPassives in radius are Conquered by the Abyssals\nDesecration makes this item unstable",
                        "advanced": "Glorifying the defilement of # souls in tribute to Tecrod(Amanamu-Ulaman)\nPassives in radius are Conquered by the Abyssals\nDesecration makes this item unstable",
                    }
                ],
                "trade": {"ids": {"explicit": ["explicit.stat_3418580811|27"]}},
            },
            {
                "ref": "Glorifying the defilement of # souls in tribute to Ulaman",
                "id": "local_unique_jewel_alternate_tree_seed",
                "hash": TIME_LOST_HISTORIC_JEWEL,
                "better": 0,
                "matchers": [
                    {
                        "string": "Glorifying the defilement of # souls in tribute to Ulaman\nPassives in radius are Conquered by the Abyssals\nDesecration makes this item unstable",
                        "advanced": "Glorifying the defilement of # souls in tribute to Ulaman(Amanamu-Ulaman)\nPassives in radius are Conquered by the Abyssals\nDesecration makes this item unstable",
                    }
                ],
                "trade": {"ids": {"explicit": ["explicit.stat_3418580811|28"]}},
            },
        ]
    )

    with patch.object(ValueConverterService, "get_blight", return_value={}):
        svc = ValueConverterService(lang="en")
        out = svc.historic_agg(df)

        pd.testing.assert_frame_equal(out, expected_df)


GERMAN_HISTORIC_JEWELS = [
    (
        "Remembrancing # songworthy deeds by the line of Vorana",
        "In Erinnerung an # lobenswerte Taten der Ahnenlinie von Vorana",
    ),
    (
        "Remembrancing # songworthy deeds by the line of Medved",
        "In Erinnerung an # lobenswerte Taten der Ahnenlinie von Medved",
    ),
    (
        "Remembrancing # songworthy deeds by the line of Olroth",
        "In Erinnerung an # lobenswerte Taten der Ahnenlinie von Olroth",
    ),
    (
        "Glorifying the defilement of # souls in tribute to Amanamu",
        "In Verehrung der Schändung von # Seelen als Tribut an Amanamu",
    ),
    (
        "Glorifying the defilement of # souls in tribute to Kulemak",
        "In Verehrung der Schändung von # Seelen als Tribut an Kulemak",
    ),
    (
        "Glorifying the defilement of # souls in tribute to Kurgal",
        "In Verehrung der Schändung von # Seelen als Tribut an Kurgal",
    ),
    (
        "Glorifying the defilement of # souls in tribute to Tecrod",
        "In Verehrung der Schändung von # Seelen als Tribut an Tecrod",
    ),
    (
        "Glorifying the defilement of # souls in tribute to Ulaman",
        "In Verehrung der Schändung von # Seelen als Tribut an Ulaman",
    ),
]


@needs_game_export
def test_historic_agg_writes_the_trade_site_id_beside_the_german_text_of_each_conqueror():
    rows = pd.DataFrame(
        [
            {
                "hash": TIME_LOST_HISTORIC_JEWEL,
                "ref": f"{ref}\nPassives in radius are Conquered",
                "text": f"{text}\nPassive im Radius wurden erobert",
                "value": str(value),
                "type": "explicit",
                "id": "explicit.stat_3418580811",
            }
            for value, (ref, text) in enumerate(GERMAN_HISTORIC_JEWELS, start=21)
        ]
    )

    with patch.object(ValueConverterService, "get_blight", return_value={}):
        out = ValueConverterService(lang=GERMAN).historic_agg(rows)

    assert [
        (
            r["ref"],
            r["trade"]["ids"]["explicit"],
            r["matchers"][0]["advanced"].split("(")[0],
        )
        for r in out.to_dict("records")
    ] == [
        (ref, [f"explicit.stat_3418580811|{value}"], text)
        for value, (ref, text) in enumerate(GERMAN_HISTORIC_JEWELS, start=21)
    ]
