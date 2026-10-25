import copy
from typing import Literal

from models.json_value import Json

type RarityFilter = dict[str, dict[str, dict[str, dict[str, str]]]]
type SearchPayload = dict[str, dict[str, Json]]

UNIQUE_FILTER: RarityFilter = {
    "type_filters": {"filters": {"rarity": {"option": "unique"}}}
}
NONUNIQUE_FILTER: RarityFilter = {
    "type_filters": {"filters": {"rarity": {"option": "nonunique"}}}
}
BASE_PAYLOAD: SearchPayload = {
    "query": {
        "status": {"option": "any"},
        "stats": [{"type": "and", "filters": []}],
    },
    "sort": {"price": "asc"},
}


class ItemImage:
    def __init__(
        self,
        name: str,
        namespace: Literal["UNIQUE", "ITEM", "GEM"],
        unique: dict[str, str] | None = None,
    ) -> None:
        self.name = name
        self.namespace = namespace
        if namespace == "UNIQUE":
            base = unique.get("base") if unique else None
            if base is None:
                raise ValueError(f"unique item {name} has no base type")
            self.base = base
        else:
            self.base = name

    def __str__(self) -> str:
        return f"{self.name} ({self.namespace})"

    def __repr__(self) -> str:
        return f"{self.name} ({self.namespace})"

    def __eq__(self, other: object) -> bool:
        if not isinstance(other, ItemImage):
            return False
        return self.name == other.name and self.namespace == other.namespace

    def __hash__(self) -> int:
        return hash((self.name, self.namespace))

    def search_payload(self) -> SearchPayload:
        payload = copy.deepcopy(BASE_PAYLOAD)
        if self.namespace == "UNIQUE":
            payload["query"]["filters"] = UNIQUE_FILTER
            payload["query"]["type"] = self.base
            payload["query"]["name"] = self.name
        else:
            payload["query"]["filters"] = NONUNIQUE_FILTER
            payload["query"]["type"] = self.name
        return payload

    def save_name(self) -> str:
        return f"{self.namespace}={self.name}"
