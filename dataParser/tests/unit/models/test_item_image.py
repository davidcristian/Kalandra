import pytest

from models.item_image import NONUNIQUE_FILTER, UNIQUE_FILTER, ItemImage


@pytest.mark.parametrize("unique", [None, {}, {"base": None}])
def test_unique_item_without_a_base_type_raises(unique: dict[str, str] | None) -> None:
    with pytest.raises(ValueError, match="Headhunter"):
        ItemImage("Headhunter", "UNIQUE", unique)


def test_unique_item_searches_by_name_and_base_type() -> None:
    query = ItemImage("Headhunter", "UNIQUE", {"base": "Heavy Belt"}).search_payload()[
        "query"
    ]

    assert query["filters"] == UNIQUE_FILTER
    assert query["type"] == "Heavy Belt"
    assert query["name"] == "Headhunter"


def test_other_item_searches_by_its_name() -> None:
    query = ItemImage("Heavy Belt", "ITEM").search_payload()["query"]

    assert query["filters"] == NONUNIQUE_FILTER
    assert query["type"] == "Heavy Belt"
    assert "name" not in query
