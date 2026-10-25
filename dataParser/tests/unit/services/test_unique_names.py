import pandas as pd
import pytest

from services.unique_names import name_uniques


def words(*rows: tuple[str, str]) -> pd.DataFrame:
    """Returns a Words table with one row per (internal name, shown name), indexed in order."""
    return pd.DataFrame(
        [
            {"_index": index, "Wordlist": 6, "Text": text, "Text2": text2}
            for index, (text, text2) in enumerate(rows)
        ]
    )


def uniques(*rows: tuple[str, str]) -> pd.DataFrame:
    return pd.DataFrame(
        [
            {"name": name, "type": base, "namespace": "UNIQUE", "unique": True}
            for name, base in rows
        ]
    )


def names(named: pd.DataFrame) -> list[tuple[str, str, str]]:
    return list(zip(named["type"], named["refName"], named["name"]))


ENGLISH_WORDS = words(
    ("Andvarius", "Andvarius"),
    ("Husk of Dreams", "Reverie"),
    ("Sekhema's Resolve Cold", "Eshtera's Path"),
)
GERMAN_WORDS = words(
    ("Andvarius", "Andvarius"),
    ("Husk of Dreams", "Träumerei"),
    ("Sekhema's Resolve Cold", "Eshteras Weg"),
)


def test_a_unique_takes_the_names_the_game_shows_in_english_and_in_the_language():
    named = name_uniques(
        uniques(("Andvarius", "Gold Ring"), ("Eshtera's Path", "Ring")),
        ENGLISH_WORDS,
        GERMAN_WORDS,
    )

    assert names(named) == [
        ("Gold Ring", "Andvarius", "Andvarius"),
        ("Ring", "Eshtera's Path", "Eshteras Weg"),
    ]


def test_a_renamed_unique_on_two_bases_is_named_on_each_base():
    named = name_uniques(
        uniques(
            ("Reverie", "Shaman Mantle"),
            ("Reverie", "Runemastered Shaman Mantle"),
        ),
        ENGLISH_WORDS,
        GERMAN_WORDS,
    )

    assert names(named) == [
        ("Shaman Mantle", "Reverie", "Träumerei"),
        ("Runemastered Shaman Mantle", "Reverie", "Träumerei"),
    ]


def test_of_two_rows_that_show_one_name_the_row_with_that_internal_name_names_it():
    english = words(("Army of Bones", "To Dust"), ("To Dust", "To Dust"))
    german = words(("Army of Bones", "Knochenarmee"), ("To Dust", "Zu Staub"))

    named = name_uniques(uniques(("To Dust", "Ring")), english, german)

    assert names(named) == [("Ring", "To Dust", "Zu Staub")]


def test_a_unique_the_words_table_lacks_is_left_out_and_logged(
    caplog: pytest.LogCaptureFixture,
):
    named = name_uniques(
        uniques(("Andvarius", "Gold Ring"), ("Unknown Band", "Ring")),
        ENGLISH_WORDS,
        GERMAN_WORDS,
    )

    assert names(named) == [("Gold Ring", "Andvarius", "Andvarius")]
    assert [record.getMessage() for record in caplog.records] == [
        "No unique named Unknown Band in the Words table, left it out"
    ]
