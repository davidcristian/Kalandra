"""Builds every league's price file and writes it where the web server reads it."""

import json
import logging
import time
from collections.abc import Callable
from datetime import UTC, datetime
from pathlib import Path

from .ninja import NinjaClient, NinjaError, StopCycleError
from .transform import (
    INDEX_FILE,
    Category,
    Json,
    SnapshotError,
    exchange_core,
    exchange_lines,
    league_file_name,
    price_file,
    stash_lines,
)

CORE_CATEGORY = "Currency"

log = logging.getLogger(__name__)


class FileNameTakenError(ValueError):
    """Two league ids in one cycle give the same file name."""


def claim_file_name(league: str, claimed: dict[str, str]) -> str:
    """Returns a league's file name and records it in claimed; raises FileNameTakenError if another league has it."""
    name = league_file_name(league)
    first = claimed.setdefault(name, league)
    if first != league:
        msg = f"{name} is already the file of league {first!r}"
        raise FileNameTakenError(msg)
    return name


def build_league(client: NinjaClient, categories: list[Category], league: str) -> str:
    """Returns one league's price file, with the exchange rates from its Currency overview."""
    core: Json | None = None
    overviews: list[tuple[str, list[Json]]] = []
    for category in categories:
        response = client.overview(league, category)
        if category.exchange and category.type == CORE_CATEGORY:
            core = exchange_core(response)
        try:
            lines = exchange_lines(response) if category.exchange else stash_lines(response)
        except SnapshotError as error:
            msg = f"{category.type}: {error}"
            raise SnapshotError(msg) from error
        overviews.append((category.type, lines))
    if core is None:
        msg = f"no {CORE_CATEGORY} category to take exchange rates from"
        raise SnapshotError(msg)
    return price_file(core, overviews)


def write_atomic(directory: Path, name: str, text: str) -> None:
    """Writes a file next to its target and renames it, so readers never see half a file."""
    temporary = directory / f".{name}.tmp"
    temporary.write_text(text, encoding="utf-8")
    temporary.replace(directory / name)


def run_cycle(
    client: NinjaClient,
    categories: list[Category],
    output: Path,
    now: Callable[[], datetime] = lambda: datetime.now(UTC),
) -> Json:
    """Writes a price file per league and an index.json; a failed league keeps its old file.

    When two leagues give the same file name, the first in poe.ninja's list keeps it and the other is skipped.
    """
    written: list[Json] = []
    failed: list[str] = []
    claimed: dict[str, str] = {}
    for league in client.leagues():
        try:
            name = claim_file_name(league, claimed)
            write_atomic(output, name, build_league(client, categories, league))
        # ValueError includes SnapshotError and FileNameTakenError. A value that the conversion to divines makes too
        # large for a float raises OverflowError, an ArithmeticError, or makes price_file raise ValueError
        except (NinjaError, ValueError, ArithmeticError) as error:
            log.warning("league %r skipped: %s", league, error)
            failed.append(league)
            continue
        written.append({"id": league, "file": name})
    index: Json = {"generatedAt": now().isoformat(timespec="seconds"), "leagues": written, "failed": failed}
    write_atomic(output, INDEX_FILE, json.dumps(index, ensure_ascii=False, indent=2))
    log.info("wrote %d leagues, %d failed", len(written), len(failed))
    return index


def run_schedule(
    cycle: Callable[[], object],
    interval: float,
    *,
    once: bool = False,
    sleep: Callable[[float], None] = time.sleep,
    clock: Callable[[], float] = time.monotonic,
) -> None:
    """Runs a cycle every interval seconds, or one cycle with once; an error ends only its own cycle.

    After a StopCycleError, the next cycle also waits for the Retry-After of the reply that stopped it.
    """
    while True:
        started = clock()
        retry_after = 0.0
        try:
            cycle()
        except StopCycleError as error:
            log.error("cycle stopped: %s", error)  # noqa: TRY400 poe.ninja's status needs no traceback
            retry_after = error.retry_after or 0.0
        except NinjaError as error:
            log.error("cycle failed: %s", error)  # noqa: TRY400 a failed request needs no traceback
        # The process keeps running, because Docker restarts a process that ends and the new one requests every
        # category again at once, while poe.ninja asks for at most one request per category an hour
        except Exception:
            log.exception("cycle failed")
        if once:
            return
        # Retry-After counts from the cycle's last reply, so from now, and the interval from the cycle's start
        sleep(max(0.0, interval - (clock() - started), retry_after))
