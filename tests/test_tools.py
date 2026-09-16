import json

import httpx
import pytest

import yahoo_fantasy_mcp.server as server_module
from yahoo_fantasy_mcp.client import BASE_URL, YahooFantasyClient


class StaticAuth:
    def __init__(self):
        self.refresh_calls = 0

    def access_token(self):
        return "first-token"

    def refresh(self):
        self.refresh_calls += 1
        return {"access_token": "second-token"}


@pytest.fixture
def requests(monkeypatch):
    received = []

    def handler(request):
        received.append(request)
        return httpx.Response(200, json={"fantasy_content": {"time": "1ms", "value": "ok"}})

    client = YahooFantasyClient(StaticAuth(), httpx.Client(transport=httpx.MockTransport(handler)))
    monkeypatch.setattr(server_module, "_client_instance", client)
    return received


@pytest.mark.parametrize(
    ("function", "args", "path"),
    [
        (server_module.list_my_leagues, (), "users;use_login=1/games;game_codes=nfl/leagues"),
        (server_module.list_my_teams, ("nba", 2025), "users;use_login=1/games;game_codes=nba;seasons=2025/teams"),
        (server_module.get_league_settings, ("449.l.12345",), "league/449.l.12345/settings"),
        (server_module.get_standings, ("449.l.12345",), "league/449.l.12345/standings"),
        (server_module.get_scoreboard, ("449.l.12345", 2), "league/449.l.12345/scoreboard;week=2"),
        (server_module.get_teams, ("449.l.12345",), "league/449.l.12345/teams"),
        (server_module.get_roster, ("449.l.12345.t.3", 2), "team/449.l.12345.t.3/roster;week=2/players"),
        (server_module.get_matchups, ("449.l.12345.t.3", "1,2,3"), "team/449.l.12345.t.3/matchups;weeks=1,2,3"),
        (server_module.get_free_agents, ("449.l.12345", "WR", "W", "PTS", 10, 5), "league/449.l.12345/players;status=W;sort=PTS;count=10;start=5;position=WR"),
        (server_module.search_players, ("449.l.12345", "A B/C"), "league/449.l.12345/players;search=A%20B%2FC"),
        (server_module.get_player_stats, ("449.l.12345", "449.p.30123", 2), "league/449.l.12345/players;player_keys=449.p.30123/stats;type=week;week=2"),
        (server_module.get_transactions, ("449.l.12345", 10, "add,drop"), "league/449.l.12345/transactions;count=10;types=add,drop"),
        (server_module.get_draft_results, ("449.l.12345",), "league/449.l.12345/draftresults"),
        (server_module.yahoo_get, ("league/449.l.12345/players?start=5",), "league/449.l.12345/players?start=5"),
    ],
)
def test_tool_request_urls(requests, function, args, path):
    assert json.loads(function(*args)) == {"value": "ok"}
    separator = "&" if "?" in path else "?"
    assert str(requests[-1].url) == f"{BASE_URL}{path}{separator}format=json"


def test_get_retries_once_on_401_with_refreshed_token():
    received = []

    def handler(request):
        received.append(request)
        if len(received) == 1:
            return httpx.Response(401, text="expired")
        return httpx.Response(200, json={"fantasy_content": {"xml:lang": "en-US", "league": "ok"}})

    auth = StaticAuth()
    client = YahooFantasyClient(auth, httpx.Client(transport=httpx.MockTransport(handler)))
    assert client.get("league/449.l.12345") == {"league": "ok"}
    assert auth.refresh_calls == 1
    assert len(received) == 2
    assert received[0].headers["authorization"] == "Bearer first-token"
    assert received[1].headers["authorization"] == "Bearer second-token"


def test_get_500_raises_runtime_error_with_status():
    transport = httpx.MockTransport(lambda request: httpx.Response(500, text="upstream broke"))
    client = YahooFantasyClient(StaticAuth(), httpx.Client(transport=transport))
    with pytest.raises(RuntimeError, match="Yahoo API 500"):
        client.get("league/449.l.12345")
