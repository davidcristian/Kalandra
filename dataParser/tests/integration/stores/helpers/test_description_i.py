from pathlib import Path

import pandas as pd
import pytest

from constants.lang import ENGLISH, KOREAN, LANG
from stores.helpers.description import Description

CASES = Path("tests/data/cases")
EXPECTED = Path("tests/data/expected")


def load_case(tmp_path: Path, file_name: str, lang: LANG) -> Description:
    """Returns a description of a case file, copied to tmp_path as UTF-16 like the game's files."""
    _ = (tmp_path / file_name).write_text(
        (CASES / file_name).read_text(encoding="utf-8"), encoding="utf-16"
    )
    desc = Description(lang, file_name)
    desc.data_dir = str(tmp_path)
    return desc


def read_expected(file_name: str) -> pd.DataFrame:
    """Returns the expected frame, or skips a case whose expected frame is not in the repo."""
    path = EXPECTED / file_name
    if not path.is_file():
        pytest.skip(
            f"{path} is missing: the hash of a stat the trade site does not list "
            "comes only from the code under test"
        )
    return pd.read_json(path)


@pytest.mark.parametrize(
    "file_name,expected",
    [
        ("one_description_test.csd", "one_description_test_integration.json"),
        (
            "one_description_multi_lines_test.csd",
            "one_description_multi_lines_test_integration.json",
        ),
        ("two_description_test.csd", "two_description_test_integration.json"),
        (
            "two_description_one_no_description_test.csd",
            "two_description_test_integration.json",
        ),
        ("case_empty.csd", pytest.raises(ValueError)),
        ("case_only_no_description.csd", pytest.raises(ValueError)),
        (
            "one_description_with_flags_test.csd",
            "one_description_with_flags_test_integration.json",
        ),
        (
            "one_description_multiple_matchers_test.csd",
            "one_description_multiple_matchers_test_integration.json",
        ),
        (
            "case_bleeding_edge_case.csd",
            "case_bleeding_edge_case_integration.json",
        ),
    ],
    ids=[
        "One Description",
        "One Description, Multi Line Data",
        "Two Descriptions",
        "Two Descriptions, One No Description",
        "Empty File",
        "Only No Descriptions",
        "One Description with Flags",
        "One Description, Multiple Matchers",
        "Edge Case, Attacks cannot cause Bleeding",
    ],
)
def test_description_integration_test(tmp_path, file_name, expected):
    desc = load_case(tmp_path, file_name, ENGLISH)

    if isinstance(expected, str):
        expected_df = read_expected(expected)
        desc.load()
        pd.testing.assert_frame_equal(
            desc.to_dataframe().reset_index(drop=True), expected_df
        )
    else:
        with expected:
            desc.load()


@pytest.mark.parametrize(
    "file_name,expected",
    [
        (
            "case_very_hard_encompassing_test.csd",
            "case_very_hard_encompassing_test_integration.json",
        ),
        (
            "case_uneven_lines_per_lang.csd",
            "case_uneven_lines_per_lang_test_integration.json",
        ),
        ("case_missing_lang.csd", "case_missing_lang_test_integration.json"),
    ],
    ids=["Hard", "Uneven Lines per Language", "Missing Language"],
)
def test_description_integration_test_korean(tmp_path, file_name, expected):
    desc = load_case(tmp_path, file_name, KOREAN)
    expected_df = read_expected(expected)

    desc.load()

    pd.testing.assert_frame_equal(
        desc.to_dataframe().reset_index(drop=True), expected_df
    )
