"""Builds every league's price file and writes it where the web server reads it."""

import json
import logging
import os
from collections.abc import Callable
from datetime import UTC, datetime
from pathlib import Path

from .ninja import NinjaClient, NinjaError
from .transform import Category, Json, SnapshotError, exchange_core, exchange_lines, league_file_name, price_file, stash_lines

CORE_CATEGORY = "Currency"

log = logging.getLogger(__name__)


def build_league(client: NinjaClient, categories: list[Category], league: str) -> str:
    """Returns one league's price file, with the exchange rates from its Currency overview."""
    core: Json | None = None
    overviews: list[tuple[str, list[Json]]] = []
    for category in categories:
        response = client.overview(league, category)
        if category.exchange:
            overviews.append((category.type, exchange_lines(response)))
            if category.type == CORE_CATEGORY:
                core = exchange_core(response)
        else:
            overviews.append((category.type, stash_lines(response)))
    if core is None:
        raise SnapshotError(f"no {CORE_CATEGORY} category to take exchange rates from")
    return price_file(core, overviews)


def write_atomic(directory: Path, name: str, text: str) -> None:
    """Writes a file next to its target and renames it, so readers never see half a file."""
    temporary = directory / f".{name}.tmp"
    temporary.write_text(text, encoding="utf-8")
    os.replace(temporary, directory / name)


def run_cycle(
    client: NinjaClient,
    categories: list[Category],
    output: Path,
    now: Callable[[], datetime] = lambda: datetime.now(UTC),
) -> Json:
    """Writes a price file per league and an index.json; a failed league keeps its old file."""
    written: list[Json] = []
    failed: list[str] = []
    for league in client.leagues():
        try:
            name = league_file_name(league)
            write_atomic(output, name, build_league(client, categories, league))
        except (NinjaError, SnapshotError) as error:
            log.warning("league %r skipped: %s", league, error)
            failed.append(league)
            continue
        written.append({"id": league, "file": name})
    index = {"generatedAt": now().isoformat(timespec="seconds"), "leagues": written, "failed": failed}
    write_atomic(output, "index.json", json.dumps(index, ensure_ascii=False, indent=2))
    log.info("wrote %d leagues, %d failed", len(written), len(failed))
    return index
