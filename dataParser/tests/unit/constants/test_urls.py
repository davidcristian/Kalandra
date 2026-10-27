import re
from pathlib import Path
from urllib.parse import urlparse

from constants.lang import LANGUAGES
from constants.urls import LANG_URLS

TRADE_HOST = Path(__file__).parents[4] / "renderer" / "src" / "web" / "trade-host.ts"


def app_trade_hosts() -> dict[str, set[str]]:
    """Returns the hosts that tradeHost() in the app returns for each language."""
    text = TRADE_HOST.read_text(encoding="utf-8")
    cases = re.findall(r'case "([\w-]+)":\s*return ([^;]+);', text)
    return {
        lang: set(re.findall(r'"([\w-]+(?:\.[\w-]+)+)"', expression))
        for lang, expression in cases
    }


def test_the_trade_data_of_each_language_comes_from_a_host_the_app_uses():
    hosts = app_trade_hosts()

    assert hosts.keys() == LANGUAGES
    assert {
        lang: urlparse(url).hostname
        for lang, url in LANG_URLS.items()
        if urlparse(url).hostname not in hosts[lang]
    } == {}
