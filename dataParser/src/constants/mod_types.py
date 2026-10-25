from typing import Literal

MOD_TYPE = Literal[
    "explicit",
    "implicit",
    "fractured",
    "enchant",
    "rune",
    "augment",
    "desecrated",
    "sanctum",
    "skill",
    "pseudo",
    "crafted",
]

EXPLICIT: MOD_TYPE = "explicit"
IMPLICIT: MOD_TYPE = "implicit"
FRACTURED: MOD_TYPE = "fractured"
ENCHANT: MOD_TYPE = "enchant"
RUNE: MOD_TYPE = "rune"
AUGMENT: MOD_TYPE = "augment"
DESECRATED: MOD_TYPE = "desecrated"
SANCTUM: MOD_TYPE = "sanctum"
SKILL: MOD_TYPE = "skill"
PSEUDO: MOD_TYPE = "pseudo"
CRAFTED: MOD_TYPE = "crafted"

MOD_TYPES: list[MOD_TYPE] = [
    EXPLICIT,
    IMPLICIT,
    FRACTURED,
    ENCHANT,
    AUGMENT,
    DESECRATED,
    SANCTUM,
    SKILL,
    PSEUDO,
    CRAFTED,
]

MOD_TYPES_SET: set[MOD_TYPE] = set(MOD_TYPES)
