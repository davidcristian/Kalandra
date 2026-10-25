"""The type of a value that json.dumps writes as JSON."""

from collections.abc import Mapping, Sequence

type Json = None | bool | int | float | str | Sequence[Json] | Mapping[str, Json]
