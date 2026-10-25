import json
import logging
import os
import shutil
from typing import Any, Literal

import pandas as pd
from tqdm import tqdm

from constants.filenames import ITEM_IMAGE_CACHE, OLD_ITEM_IMAGE_CACHE
from models.item_image import ItemImage
from services.rate_limiter import RateLimiter, RateLimitError

tqdm.pandas()

MODE = Literal["noLookup", "missing", "new", "all"]

logger = logging.getLogger(__name__)

SEARCH_URL = "https://www.pathofexile.com/api/trade2/search/Fate%20of%20the%20Vaal"
SEARCH_HEADERS = {"content-type": "application/json"}
FETCH_URL = "https://www.pathofexile.com/api/trade2/fetch/"
NOT_FOUND = "%NOT_FOUND%"
# Lookups that fail in a row usually share a cause outside the items, such as a league the trade site
# no longer lists, so the run stops instead of sending a failing search for every item.
MAX_FAILED_IN_A_ROW = 5


class ImageLookupError(Exception):
    """The trade site sent a status or an icon URL that the lookup of one item cannot use."""


def get_script_dir() -> str:
    """Returns the directory where the script is located."""
    return os.path.dirname(os.path.realpath(__file__))


def backup_cache(cache_dir: str | None = None) -> None:
    """Copies the image cache to its backup file, or writes an empty backup when there is no cache."""
    folder = cache_dir or get_script_dir()
    cache_path = os.path.join(folder, ITEM_IMAGE_CACHE)
    backup_path = os.path.join(folder, OLD_ITEM_IMAGE_CACHE)
    if os.path.exists(cache_path):
        _ = shutil.copyfile(cache_path, backup_path)
    else:
        with open(backup_path, "w", encoding="utf-8") as f:
            json.dump({}, f)
    logger.info(f"Saved the image cache from before this run to {backup_path}")


class ImageProvider:
    def __init__(
        self, mode: MODE, cache_dir: str | None = None, net: RateLimiter | None = None
    ) -> None:
        self.mode: MODE = mode
        self.cache_dir: str = cache_dir or get_script_dir()
        self.net: RateLimiter = net or RateLimiter(debug=False)
        self.failed_in_a_row: int = 0

        self.cache: dict[str, str] = self.get_cache()

    def get_cache(self) -> dict[str, str]:
        cache_path = os.path.join(self.cache_dir, ITEM_IMAGE_CACHE)

        # Check if the file exists and create it if it doesn't
        if not os.path.exists(cache_path):
            with open(cache_path, "w", encoding="utf-8") as f:
                json.dump({}, f)

        # Read and return the contents of the file
        with open(cache_path, "r", encoding="utf-8") as f:
            return json.loads(f.read())

    def save_cache(
        self, cache: dict[str, str], output_file: str = ITEM_IMAGE_CACHE
    ) -> None:
        cache_path = os.path.join(self.cache_dir, output_file)
        logger.info(f"Saving cache to {cache_path}")
        with open(cache_path, "w", encoding="utf-8") as f:
            json.dump(cache, f, indent=4)

    def apply_images(self, items: pd.DataFrame) -> pd.DataFrame:
        item_images = items.copy()
        try:
            item_images["icon"] = item_images.progress_apply(self.get_image, axis=1)  # pyright: ignore[reportCallIssue] tqdm.pandas() adds progress_apply at run time
        finally:
            self.save_cache(self.cache)
        return item_images

    def get_image(self, row: pd.Series) -> str:
        item = ItemImage(row["refName"], row["namespace"], row["unique"])
        save_name = item.save_name()
        image_url = NOT_FOUND
        if self.mode == "noLookup":
            return NOT_FOUND if save_name not in self.cache else self.cache[save_name]

        if (
            self.mode == "all"
            or save_name
            not in self.cache  # mode = new (or missing and it isn't in cache)
            or (self.mode == "missing" and self.cache[save_name] == NOT_FOUND)
        ):
            image_url = self.look_up(item)
            self.cache[save_name] = image_url
        elif save_name in self.cache:
            image_url = self.cache[save_name]
        return image_url

    def look_up(self, item: ItemImage) -> str:
        """Returns the item's icon URL, or NOT_FOUND when the trade site has none or the lookup fails."""
        try:
            image_url = self.get_image_url(item)
        except ImageLookupError as error:
            self.failed_in_a_row += 1
            if self.failed_in_a_row >= MAX_FAILED_IN_A_ROW:
                raise ImageLookupError(
                    f"{self.failed_in_a_row} image lookups in a row failed, the last for {item}: {error}"
                ) from error
            logger.warning(f"Image lookup failed for {item}: {error}")
            return NOT_FOUND
        self.failed_in_a_row = 0
        return image_url if image_url is not None else NOT_FOUND

    def get_fetch_id(self, item: ItemImage) -> str | None:
        payload = item.search_payload()
        for _ in range(3):
            result = self.net.post(SEARCH_URL, payload=payload, headers=SEARCH_HEADERS)
            if result.status_code == 200:
                data = result.json()
                if data.get("result") and len(data.get("result")) > 0:
                    return data.get("result")[0]
                else:
                    return None
            elif result.status_code != 429:
                raise ImageLookupError(
                    f"search got status {result.status_code}: {result.text}"
                )
        raise RateLimitError(f"Rate limited 3 times, gave up on the search for {item}")

    def fetch_listing(self, fetch_id: str) -> dict[str, Any] | None:
        for _ in range(3):
            result = self.net.get(FETCH_URL + fetch_id)
            if result.status_code == 200:
                data = result.json()
                if data.get("result") and len(data.get("result")) > 0:
                    return data.get("result")[0]
                else:
                    return None
            elif result.status_code != 429:
                raise ImageLookupError(
                    f"fetch got status {result.status_code}: {result.text}"
                )
        raise RateLimitError(
            f"Rate limited 3 times, gave up on the fetch of {fetch_id}"
        )

    def parse_listing_for_url(self, listing: dict[str, Any]) -> str | None:
        item = listing.get("item")
        if item is None:
            return None
        icon_url = item.get("icon")
        if icon_url is None:
            return None
        if not icon_url.startswith(
            "https://web.poecdn.com/gen/image"
        ) or not icon_url.endswith(".png"):
            raise ImageLookupError(f"unexpected icon url: {icon_url}")
        return icon_url

    def get_image_url(self, item: ItemImage) -> str | None:
        fetch_id = self.get_fetch_id(item)
        if fetch_id is None:
            return None
        listing = self.fetch_listing(fetch_id)
        if listing is None:
            return None
        icon_url = self.parse_listing_for_url(listing)
        if icon_url is None:
            return None
        return icon_url
