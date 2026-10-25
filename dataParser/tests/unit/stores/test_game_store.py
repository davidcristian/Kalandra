from pathlib import Path
from unittest.mock import patch

import pandas as pd
import pytest

from constants.lang import CHINESE, ENGLISH, GERMAN
from stores import game_store
from stores.game_store import GameStore
from stores.helpers.description import Description


def test_a_store_reads_the_tables_of_its_language_folder() -> None:
    assert Path(GameStore(ENGLISH).data_dir).name == "English"
    assert Path(GameStore(CHINESE).data_dir).name == "Traditional Chinese"


def test_get_reads_a_table_from_the_data_folder(tmp_path: Path) -> None:
    _ = (tmp_path / "Tags.json").write_text(
        '[{"_index": 0, "Id": "ring"}, {"_index": 1, "Id": "amulet"}]',
        encoding="utf-8",
    )
    store = GameStore(ENGLISH)
    store.data_dir = str(tmp_path)

    result = store.get("Tags.json")

    pd.testing.assert_frame_equal(
        result, pd.DataFrame({"_index": [0, 1], "Id": ["ring", "amulet"]})
    )


def test_get_description_parses_a_file_in_the_store_language(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    case = Path("tests/data/cases/one_description_test.csd")
    _ = (tmp_path / case.name).write_text(
        case.read_text(encoding="utf-8"), encoding="utf-16"
    )

    class TmpDescription(Description):
        """Reads its file from tmp_path."""

        def __init__(self, lang, filename):
            super().__init__(lang, filename)
            self.data_dir = str(tmp_path)

    monkeypatch.setattr(game_store, "Description", TmpDescription)

    result = GameStore(GERMAN).get_description(case.name)

    assert result["id"].tolist() == ["+1_spirit_per_X_evasion_rating_on_body_armour"]
    assert result["matchers"].tolist() == [
        [
            {
                "string": "1 zu Wille für jede # Ausweichwert auf der ausgerüsteten Körperrüstung"
            }
        ]
    ]


@patch("stores.game_store.GameStore.get_description")
@patch("stores.game_store.STAT_DESCRIPTION_FILES", new=["file1.json", "file2.json"])
def test_get_all_descriptions(mock_get_description):
    # Mock data to simulate the descriptions
    mock_df1 = pd.DataFrame({"desc": ["description1", "description2"]})
    mock_df2 = pd.DataFrame({"desc": ["description3", "description4"]})

    # Set the side effect of the mock to the list of mock DataFrames
    mock_get_description.side_effect = [mock_df1, mock_df2]

    # Create an instance of GameStore
    store = GameStore("en")

    # Call the method under test
    result = store.get_all_descriptions()

    # Concatenate the mock DataFrames to form the expected result
    expected_result = pd.concat([mock_df1, mock_df2])

    # Assert that the result matches the expected DataFrame
    pd.testing.assert_frame_equal(result, expected_result)
