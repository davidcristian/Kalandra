import logging
from collections.abc import Callable
from typing import override

import pandas as pd

logger = logging.getLogger(__name__)


class CssRule:
    css: str
    # A selector of a stat's element on the trade site, with {0} for the stat hash
    css_selector: str
    # Takes a stat's ref, hash, tags and id, and returns whether the rule applies to the stat
    row_selector: Callable[[str, int, list[str], str], bool]

    name: str
    # The user style checkbox that turns the rule on and off, or None for a rule that is always on
    disableSelector: str | None

    def __init__(
        self,
        css: str,
        css_selector: str,
        row_selector: Callable[[str, int, list[str], str], bool],
        name: str = "",
        disableSelector: str | None = None,
    ) -> None:
        self.css = css
        self.css_selector = css_selector
        self.row_selector = row_selector
        self.name = name
        self.disableSelector = disableSelector

    def apply(self, df: pd.DataFrame) -> str:
        my_hashes: list[str] = []
        logger.debug(f"Applying {self.css} to {df.shape[0]} rows")

        for _, row in df.iterrows():
            if self.row_selector(row["ref"], row["hash"], row["Tags"], row["id"]):
                my_hashes.append(row["hash"])
                logger.debug(f"Matched {row['ref']}[{row['hash']}]")

        if not my_hashes:
            logger.warning(f"The css rule {self.name!r} matches no stat")
            return f"/* {self.name}: matches no stat */"

        out: list[str] = [f"/* {self.name} */"]
        for hash in my_hashes[:-1]:
            out.append(self.css_selector.format(hash) + ", ")

        out.append(self.css_selector.format(my_hashes[-1]) + "{")
        out.append(f"/* {self.name} */")
        out.append(self.css)
        out.append("}")
        logger.debug(f"Generated {len(out)} lines of css")

        if self.disableSelector is not None:
            out.insert(0, f"if {self.disableSelector} {{")
            out.append("}")

        return "\n".join(out)

    @override
    def __repr__(self) -> str:
        return f"CssRule(name={self.name}, css={self.css}, css_selector={self.css_selector}, row_selector={self.row_selector})"

    @override
    def __str__(self) -> str:
        return self.name
