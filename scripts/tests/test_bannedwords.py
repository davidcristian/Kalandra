import unittest
from pathlib import Path

from support import RULES_TABLE

import bannedwords
from bannedwords import Hit, TableError


class TableTest(unittest.TestCase):
    def test_reads_every_word_of_the_first_column(self) -> None:
        table = bannedwords.parse_table(RULES_TABLE, "AGENTS.md")
        self.assertEqual(table.words, ("gate", "gates", "spell", "spells", "delve", "under the hood"))
        self.assertEqual((table.first, table.last), (3, 8))

    def test_reads_the_table_in_the_real_rules(self) -> None:
        table = bannedwords.read_table(Path(__file__).resolve().parents[2] / "AGENTS.md")
        self.assertIn("load-bearing", table.words)

    def test_fails_without_the_table_or_without_words(self) -> None:
        with self.assertRaises(TableError):
            bannedwords.parse_table("# Rules\n", "AGENTS.md")
        with self.assertRaises(TableError):
            bannedwords.parse_table("| Do not write | Write instead |\n| --- | --- |\n", "AGENTS.md")


class FindWordsTest(unittest.TestCase):
    def setUp(self) -> None:
        self.pattern = bannedwords.compile_words(bannedwords.parse_table(RULES_TABLE, "AGENTS.md").words)

    def find(self, *lines: str) -> list[Hit]:
        return bannedwords.find_words(list(enumerate(lines, start=1)), self.pattern)

    def test_finds_a_word_in_any_capitalization(self) -> None:
        self.assertEqual(self.find("The Gate passes.", "two gates"), [Hit(1, "gate"), Hit(2, "gates")])

    def test_finds_a_phrase_across_a_line_break_on_its_first_line(self) -> None:
        self.assertEqual(self.find("what happens under", "the hood here"), [Hit(1, "under the hood")])

    def test_skips_code_spans_link_targets_urls_options_and_other_words(self) -> None:
        lines = ("`gate` and [the page](gate.md)", "https://example.com/gate", "a gateway, isGated, --gate, -x-spell")
        self.assertEqual(self.find(*lines), [])

    def test_finds_a_word_or_phrase_joined_to_other_words_by_hyphens(self) -> None:
        lines = ("a gate-keeper and non-gates", "the under-the-hood", "code, re-spell it")
        self.assertEqual(
            self.find(*lines), [Hit(1, "gate"), Hit(1, "gates"), Hit(2, "under-the-hood"), Hit(3, "spell")]
        )

    def test_skips_game_terms_written_with_the_games_capitals(self) -> None:
        self.assertEqual(self.find("Spell Damage and the Delve grid", "spell it out"), [Hit(2, "spell")])

    def test_a_blank_line_ends_a_phrase(self) -> None:
        self.assertEqual(self.find("under", "", "the hood"), [])
