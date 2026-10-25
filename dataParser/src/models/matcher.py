"""The type of one matcher of a stat in stats.ndjson."""

from typing import NotRequired, TypedDict


class Matcher(TypedDict):
    """A text the parser matches a mod line against, and the value and sign it gives."""

    string: str
    value: NotRequired[int]
    negate: NotRequired[bool]
    oils: NotRequired[str]
