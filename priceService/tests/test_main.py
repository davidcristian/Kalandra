import json
import logging
import tempfile
import unittest
from pathlib import Path

from support import FakeGet, FakeSleep, StopScheduleError, league_routes

from price_service.__main__ import Settings, SettingsError, main, read_settings

NAMESPACE_MAP = {
    "schemaVersion": 1,
    "map": [
        {"type": "Currency", "cx": True},
        {"type": "UniqueWeapons", "cx": False},
        {"type": "PrecursorTablets", "cx": False},
    ],
}
LEAGUE_FILES = [
    "forbiddenrites.json",
    "hardcore.json",
    "hcforbiddenrites.json",
    "hcrunesofaldur.json",
    "index.json",
    "runesofaldur.json",
    "standard.json",
]
# The league list, then one request per category for each of the six leagues in leagues.json
REQUESTS_PER_CYCLE = 1 + 6 * 3


class ReadSettingsTest(unittest.TestCase):
    def test_uses_the_default_of_each_missing_variable(self) -> None:
        self.assertEqual(
            read_settings({}),
            Settings(
                output=Path("/srv/prices"),
                namespace_map=Path("/app/namespaceMap.json"),
                interval_seconds=3600.0,
                delay_seconds=1.0,
                user_agent="kalandra-price-service/1 (+https://github.com/davidcristian/Kalandra/issues)",
                log_level="INFO",
            ),
        )

    def test_reads_each_variable(self) -> None:
        environ = {
            "PRICE_OUTPUT_DIR": "/data/prices",
            "PRICE_NAMESPACE_MAP": "/data/namespaceMap.json",
            "PRICE_INTERVAL_MINUTES": "1.5",
            "PRICE_REQUEST_DELAY_SECONDS": "0.25",
            "PRICE_CONTACT": "mailto:prices@example.com",
            "PRICE_LOG_LEVEL": "DEBUG",
        }
        self.assertEqual(
            read_settings(environ),
            Settings(
                output=Path("/data/prices"),
                namespace_map=Path("/data/namespaceMap.json"),
                interval_seconds=90.0,
                delay_seconds=0.25,
                user_agent="kalandra-price-service/1 (+mailto:prices@example.com)",
                log_level="DEBUG",
            ),
        )

    def test_a_number_the_schedule_cannot_use_raises_an_error_that_names_the_variable(self) -> None:
        cases = [
            ("PRICE_INTERVAL_MINUTES", "0", "a number above 0"),
            ("PRICE_INTERVAL_MINUTES", "-60", "a number above 0"),
            ("PRICE_INTERVAL_MINUTES", "nan", "a number above 0"),
            ("PRICE_INTERVAL_MINUTES", "inf", "a number above 0"),
            ("PRICE_INTERVAL_MINUTES", "an hour", "a number above 0"),
            ("PRICE_REQUEST_DELAY_SECONDS", "-1", "a number of 0 or more"),
            ("PRICE_REQUEST_DELAY_SECONDS", "nan", "a number of 0 or more"),
            ("PRICE_REQUEST_DELAY_SECONDS", "inf", "a number of 0 or more"),
            ("PRICE_REQUEST_DELAY_SECONDS", "", "a number of 0 or more"),
        ]
        for name, value, rule in cases:
            with self.subTest(name=name, value=value):
                with self.assertRaises(SettingsError) as raised:
                    read_settings({name: value})
                self.assertEqual(str(raised.exception), f"{name} must be {rule}, not {value!r}")

    def test_accepts_no_pause_between_requests(self) -> None:
        self.assertEqual(read_settings({"PRICE_REQUEST_DELAY_SECONDS": "0"}).delay_seconds, 0.0)

    def test_an_empty_contact_sends_the_default_contact(self) -> None:
        self.assertEqual(
            read_settings({"PRICE_CONTACT": ""}).user_agent,
            "kalandra-price-service/1 (+https://github.com/davidcristian/Kalandra/issues)",
        )


class MainTest(unittest.TestCase):
    def setUp(self) -> None:
        root = logging.getLogger()
        handlers, level = root.handlers[:], root.level
        root.handlers = []

        def restore() -> None:
            root.handlers = handlers
            root.setLevel(level)

        self.addCleanup(restore)
        directory = tempfile.TemporaryDirectory()
        self.addCleanup(directory.cleanup)
        self.output = Path(directory.name) / "missing" / "prices"
        namespace_map = Path(directory.name) / "namespaceMap.json"
        namespace_map.write_text(json.dumps(NAMESPACE_MAP), encoding="utf-8")
        self.environ = {
            "PRICE_OUTPUT_DIR": str(self.output),
            "PRICE_NAMESPACE_MAP": str(namespace_map),
            "PRICE_REQUEST_DELAY_SECONDS": "0.25",
            "PRICE_CONTACT": "mailto:prices@example.com",
            "PRICE_LOG_LEVEL": "ERROR",
        }
        self.get = FakeGet(league_routes())

    def test_once_runs_one_cycle_and_returns(self) -> None:
        sleep = FakeSleep(stop_at=REQUESTS_PER_CYCLE + 1)
        main(["--once"], self.environ, get=self.get, sleep=sleep, clock=lambda: 0.0)
        self.assertEqual(sorted(path.name for path in self.output.iterdir()), LEAGUE_FILES)
        self.assertEqual(sleep.waits, [0.25] * REQUESTS_PER_CYCLE)
        user_agents = {headers["User-Agent"] for _, headers in self.get.calls}
        self.assertEqual(user_agents, {"kalandra-price-service/1 (+mailto:prices@example.com)"})
        self.assertEqual(logging.getLogger().level, logging.ERROR)

    def test_without_once_waits_the_interval_after_each_cycle(self) -> None:
        sleep = FakeSleep(stop_at=2 * (REQUESTS_PER_CYCLE + 1))
        environ = {**self.environ, "PRICE_INTERVAL_MINUTES": "90"}
        with self.assertRaises(StopScheduleError):
            main([], environ, get=self.get, sleep=sleep, clock=lambda: 0.0)
        self.assertEqual(sleep.waits, ([0.25] * REQUESTS_PER_CYCLE + [5400.0]) * 2)
        self.assertEqual(len(self.get.calls), 2 * REQUESTS_PER_CYCLE)

    def test_a_bad_setting_stops_the_service_before_any_request(self) -> None:
        cases: list[tuple[str, str, type[Exception]]] = [
            ("PRICE_INTERVAL_MINUTES", "an hour", SettingsError),
            ("PRICE_INTERVAL_MINUTES", "0", SettingsError),
            ("PRICE_REQUEST_DELAY_SECONDS", "", SettingsError),
            ("PRICE_REQUEST_DELAY_SECONDS", "-1", SettingsError),
            ("PRICE_LOG_LEVEL", "LOUD", ValueError),
            ("PRICE_NAMESPACE_MAP", str(self.output / "namespaceMap.json"), FileNotFoundError),
        ]
        for name, value, error in cases:
            logging.getLogger().handlers = []
            with self.subTest(name=name, value=value), self.assertRaises(error):
                main(["--once"], {**self.environ, name: value}, get=self.get, sleep=lambda _: None)
        self.assertEqual(self.get.calls, [])
        self.assertFalse(self.output.exists())


if __name__ == "__main__":
    unittest.main()
