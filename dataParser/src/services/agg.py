from collections.abc import Callable

import pandas as pd


def make_list_agg(
    columns_to_list: list[str] | None = None,
    columns_to_set: list[str] | None = None,
    columns_to_csv: list[str] | None = None,
) -> Callable[[pd.Series], object]:
    """Returns a function for groupby().agg that lists, sets or comma-joins the named columns and takes the first value of the others."""

    def custom_agg(col: pd.Series) -> object:
        col_name = col.name
        if columns_to_list is not None and col_name in columns_to_list:
            return list(col.dropna())
        if columns_to_set is not None and col_name in columns_to_set:
            return set(col.dropna())
        if columns_to_csv is not None and col_name in columns_to_csv:
            return ",".join(col.dropna())
        return col.iloc[0]

    return custom_agg
