"""Yahoo OAuth credentials and token persistence."""

from __future__ import annotations

import json
import os
import time
from pathlib import Path
from typing import Callable
from urllib.parse import urlencode

import httpx

AUTHORIZE_URL = "https://api.login.yahoo.com/oauth2/request_auth"
TOKEN_URL = "https://api.login.yahoo.com/oauth2/get_token"


def home_dir() -> Path:
    """Return the private application configuration directory."""
    configured = os.environ.get("YAHOO_FANTASY_MCP_HOME")
    path = Path(configured).expanduser() if configured else Path.home() / ".config" / "yahoo-fantasy-mcp"
    path.mkdir(parents=True, exist_ok=True, mode=0o700)
    path.chmod(0o700)
    return path


def _write_private_json(path: Path, value: dict) -> None:
    descriptor = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
    with os.fdopen(descriptor, "w", encoding="utf-8") as handle:
        json.dump(value, handle, indent=2)
        handle.write("\n")
    path.chmod(0o600)


def load_credentials() -> tuple[str, str] | None:
    """Load client credentials, preferring the environment."""
    client_id = os.environ.get("YAHOO_CLIENT_ID")
    client_secret = os.environ.get("YAHOO_CLIENT_SECRET")
    if client_id and client_secret:
        return client_id, client_secret
    path = home_dir() / "credentials.json"
    if not path.exists():
        return None
    with path.open(encoding="utf-8") as handle:
        value = json.load(handle)
    return value["client_id"], value["client_secret"]


def save_credentials(client_id: str, client_secret: str) -> Path:
    """Persist Yahoo application credentials in the private config directory."""
    path = home_dir() / "credentials.json"
    _write_private_json(path, {"client_id": client_id, "client_secret": client_secret})
    return path


class TokenStore:
    """JSON-backed OAuth token storage."""

    def __init__(self, path: Path | None = None) -> None:
        self.path = path or home_dir() / "token.json"

    def load(self) -> dict | None:
        if not self.path.exists():
            return None
        with self.path.open(encoding="utf-8") as handle:
            return json.load(handle)

    def save(self, token: dict) -> None:
        self.path.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
        self.path.parent.chmod(0o700)
        _write_private_json(self.path, token)


class YahooAuth:
    """Perform Yahoo's out-of-band OAuth flow and refresh access tokens."""

    def __init__(
        self,
        client_id: str,
        client_secret: str,
        store: TokenStore,
        http: httpx.Client | None = None,
        now: Callable[[], float] = time.time,
    ) -> None:
        self.client_id = client_id
        self.client_secret = client_secret
        self.store = store
        self.http = http or httpx.Client()
        self.now = now

    def authorize_url(self) -> str:
        query = urlencode(
            {
                "client_id": self.client_id,
                "redirect_uri": "oob",
                "response_type": "code",
                "language": "en-us",
            }
        )
        return f"{AUTHORIZE_URL}?{query}"

    def _request_token(self, data: dict[str, str], old_refresh_token: str | None = None) -> dict:
        response = self.http.post(
            TOKEN_URL,
            data=data,
            headers={"Content-Type": "application/x-www-form-urlencoded"},
        )
        if not response.is_success:
            raise RuntimeError(f"Yahoo OAuth {response.status_code}: authentication failed")
        payload = response.json()
        token = {
            "access_token": payload["access_token"],
            "refresh_token": payload.get("refresh_token", old_refresh_token),
            "expires_at": self.now() + payload["expires_in"],
            "token_type": payload.get("token_type", "bearer"),
        }
        self.store.save(token)
        return token

    def exchange_code(self, code: str) -> dict:
        return self._request_token(
            {
                "client_id": self.client_id,
                "client_secret": self.client_secret,
                "redirect_uri": "oob",
                "code": code,
                "grant_type": "authorization_code",
            }
        )

    def refresh(self) -> dict:
        current = self.store.load()
        if not current or not current.get("refresh_token"):
            raise RuntimeError("Not authenticated. Run: yahoo-fantasy-mcp auth")
        refresh_token = current["refresh_token"]
        return self._request_token(
            {
                "client_id": self.client_id,
                "client_secret": self.client_secret,
                "redirect_uri": "oob",
                "refresh_token": refresh_token,
                "grant_type": "refresh_token",
            },
            old_refresh_token=refresh_token,
        )

    def access_token(self) -> str:
        token = self.store.load()
        if token is None:
            raise RuntimeError("Not authenticated. Run: yahoo-fantasy-mcp auth")
        if token["expires_at"] - 60 <= self.now():
            token = self.refresh()
        return token["access_token"]
