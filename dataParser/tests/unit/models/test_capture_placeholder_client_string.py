import re

import pytest

from constants.lang import ENGLISH
from models.capture_placeholder_client_string import CapturePlaceholderClientString


def regex_of(text: str, **options: bool) -> str:
    """Returns the regex that a capture client string writes for the game text."""
    client_string = CapturePlaceholderClientString("KEY", ["Id"], **options)
    return client_string.value({"Id": text}.__getitem__, ENGLISH)


def test_value_escapes_each_regex_syntax_character_of_the_game_text():
    text = "{0} a\\b^c$d.e*f+g?h(i)j[k]l|m/n}o{p"

    regex = regex_of(text, keep_tooltip=True)

    assert regex == r"(.*) a\\b\^c\$d\.e\*f\+g\?h\(i\)j\[k\]l\|m\/n\}o\{p"
    match = re.fullmatch(regex, text.replace("{0}", "Item"))
    assert match is not None
    assert match.group(1) == "Item"


@pytest.mark.parametrize(
    ("text", "expected"),
    [
        ("{0}\nA", "(.*)\\nA"),
        ("{0}\rA", "(.*)\\rA"),
        ("{0}\u2028A", "(.*)\\u2028A"),
        ("{0}\u2029A", "(.*)\\u2029A"),
    ],
)
def test_value_writes_a_line_break_as_an_escape(text: str, expected: str):
    assert regex_of(text) == expected


@pytest.mark.parametrize(
    ("text", "expected"),
    [
        ("Exceptional {}", "Exceptional (.*)"),
        ("{0} (hochwertig)", "(.*) \\(hochwertig\\)"),
        ("+{0:+d} to {1}", "\\+ to (.*)"),
    ],
)
def test_value_captures_numbered_placeholders_and_removes_others(
    text: str, expected: str
):
    assert regex_of(text) == expected


def test_value_with_kept_placeholders_escapes_only_the_text_around_them():
    regex = regex_of("{0} (a.b) {1}", keep_format_option=True)

    assert regex == "{0} \\(a\\.b\\) {1}"
