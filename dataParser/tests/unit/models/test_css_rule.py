import pandas as pd

from models.css_rule import CssRule

SELECTOR = '[data-field="stat.explicit.stat_{0}"]'
STATS = pd.DataFrame(
    [
        {
            "ref": "# to maximum Life",
            "hash": 3299347043,
            "Tags": ["life"],
            "id": "explicit.stat_3299347043",
        },
        {
            "ref": "# to maximum Mana",
            "hash": 1050105434,
            "Tags": ["mana"],
            "id": "explicit.stat_1050105434",
        },
        {
            "ref": "# Life Regeneration per second",
            "hash": 3325883026,
            "Tags": ["life"],
            "id": "explicit.stat_3325883026",
        },
    ]
)


def has_tag(tag: str) -> CssRule:
    return CssRule(
        "color: red;",
        SELECTOR,
        lambda ref, hash, tags, id: tag in tags,
        f"All {tag} stats",
        disableSelector="hideTagged",
    )


def test_apply_writes_the_selector_of_each_matching_stat_before_the_css() -> None:
    assert has_tag("life").apply(STATS).splitlines() == [
        "if hideTagged {",
        "/* All life stats */",
        '[data-field="stat.explicit.stat_3299347043"], ',
        '[data-field="stat.explicit.stat_3325883026"]{',
        "/* All life stats */",
        "color: red;",
        "}",
        "}",
    ]


def test_apply_writes_only_a_comment_for_a_rule_that_matches_no_stat() -> None:
    assert has_tag("minion").apply(STATS) == "/* All minion stats: matches no stat */"
