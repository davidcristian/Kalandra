import json
import unittest

from price_service.transform import (
    EMPTY_SPARKLINE,
    SnapshotError,
    exchange_core,
    exchange_lines,
    league_file_name,
    load_categories,
    price_file,
    stash_lines,
)
from support import FIXTURES, NAMESPACE_MAP, fixture


class LoadCategoriesTest(unittest.TestCase):
    def test_reads_the_apps_namespace_map(self) -> None:
        categories = load_categories(NAMESPACE_MAP.read_text("utf-8"))
        by_type = {category.type: category for category in categories}
        self.assertEqual(len(categories), 23)
        self.assertTrue(by_type["Currency"].exchange)
        self.assertTrue(by_type["SoulCores"].exchange)
        self.assertFalse(by_type["UniqueWeapons"].exchange)
        self.assertFalse(by_type["PrecursorTablets"].exchange)

    def test_rejects_an_unknown_schema_version(self) -> None:
        with self.assertRaises(SnapshotError):
            load_categories('{"schemaVersion": 2, "map": []}')


class LeagueFileNameTest(unittest.TestCase):
    def test_matches_the_cases_the_app_tests_read(self) -> None:
        cases = json.loads((FIXTURES / "league_files.json").read_text("utf-8"))
        for league_id, file_name in cases.items():
            self.assertEqual(league_file_name(league_id), file_name)

    def test_rejects_an_id_without_letters_or_digits(self) -> None:
        with self.assertRaises(SnapshotError):
            league_file_name("../ /")


class ExchangeTest(unittest.TestCase):
    def setUp(self) -> None:
        self.response = json.loads(fixture("exchange_currency.json"))

    def test_joins_lines_with_item_names_in_the_parsed_key_order(self) -> None:
        lines = exchange_lines(self.response)
        self.assertEqual([line["name"] for line in lines], ["Orb of Alchemy", "Exalted Orb", "Chaos Orb"])
        self.assertEqual(
            list(lines[0]),
            ["name", "primaryValue", "detailsId", "id", "volumePrimaryValue", "maxVolumeCurrency", "maxVolumeRate", "sparkline"],
        )
        self.assertEqual(lines[1]["detailsId"], "exalted-orb")

    def test_skips_lines_without_an_item_or_a_numeric_value(self) -> None:
        self.response["lines"].append({"id": "unknown", "primaryValue": 1})
        self.response["lines"].append({"id": "alch", "primaryValue": True})
        self.response["lines"].append("not a line")
        self.assertEqual(len(exchange_lines(self.response)), 3)

    def test_core_drops_the_item_list(self) -> None:
        core = exchange_core(self.response)
        self.assertEqual(list(core), ["rates", "primary", "secondary"])
        self.assertEqual(core["primary"], "divine")

    def test_core_requires_rates_and_currencies(self) -> None:
        for response in (
            {},
            {"core": {"rates": {}, "primary": None, "secondary": "chaos"}},
            {"core": {"rates": {"chaos": 3}, "primary": "exalted", "secondary": "chaos"}},
        ):
            with self.assertRaises(SnapshotError):
                exchange_core(response)


class DivineConversionTest(unittest.TestCase):
    def setUp(self) -> None:
        self.response = json.loads(fixture("hardcore_exchange_currency.json"))

    def test_core_in_exalted_becomes_rates_per_divine(self) -> None:
        self.assertEqual(
            exchange_core(self.response),
            {"rates": {"chaos": 39.99759990399616, "exalted": 120.00480019200768}, "primary": "divine", "secondary": "exalted"},
        )

    def test_exchange_values_in_exalted_become_divines(self) -> None:
        values = {line["name"]: (line["primaryValue"], line["volumePrimaryValue"]) for line in exchange_lines(self.response)}
        self.assertEqual(values["Exalted Orb"], (0.008333, 0.16666))
        self.assertEqual(values["Chaos Orb"], (0.024999, 0.0124995))
        self.assertEqual(values["Orb of Alchemy"], (0.04049838, 0.6958055))

    def test_stash_values_follow_their_own_core(self) -> None:
        response = {"core": {"rates": {"divine": 0.5}, "primary": "chaos"}, "lines": [{"name": "Rune", "primaryValue": 4}]}
        self.assertEqual(stash_lines(response)[0]["primaryValue"], 2.0)

    def test_drops_lines_it_cannot_convert(self) -> None:
        self.response["core"]["rates"].pop("divine")
        self.assertEqual(exchange_lines(self.response), [])
        self.assertEqual(stash_lines({"core": {"primary": "chaos", "rates": {}}, "lines": [{"name": "Rune", "primaryValue": 4}]}), [])


class StashTest(unittest.TestCase):
    def test_uses_the_base_type_as_variant_and_drops_other_fields(self) -> None:
        lines = stash_lines(json.loads(fixture("stash_unique_weapons.json")))
        self.assertEqual(lines[0]["name"], "Redbeak")
        self.assertEqual(lines[0]["variant"], "Shortsword")
        self.assertEqual(list(lines[0]), ["name", "variant", "primaryValue", "detailsId", "sparkline"])

    def test_prefers_the_variant_field_when_there_is_one(self) -> None:
        lines = stash_lines(json.loads(fixture("stash_precursor_tablets.json")))
        self.assertEqual([line["variant"] for line in lines], ["Normal", "Magic"])

    def test_omits_a_missing_variant_and_fills_a_missing_sparkline(self) -> None:
        response = {"core": {"primary": "divine"}, "lines": [{"name": "Rune", "primaryValue": 2, "detailsId": "rune"}]}
        lines = stash_lines(response)
        self.assertEqual(lines, [{"name": "Rune", "primaryValue": 2, "detailsId": "rune", "sparkline": EMPTY_SPARKLINE}])


class PriceFileTest(unittest.TestCase):
    def test_writes_compact_json_and_keeps_non_ascii_names(self) -> None:
        text = price_file({"rates": {}, "primary": "divine", "secondary": "chaos"}, [("Runes", [{"name": "Ölrune"}])])
        self.assertTrue(text.startswith('{"core":{"rates":{},"primary":"divine","secondary":"chaos"},"itemOverviews":'))
        self.assertIn('{"type":"Runes","lines":[{"name":"Ölrune"}]}', text)

    def test_rejects_values_json_cannot_hold(self) -> None:
        with self.assertRaises(ValueError):
            price_file({"rates": {"chaos": float("nan")}}, [])


if __name__ == "__main__":
    unittest.main()
