"""HTTP client for Yahoo Fantasy Sports API v2."""

from __future__ import annotations

import httpx

from .auth import YahooAuth
from .flatten import flatten

BASE_URL = "https://fantasysports.yahooapis.com/fantasy/v2/"
WRAPPER_KEYS = {"xml:lang", "yahoo:uri", "time", "copyright", "refresh_rate"}


class YahooFantasyClient:
    """Authenticated synchronous Yahoo Fantasy API client."""

    def __init__(self, auth: YahooAuth, http: httpx.Client | None = None) -> None:
        self.auth = auth
        self.http = http or httpx.Client()

    def get(self, path: str) -> dict:
        separator = "&" if "?" in path else "?"
        url = f"{BASE_URL}{path}{separator}format=json"
        token = self.auth.access_token()
        response = self.http.get(url, headers={"Authorization": f"Bearer {token}"}, timeout=30)
        if response.status_code == 401:
            token = self.auth.refresh()["access_token"]
            response = self.http.get(url, headers={"Authorization": f"Bearer {token}"}, timeout=30)
        if not response.is_success:
            raise RuntimeError(f"Yahoo API {response.status_code} for {path}: {response.text[:300]}")
        content = flatten(response.json())["fantasy_content"]
        for key in WRAPPER_KEYS:
            content.pop(key, None)
        return content
