import pandas as pd

from constants.filenames import EXPEDITION_FACTIONS
from constants.lang import ENGLISH, LANG
from stores.game_store import GameStore


class LogbookFactions:
    def __init__(self, lang: LANG) -> None:
        self.lang: LANG = lang
        self.game_store: GameStore = GameStore(lang)
        self.ref_game_store: GameStore = GameStore(ENGLISH)

    def create_ref_string(self, name: str) -> str:
        return f"Has Logbook Faction: {name}"

    def create_matcher(self, name: str) -> list[dict[str, str]]:
        return [{"string": name}]

    def create_id(self, name: str) -> str:
        return name.lower().replace(" ", "_")

    def get_out_factions(self) -> pd.DataFrame:
        expedition_factions = self.game_store.get(EXPEDITION_FACTIONS).drop(
            columns=["_index", "Id"]
        )
        ref_expedition_factions = self.ref_game_store.get(EXPEDITION_FACTIONS)

        expedition_factions["ref"] = ref_expedition_factions["Name"].apply(
            self.create_ref_string
        )
        expedition_factions["better"] = 0
        expedition_factions["matchers"] = expedition_factions["Name"].apply(
            self.create_matcher
        )
        expedition_factions["id"] = ref_expedition_factions["Name"].apply(
            self.create_id
        )
        expedition_factions["trade"] = pd.Series(
            [{"ids": None} for _ in expedition_factions.index],
            index=expedition_factions.index,
            dtype=object,
        )
        expedition_factions.drop(columns=["Name"], inplace=True)
        return expedition_factions
