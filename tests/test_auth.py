import json
import stat

import httpx
import pytest

from yahoo_fantasy_mcp.auth import TOKEN_URL, TokenStore, YahooAuth


def test_exchange_code_posts_form_and_saves_token(tmp_path):
    seen = {}

    def handler(request):
        seen["request"] = request
        return httpx.Response(200, json={"access_token": "access", "refresh_token": "refresh", "expires_in": 3600, "token_type": "bearer"})

    store = TokenStore(tmp_path / "token.json")
    auth = YahooAuth("id", "secret", store, httpx.Client(transport=httpx.MockTransport(handler)), now=lambda: 1000.0)
    result = auth.exchange_code("code-value")
    request = seen["request"]
    assert str(request.url) == TOKEN_URL
    assert dict(httpx.QueryParams(request.content.decode())) == {
        "client_id": "id", "client_secret": "secret", "redirect_uri": "oob",
        "code": "code-value", "grant_type": "authorization_code",
    }
    assert request.headers["content-type"] == "application/x-www-form-urlencoded"
    assert result == {"access_token": "access", "refresh_token": "refresh", "expires_at": 4600.0, "token_type": "bearer"}
    assert store.load() == result


def test_access_token_returns_fresh_stored_token(tmp_path):
    store = TokenStore(tmp_path / "token.json")
    store.save({"access_token": "fresh", "refresh_token": "r", "expires_at": 2000.0, "token_type": "bearer"})
    auth = YahooAuth("id", "secret", store, now=lambda: 1000.0)
    assert auth.access_token() == "fresh"


def test_access_token_refreshes_near_expiry_and_persists(tmp_path):
    store = TokenStore(tmp_path / "token.json")
    store.save({"access_token": "old", "refresh_token": "refresh", "expires_at": 1060.0, "token_type": "bearer"})

    def handler(request):
        form = dict(httpx.QueryParams(request.content.decode()))
        assert form["refresh_token"] == "refresh"
        assert form["grant_type"] == "refresh_token"
        return httpx.Response(200, json={"access_token": "new", "refresh_token": "new-refresh", "expires_in": 3600, "token_type": "bearer"})

    auth = YahooAuth("id", "secret", store, httpx.Client(transport=httpx.MockTransport(handler)), now=lambda: 1000.0)
    assert auth.access_token() == "new"
    assert store.load()["refresh_token"] == "new-refresh"
    assert store.load()["expires_at"] == 4600.0


def test_missing_token_raises(tmp_path):
    auth = YahooAuth("id", "secret", TokenStore(tmp_path / "missing.json"))
    with pytest.raises(RuntimeError, match="Not authenticated"):
        auth.access_token()


def test_token_file_mode_is_0600(tmp_path):
    store = TokenStore(tmp_path / "token.json")
    store.save({"access_token": "a"})
    assert stat.S_IMODE(store.path.stat().st_mode) == 0o600
