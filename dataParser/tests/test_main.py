import json
from unittest.mock import patch

import pandas as pd
import pytest

from main import main, write_ndjson


def test_main_does_not_throw():
    main()


def test_main_pulls():
    with (
        patch("providers.trade_api.TradeApiProvider.pull") as mock_trade_pull,
        patch("providers.game_api.GameDataProvider.run_export") as mock_game_pull,
    ):
        main(pull=True)

        mock_trade_pull.assert_called()
        mock_game_pull.assert_called_once()


def test_write_ndjson_leaves_out_the_missing_values_of_a_string_column(tmp_path):
    df = pd.DataFrame(
        [
            {"ref": "a", "id": None, "matchers": [{"string": "a"}], "better": 1},
            {"ref": "b", "id": "b_id", "matchers": [], "better": -1},
        ]
    )
    path = tmp_path / "stats.ndjson"

    write_ndjson(df, str(path))

    lines = path.read_text(encoding="utf-8").splitlines()
    assert [json.loads(line) for line in lines] == [
        {"ref": "a", "matchers": [{"string": "a"}], "better": 1},
        {"ref": "b", "id": "b_id", "matchers": [], "better": -1},
    ]
    assert "NaN" not in path.read_text(encoding="utf-8")


def test_write_ndjson_raises_on_a_nan_inside_a_value(tmp_path):
    df = pd.DataFrame(
        [{"ref": "a", "matchers": [{"string": "a", "value": float("nan")}]}]
    )

    with pytest.raises(ValueError, match="JSON"):
        write_ndjson(df, str(tmp_path / "stats.ndjson"))
