"""Runs the price service: one cycle, then one per interval, until stopped."""

import argparse
import logging
import os
from pathlib import Path

from .ninja import NinjaClient, urllib_get
from .service import run_cycle, run_schedule
from .transform import load_categories

DEFAULT_CONTACT = "https://github.com/davidcristian/Kalandra/issues"


def main() -> None:
    parser = argparse.ArgumentParser(prog="price_service", description=__doc__)
    parser.add_argument("--once", action="store_true", help="run one cycle and exit")
    args = parser.parse_args()

    logging.basicConfig(level=os.environ.get("PRICE_LOG_LEVEL", "INFO"), format="%(asctime)s %(levelname)s %(message)s")
    output = Path(os.environ.get("PRICE_OUTPUT_DIR", "/srv/prices"))
    categories = load_categories(
        Path(os.environ.get("PRICE_NAMESPACE_MAP", "/app/namespaceMap.json")).read_text("utf-8")
    )
    interval = float(os.environ.get("PRICE_INTERVAL_MINUTES", "60")) * 60
    contact = os.environ.get("PRICE_CONTACT", DEFAULT_CONTACT)
    client = NinjaClient(
        urllib_get,
        user_agent=f"kalandra-price-service/1 (+{contact})",
        delay_seconds=float(os.environ.get("PRICE_REQUEST_DELAY_SECONDS", "1")),
    )

    output.mkdir(parents=True, exist_ok=True)
    run_schedule(lambda: run_cycle(client, categories, output), interval, once=args.once)


if __name__ == "__main__":
    main()
