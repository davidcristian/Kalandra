import json
import os
import tempfile
import unittest
from datetime import UTC, datetime
from functools import partial
from pathlib import Path

from support import FIXTURES, FakeDisk, FakeGet, FakeSleep, StopScheduleError, fixture, league_routes, ok

from price_service.ninja import NinjaClient, Reply, StopCycleError
from price_service.service import build_league, run_cycle, run_schedule, write_atomic
from price_service.transform import Category, Json, SnapshotError

CATEGORIES = [
    Category("Currency", exchange=True),
    Category("UniqueWeapons", exchange=False),
    Category("PrecursorTablets", exchange=False),
]
NOW = datetime(2026, 10, 18, 12, 0, tzinfo=UTC)


def client(routes: dict[str, list[Reply | BaseException]]) -> NinjaClient:
    return NinjaClient(FakeGet(routes), user_agent="test", sleep=lambda _: None)


class BuildLeagueTest(unittest.TestCase):
    def test_matches_the_price_file_the_app_tests_read(self) -> None:
        text = build_league(client(league_routes()), CATEGORIES, "Runes of Aldur")
        self.assertEqual(text + "\n", (FIXTURES / "price_file.json").read_text("utf-8"))

    def test_names_a_currency_core_without_a_divine_rate(self) -> None:
        response = json.loads(fixture("hardcore_exchange_currency.json"))
        response["core"]["rates"].pop("divine")
        routes = league_routes()
        routes["type=Currency"] = [ok(response)]
        with self.assertRaisesRegex(SnapshotError, "^exchange core in exalted has no divine rate$"):
            build_league(client(routes), CATEGORIES, "HC Runes of Aldur")

    def test_needs_a_currency_category_for_the_exchange_rates(self) -> None:
        with self.assertRaises(SnapshotError):
            build_league(client(league_routes()), CATEGORIES[1:], "Runes of Aldur")


class RunCycleTest(unittest.TestCase):
    def setUp(self) -> None:
        self.directory = tempfile.TemporaryDirectory()
        self.output = Path(self.directory.name)

    def tearDown(self) -> None:
        self.directory.cleanup()

    def test_writes_a_file_per_league_and_an_index(self) -> None:
        routes = league_routes()
        routes["/leagues"] = [ok([{"id": "Runes of Aldur"}, {"id": "Standard"}])]
        index = run_cycle(client(routes), CATEGORIES, self.output, now=lambda: NOW)
        self.assertEqual(
            sorted(path.name for path in self.output.iterdir()), ["index.json", "runesofaldur.json", "standard.json"]
        )
        self.assertEqual(json.loads((self.output / "index.json").read_text("utf-8")), index)
        self.assertEqual(index["generatedAt"], "2026-10-18T12:00:00+00:00")
        leagues = [{"id": "Runes of Aldur", "file": "runesofaldur.json"}, {"id": "Standard", "file": "standard.json"}]
        self.assertEqual(index["leagues"], leagues)

    def test_keeps_the_old_file_of_a_league_that_fails(self) -> None:
        (self.output / "standard.json").write_text("old", encoding="utf-8")
        routes = league_routes()
        routes["/leagues"] = [ok([{"id": "Standard"}, {"id": "///"}])]
        routes["type=Currency"] = [Reply(503, b"", None)]
        with self.assertLogs("price_service.service", "WARNING"):
            index = run_cycle(client(routes), CATEGORIES, self.output, now=lambda: NOW)
        self.assertEqual((self.output / "standard.json").read_text("utf-8"), "old")
        self.assertEqual(index["leagues"], [])
        self.assertEqual(index["failed"], ["Standard", "///"])

    def test_a_429_stops_the_cycle_and_keeps_the_last_files(self) -> None:
        routes = league_routes()
        routes["/leagues"] = [ok([{"id": "Runes of Aldur"}, {"id": "Standard"}])]
        get = FakeGet(routes)
        ninja = NinjaClient(get, user_agent="test", sleep=lambda _: None)
        run_cycle(ninja, CATEGORIES, self.output, now=lambda: NOW)
        written = {path.name: path.read_text("utf-8") for path in self.output.iterdir()}
        limited: dict[str, list[Reply | BaseException]] = {
            "type=UniqueWeapons": [Reply(429, b"", None)],
            "/economy/": [Reply(304, b"", None)],
        }
        get.routes = limited
        get.calls.clear()
        with self.assertRaises(StopCycleError):
            run_cycle(ninja, CATEGORIES, self.output, now=lambda: datetime(2026, 10, 18, 13, 0, tzinfo=UTC))
        self.assertEqual(len(get.calls), 3)
        self.assertEqual({path.name: path.read_text("utf-8") for path in self.output.iterdir()}, written)

    def test_skips_a_league_whose_file_name_is_the_index_or_an_earlier_leagues(self) -> None:
        routes = league_routes()
        routes["/leagues"] = [ok([{"id": "Runes of Aldur"}, {"id": "Index"}, {"id": "Runes-of-Aldur"}])]
        get = FakeGet(routes)
        ninja = NinjaClient(get, user_agent="test", sleep=lambda _: None)
        with self.assertLogs("price_service.service", "WARNING") as logs:
            index = run_cycle(ninja, CATEGORIES, self.output, now=lambda: NOW)
        skipped = "WARNING:price_service.service:league {!r} skipped: {}"
        self.assertEqual(
            logs.output,
            [
                skipped.format("Index", "league id 'Index' gives the file name of the index"),
                skipped.format("Runes-of-Aldur", "runesofaldur.json is already the file of league 'Runes of Aldur'"),
            ],
        )
        self.assertEqual(index["leagues"], [{"id": "Runes of Aldur", "file": "runesofaldur.json"}])
        self.assertEqual(index["failed"], ["Index", "Runes-of-Aldur"])
        self.assertEqual(sorted(path.name for path in self.output.iterdir()), ["index.json", "runesofaldur.json"])
        self.assertEqual(len(get.calls), 1 + len(CATEGORIES))

    def test_keeps_the_old_file_of_a_league_with_a_category_it_cannot_convert(self) -> None:
        (self.output / "bad.json").write_text("old", encoding="utf-8")
        in_chaos: Json = {"core": {"primary": "chaos", "rates": {}}, "lines": [{"name": "Rune", "primaryValue": 1}]}
        routes: dict[str, list[Reply | BaseException]] = {"league=Bad&type=UniqueWeapons": [ok(in_chaos)]}
        routes.update(league_routes())
        routes["/leagues"] = [ok([{"id": "Bad"}, {"id": "Standard"}])]
        with self.assertLogs("price_service.service", "WARNING") as logs:
            index = run_cycle(client(routes), CATEGORIES, self.output, now=lambda: NOW)
        reason = "UniqueWeapons: core in chaos has no divine rate to convert its lines"
        self.assertEqual(logs.output, [f"WARNING:price_service.service:league 'Bad' skipped: {reason}"])
        self.assertEqual((self.output / "bad.json").read_text("utf-8"), "old")
        self.assertEqual(index["failed"], ["Bad"])
        self.assertEqual(index["leagues"], [{"id": "Standard", "file": "standard.json"}])

    def test_skips_a_league_whose_values_the_file_cannot_hold(self) -> None:
        nan, surrogate = (json.loads(fixture("exchange_currency.json")) for _ in range(2))
        nan["lines"][0]["primaryValue"] = float("nan")
        surrogate["items"][0]["name"] = "\ud800"
        in_chaos = {"core": {"primary": "chaos", "rates": {"divine": 10}}}
        cases = [
            ("type=Currency", nan),
            ("type=Currency", surrogate),
            ("type=UniqueWeapons", {**in_chaos, "lines": [{"name": "Rune", "primaryValue": 1e308}]}),
            ("type=UniqueWeapons", {**in_chaos, "lines": [{"name": "Rune", "primaryValue": 10**400}]}),
        ]
        for fragment, response in cases:
            with self.subTest(fragment=fragment, response=str(response)[:60]), tempfile.TemporaryDirectory() as name:
                output = Path(name)
                routes: dict[str, list[Reply | BaseException]] = {f"league=Bad&{fragment}": [ok(response)]}
                routes.update(league_routes())
                routes["/leagues"] = [ok([{"id": "Bad"}, {"id": "Standard"}])]
                with self.assertLogs("price_service.service", "WARNING"):
                    index = run_cycle(client(routes), CATEGORIES, output, now=lambda: NOW)
                self.assertEqual(index["failed"], ["Bad"])
                self.assertEqual(sorted(path.name for path in output.iterdir()), ["index.json", "standard.json"])


class RunScheduleTest(unittest.TestCase):
    def test_an_error_ends_only_its_cycle_and_the_next_starts_on_time(self) -> None:
        get = FakeGet(league_routes())
        ninja = NinjaClient(get, user_agent="test", sleep=lambda _: None)
        times = iter([0.0, 25.0, 3600.0, 3625.0])
        sleep = FakeSleep(stop_at=2)
        with tempfile.TemporaryDirectory() as name:
            missing = Path(name) / "missing"
            with self.assertLogs("price_service.service", "ERROR") as logs, self.assertRaises(StopScheduleError):
                run_schedule(
                    lambda: run_cycle(ninja, CATEGORIES, missing), 3600, sleep=sleep, clock=lambda: next(times)
                )
        self.assertEqual(sleep.waits, [3575.0, 3575.0])
        self.assertEqual(len(get.calls), 8)
        self.assertEqual([record.exc_info is not None for record in logs.records], [True, True])

    def test_once_runs_one_cycle_and_logs_a_failed_request_without_a_traceback(self) -> None:
        sleeps: list[float] = []
        failing = client({"/leagues": [Reply(503, b"", None)]})
        with tempfile.TemporaryDirectory() as name, self.assertLogs("price_service.service", "ERROR") as logs:
            run_schedule(lambda: run_cycle(failing, CATEGORIES, Path(name)), 3600, once=True, sleep=sleeps.append)
        self.assertEqual(sleeps, [])
        self.assertEqual(
            logs.output,
            ["ERROR:price_service.service:cycle failed: https://poe.ninja/poe2/api/economy/leagues: HTTP 503"],
        )
        self.assertIsNone(logs.records[0].exc_info)

    def test_a_stopped_cycle_waits_for_a_longer_retry_after(self) -> None:
        cases = [(None, 3599.0, ""), ("60", 3599.0, ", retry after 60 seconds")]
        cases.append(("7200", 7200.0, ", retry after 7200 seconds"))
        for header, wait, reason in cases:
            with self.subTest(header=header):
                ninja = client({"/leagues": [Reply(429, b"", None, header)]})
                sleep = FakeSleep(stop_at=1)
                with tempfile.TemporaryDirectory() as name, self.assertLogs("price_service.service", "ERROR") as logs:
                    cycle = partial(run_cycle, ninja, CATEGORIES, Path(name))
                    with self.assertRaises(StopScheduleError):
                        run_schedule(cycle, 3600, sleep=sleep, clock=iter([0.0, 1.0]).__next__)
                    self.assertEqual(list(Path(name).iterdir()), [])
                self.assertEqual(sleep.waits, [wait])
                url = "https://poe.ninja/poe2/api/economy/leagues"
                self.assertEqual(logs.output, [f"ERROR:price_service.service:cycle stopped: {url}: HTTP 429{reason}"])
                self.assertIsNone(logs.records[0].exc_info)

    def test_waits_the_rest_of_the_interval_or_not_at_all(self) -> None:
        for elapsed, wait in ((0.0, 3600.0), (3599.5, 0.5), (3600.0, 0.0), (5400.0, 0.0)):
            with self.subTest(elapsed=elapsed):
                sleep = FakeSleep(stop_at=1)
                with self.assertRaises(StopScheduleError):
                    run_schedule(lambda: None, 3600, sleep=sleep, clock=iter([100.0, 100.0 + elapsed]).__next__)
                self.assertEqual(sleep.waits, [wait])


class WriteAtomicTest(unittest.TestCase):
    def setUp(self) -> None:
        self.temporary = tempfile.TemporaryDirectory()
        self.directory = Path(self.temporary.name)
        (self.directory / "a.json").write_text("old", encoding="utf-8")

    def tearDown(self) -> None:
        self.temporary.cleanup()

    def test_replaces_the_target_and_leaves_no_temporary_file(self) -> None:
        write_atomic(self.directory, "a.json", "new")
        self.assertEqual([path.name for path in self.directory.iterdir()], ["a.json"])
        self.assertEqual((self.directory / "a.json").read_text("utf-8"), "new")

    def test_syncs_the_whole_text_before_the_rename_and_the_directory_after_it(self) -> None:
        disk = FakeDisk(self.directory)
        write_atomic(self.directory, "a.json", "new", fsync=disk.fsync, open_directory=disk.open_directory)
        synced = [("file", {".a.json.tmp": "new", "a.json": "old"}), ("directory", {"a.json": "new"})]
        self.assertEqual(disk.synced, synced)
        self.assertEqual([directory for directory, _ in disk.opened], [self.directory])
        with self.assertRaises(OSError):
            os.fstat(disk.opened[0][1])

    def test_syncs_only_the_file_where_the_platform_cannot_open_a_directory(self) -> None:
        disk = FakeDisk(self.directory)
        write_atomic(self.directory, "a.json", "new", fsync=disk.fsync, open_directory=None)
        self.assertEqual(disk.synced, [("file", {".a.json.tmp": "new", "a.json": "old"})])
        self.assertEqual((self.directory / "a.json").read_text("utf-8"), "new")


if __name__ == "__main__":
    unittest.main()
