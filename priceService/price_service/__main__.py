"""Runs the price service: one cycle, then one per interval, until stopped."""

import argparse
import logging
import os
import time
from collections.abc import Callable, Mapping, Sequence
from dataclasses import dataclass
from pathlib import Path

from .ninja import HttpGet, NinjaClient, urllib_get
from .service import run_cycle, run_schedule
from .transform import load_categories

DEFAULT_CONTACT = "https://github.com/davidcristian/Kalandra/issues"


@dataclass(frozen=True)
class Settings:
    """The values the service reads from its environment variables."""

    output: Path
    namespace_map: Path
    interval_seconds: float
    delay_seconds: float
    user_agent: str
    log_level: str


def read_settings(environ: Mapping[str, str]) -> Settings:
    """Reads the settings from environment variables, with the default of each one that is missing."""
    contact = environ.get("PRICE_CONTACT", DEFAULT_CONTACT)
    return Settings(
        output=Path(environ.get("PRICE_OUTPUT_DIR", "/srv/prices")),
        namespace_map=Path(environ.get("PRICE_NAMESPACE_MAP", "/app/namespaceMap.json")),
        interval_seconds=float(environ.get("PRICE_INTERVAL_MINUTES", "60")) * 60,
        delay_seconds=float(environ.get("PRICE_REQUEST_DELAY_SECONDS", "1")),
        user_agent=f"kalandra-price-service/1 (+{contact})",
        log_level=environ.get("PRICE_LOG_LEVEL", "INFO"),
    )


def main(
    argv: Sequence[str] | None = None,
    environ: Mapping[str, str] = os.environ,
    *,
    get: HttpGet = urllib_get,
    sleep: Callable[[float], None] = time.sleep,
    clock: Callable[[], float] = time.monotonic,
) -> None:
    """Reads the arguments and the environment, then runs one cycle with --once or a cycle per interval."""
    parser = argparse.ArgumentParser(prog="price_service", description=__doc__)
    parser.add_argument("--once", action="store_true", help="run one cycle and exit")
    args = parser.parse_args(argv)
    settings = read_settings(environ)

    logging.basicConfig(level=settings.log_level, format="%(asctime)s %(levelname)s %(message)s")
    categories = load_categories(settings.namespace_map.read_text("utf-8"))
    client = NinjaClient(get, user_agent=settings.user_agent, delay_seconds=settings.delay_seconds, sleep=sleep)

    settings.output.mkdir(parents=True, exist_ok=True)
    run_schedule(
        lambda: run_cycle(client, categories, settings.output),
        settings.interval_seconds,
        once=args.once,
        sleep=sleep,
        clock=clock,
    )


if __name__ == "__main__":
    main()
