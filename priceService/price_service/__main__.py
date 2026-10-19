"""Runs the price service: one cycle, then one per interval, until stopped."""

import argparse
import logging
import math
import os
import time
from collections.abc import Callable, Mapping, Sequence
from dataclasses import dataclass
from pathlib import Path

from .ninja import HttpGet, NinjaClient, urllib_get
from .service import run_cycle, run_schedule
from .transform import load_categories

DEFAULT_CONTACT = "https://github.com/davidcristian/Kalandra/issues"


class SettingsError(ValueError):
    """An environment variable has a value the service cannot run with."""


@dataclass(frozen=True)
class Settings:
    """The values the service reads from its environment variables."""

    output: Path
    namespace_map: Path
    interval_seconds: float
    delay_seconds: float
    user_agent: str
    log_level: str


def read_number(environ: Mapping[str, str], name: str, default: str, *, zero_allowed: bool) -> float:
    """Reads a finite number from an environment variable that must be above 0, or 0 too with zero_allowed."""
    text = environ.get(name, default)
    msg = f"{name} must be {'a number of 0 or more' if zero_allowed else 'a number above 0'}, not {text!r}"
    try:
        value = float(text)
    except ValueError as error:
        raise SettingsError(msg) from error
    # A zero, negative or NaN interval makes each wait between cycles 0, and sleep raises on an infinite number
    if not math.isfinite(value) or value < 0 or (value == 0 and not zero_allowed):
        raise SettingsError(msg)
    return value


def read_settings(environ: Mapping[str, str]) -> Settings:
    """Reads the settings from environment variables, with the default of each one that is missing."""
    contact = environ.get("PRICE_CONTACT", DEFAULT_CONTACT)
    return Settings(
        output=Path(environ.get("PRICE_OUTPUT_DIR", "/srv/prices")),
        namespace_map=Path(environ.get("PRICE_NAMESPACE_MAP", "/app/namespaceMap.json")),
        interval_seconds=read_number(environ, "PRICE_INTERVAL_MINUTES", "60", zero_allowed=False) * 60,
        delay_seconds=read_number(environ, "PRICE_REQUEST_DELAY_SECONDS", "1", zero_allowed=True),
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
