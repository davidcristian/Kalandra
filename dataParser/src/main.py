import argparse
import json
import logging
import os
import shutil

import pandas as pd
from pandas.api.types import is_scalar
from tqdm import tqdm

from constants.client_string_data import (
    CLIENT_STRING_ARRAYS,
    CLIENT_STRING_KEY_VALUES,
    CLIENT_STRING_REGEX,
)
from constants.lang import ENGLISH, LANG, LANGUAGES
from providers.game_api import GameDataProvider
from providers.trade_api import TradeApiProvider, create_trade_session
from services.client_strings_builder import ClientStringsBuilder
from services.image_provider import DEFAULT_LEAGUE, MODE, backup_cache
from services.nd_builder_service import NdBuilderService
from services.request_pacer import RequestPacer

logger = logging.getLogger(__name__)


def write_ndjson(df: pd.DataFrame, path: str) -> None:
    """Writes one JSON object per row, without the row's missing values."""
    rows = df.where(df.notna(), None)
    with open(path, "w", encoding="utf-8") as f:
        for _, row in rows.iterrows():
            # pandas 3 keeps NaN rather than None in a string column
            obj = {k: v for k, v in row.items() if not (is_scalar(v) and pd.isna(v))}
            f.write(f"{json.dumps(obj, ensure_ascii=False, allow_nan=False)}\n")


def write_text(path: str, text: str) -> None:
    """Writes text to path as UTF-8, and logs the path before it raises a failed write again."""
    try:
        with open(path, "w", encoding="utf-8") as f:
            _ = f.write(text)
    except (OSError, UnicodeEncodeError) as error:
        logger.error(f"Failed to write {path}: {error}")
        raise


def pull_inputs(
    game_data: GameDataProvider, pacer: RequestPacer, json_dir: str | None = None
) -> None:
    """Runs the game export, then pulls the trade data of every language into json_dir/<lang>."""
    game_data.run_export()
    for lang in tqdm(LANGUAGES):
        lang_dir = None if json_dir is None else os.path.join(json_dir, lang)
        TradeApiProvider(lang, pacer, lang_dir).pull()


def main(
    pull: bool = False,
    image_mode: MODE = "noLookup",
    push: bool = False,
    main_repo_path: str = "..",
    output_dir: str = "output",
    image_cache_dir: str | None = None,
    league: str = DEFAULT_LEAGUE,
) -> None:
    """Builds the three files of every language into output_dir/<lang>."""
    if pull:
        # One pacer for every language, so the pause also holds from one language to the next
        pull_inputs(GameDataProvider(), RequestPacer(create_trade_session()))

    # Once per run, since every language's build saves the cache that the English build changed
    backup_cache(image_cache_dir)
    run_on: list[LANG] = [ENGLISH, *[lang for lang in LANGUAGES if lang != ENGLISH]]

    for index, lang in enumerate(run_on):
        logger.info(
            "================================================================================"
        )
        logger.info(f"Building {lang}: {index + 1}/{len(LANGUAGES)}")
        logger.info(
            "================================================================================"
        )
        nd = NdBuilderService(
            lang,
            image_mode if lang is ENGLISH else "noLookup",
            image_cache_dir,
            league,
        )
        lang_dir = os.path.join(output_dir, lang)
        os.makedirs(lang_dir, exist_ok=True)

        write_ndjson(nd.build_stats_ndjson(), os.path.join(lang_dir, "stats.ndjson"))
        write_ndjson(nd.build_items_ndjson(), os.path.join(lang_dir, "items.ndjson"))

        client_strings_builder = ClientStringsBuilder(lang)
        client_strings_js = client_strings_builder.build(
            base_strings=CLIENT_STRING_KEY_VALUES,
            array_strings=CLIENT_STRING_ARRAYS,
            regex_strings=CLIENT_STRING_REGEX,
        )
        write_text(os.path.join(lang_dir, "client_strings.js"), client_strings_js)

        if push:
            logger.info("Copying files to renderer/public/data")
            for name in ("stats.ndjson", "items.ndjson", "client_strings.js"):
                _ = shutil.copy(
                    os.path.join(lang_dir, name),
                    f"{main_repo_path}/renderer/public/data/{lang}/{name}",
                )


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    _ = parser.add_argument("--pull", action="store_true", help="Pull trade data")
    _ = parser.add_argument(
        "--log", default="info", help="Log level (debug, info, warn, error)"
    )
    _ = parser.add_argument(
        "--image-mode",
        default="noLookup",
        choices=["noLookup", "missing", "new", "all"],
        help="Image mode (noLookup, missing, new, all)",
    )
    _ = parser.add_argument(
        "--league",
        default=DEFAULT_LEAGUE,
        help=f"Trade league the image lookups search (default: {DEFAULT_LEAGUE})",
    )
    _ = parser.add_argument(
        "--push",
        action="store_true",
        help="Copy output to renderer/public/data",
    )
    _ = parser.add_argument(
        "--main-repo-path",
        default="..",
        help="Path to the repo root",
    )

    args = vars(parser.parse_args())

    # Only here, so importing a module sets no handler and no level
    logging.basicConfig(
        level=args.pop("log").upper(),
        format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    )
    main(**args)
