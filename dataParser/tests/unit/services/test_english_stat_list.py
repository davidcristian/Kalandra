import pandas as pd

from services.english_stat_list import (
    TradeIds,
    linked_trade_ids,
    share_trade_ids,
    text_by_ref,
    with_language_text,
)


def test_with_language_text_keeps_each_english_stat_and_only_those():
    english = pd.DataFrame(
        [
            {"id": "explicit.stat_1", "text": "Unblockable", "type": "explicit"},
            {"id": "explicit.stat_2", "text": "Cannot Block", "type": "explicit"},
        ]
    )
    lang = pd.DataFrame(
        [
            {"id": "explicit.stat_2", "text": "막기 불가"},
            {"id": "explicit.stat_3", "text": "only on this trade site"},
        ]
    )

    result = with_language_text(english, lang)

    assert result["id"].tolist() == ["explicit.stat_1", "explicit.stat_2"]
    assert result["ref"].tolist() == ["Unblockable", "Cannot Block"]
    assert pd.isna(result["text"].iloc[0])
    assert result["text"].iloc[1] == "막기 불가"


def test_text_by_ref_leaves_out_the_refs_without_a_language_text():
    stats = pd.DataFrame(
        [
            {"ref": "Unblockable", "text": None},
            {"ref": "Cannot Block", "text": "막기 불가"},
        ]
    )

    assert text_by_ref(stats) == {"Cannot Block": "막기 불가"}


def rage_stats() -> pd.DataFrame:
    return pd.DataFrame(
        [
            {
                "ref": "Gain # Rage on Hit",
                "trade": {"ids": {"explicit": ["explicit.stat_2258007247"]}},
            },
            {
                "ref": "Grants # Rage on Hit",
                "trade": {"ids": {"implicit": ["implicit.stat_1725749947"]}},
            },
            {
                "ref": "# to maximum Life",
                "trade": {"ids": {"explicit": ["explicit.stat_3299347043"]}},
            },
        ]
    )


def test_share_trade_ids_gives_the_stats_that_share_a_matcher_each_others_ids():
    stats = rage_stats()

    result = share_trade_ids(stats, [{"Gain # Rage on Hit", "Grants # Rage on Hit"}])

    both = {
        "explicit": ["explicit.stat_2258007247"],
        "implicit": ["implicit.stat_1725749947"],
    }
    assert result["ref"].tolist() == stats["ref"].tolist()
    assert result["trade"].tolist() == [
        {"ids": both},
        {"ids": both},
        {"ids": {"explicit": ["explicit.stat_3299347043"]}},
    ]


def test_share_trade_ids_links_the_stats_of_groups_that_share_a_stat():
    stats = rage_stats()
    groups = [
        {"Gain # Rage on Hit", "Grants # Rage on Hit"},
        {"Grants # Rage on Hit", "# to maximum Life"},
    ]

    result = share_trade_ids(stats, groups)

    every = {
        "explicit": ["explicit.stat_2258007247", "explicit.stat_3299347043"],
        "implicit": ["implicit.stat_1725749947"],
    }
    assert result["trade"].tolist() == [{"ids": every}] * 3


def test_share_trade_ids_leaves_the_given_stats_unchanged():
    stats = rage_stats()

    _ = share_trade_ids(stats, [{"Gain # Rage on Hit", "Grants # Rage on Hit"}])

    assert stats["trade"].tolist() == rage_stats()["trade"].tolist()


def test_share_trade_ids_lists_each_stats_own_trade_ids_first():
    result = share_trade_ids(
        rage_stats(), [{"Gain # Rage on Hit", "Grants # Rage on Hit"}]
    )

    keys = [list(trade["ids"]) for trade in result["trade"]]
    assert keys == [["explicit", "implicit"], ["implicit", "explicit"], ["explicit"]]


def rage_ids() -> dict[str, TradeIds]:
    return {
        "Gain # Rage on Hit": {"explicit": ["explicit.stat_2258007247"]},
        "Grants # Rage on Hit": {"implicit": ["implicit.stat_1725749947"]},
        "# Rage on Hit": {
            "enchant": ["enchant.stat_1725749947"],
            "explicit": ["explicit.stat_1725749947"],
        },
    }


def test_linked_trade_ids_gives_one_result_for_the_same_stats_in_two_orders():
    refs = list(rage_ids())
    reversed_ids = dict(reversed(rage_ids().items()))

    first = linked_trade_ids("Gain # Rage on Hit", refs, rage_ids())
    second = linked_trade_ids("Gain # Rage on Hit", refs[::-1], reversed_ids)

    assert list(first.items()) == list(second.items())


def test_linked_trade_ids_lists_the_own_types_first_then_the_others_in_ref_order():
    result = linked_trade_ids("Grants # Rage on Hit", set(rage_ids()), rage_ids())

    assert list(result.items()) == [
        ("implicit", ["implicit.stat_1725749947"]),
        ("enchant", ["enchant.stat_1725749947"]),
        ("explicit", ["explicit.stat_1725749947", "explicit.stat_2258007247"]),
    ]
