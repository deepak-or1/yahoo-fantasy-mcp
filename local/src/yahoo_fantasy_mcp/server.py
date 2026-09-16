"""MCP tools for reading Yahoo Fantasy Sports data."""

from __future__ import annotations

import json
from urllib.parse import quote

from mcp.server.mcpserver import MCPServer

from .auth import TokenStore, YahooAuth, load_credentials
from .client import YahooFantasyClient

server = MCPServer(
    "yahoo-fantasy",
    instructions=(
        "Call list_my_leagues first to learn the user's league key, then use "
        "that league key with the other Yahoo Fantasy tools."
    ),
)

_client_instance: YahooFantasyClient | None = None


def _client() -> YahooFantasyClient:
    """Build the shared client only on its first use."""
    global _client_instance
    if _client_instance is None:
        credentials = load_credentials()
        if credentials is None:
            raise RuntimeError("Missing Yahoo credentials. Run: yahoo-fantasy-mcp auth")
        _client_instance = YahooFantasyClient(YahooAuth(*credentials, store=TokenStore()))
    return _client_instance


def _result(path: str) -> str:
    return json.dumps(_client().get(path), indent=1)


@server.tool()
def list_my_leagues(sport: str = "nfl", season: int | None = None) -> str:
    """Return your leagues for a sport and optional season; game keys look like `449` (2025 NFL), and league keys like `449.l.12345`."""
    path = f"users;use_login=1/games;game_codes={sport}"
    if season is not None:
        path += f";seasons={season}"
    return _result(path + "/leagues")


@server.tool()
def list_my_teams(sport: str = "nfl", season: int | None = None) -> str:
    """Return your teams for a sport and optional season; team keys look like `449.l.12345.t.3` and game keys like `449`."""
    path = f"users;use_login=1/games;game_codes={sport}"
    if season is not None:
        path += f";seasons={season}"
    return _result(path + "/teams")


@server.tool()
def get_league_settings(league_key: str) -> str:
    """Return settings for a league whose key looks like `449.l.12345` (game key `449` is 2025 NFL)."""
    return _result(f"league/{league_key}/settings")


@server.tool()
def get_standings(league_key: str) -> str:
    """Return standings for a league whose key looks like `449.l.12345`."""
    return _result(f"league/{league_key}/standings")


@server.tool()
def get_scoreboard(league_key: str, week: int | None = None) -> str:
    """Return the scoreboard for an optional week in a league such as `449.l.12345`."""
    path = f"league/{league_key}/scoreboard"
    if week is not None:
        path += f";week={week}"
    return _result(path)


@server.tool()
def get_teams(league_key: str) -> str:
    """Return all teams in a league such as `449.l.12345`; team keys look like `449.l.12345.t.3`."""
    return _result(f"league/{league_key}/teams")


@server.tool()
def get_roster(team_key: str, week: int | None = None) -> str:
    """Return roster players for an optional week; a team key looks like `449.l.12345.t.3` and player key like `449.p.30123`."""
    path = f"team/{team_key}/roster"
    if week is not None:
        path += f";week={week}"
    return _result(path + "/players")


@server.tool()
def get_matchups(team_key: str, weeks: str | None = None) -> str:
    """Return matchups, optionally for comma-separated weeks like `1,2,3`, for a team key such as `449.l.12345.t.3`."""
    path = f"team/{team_key}/matchups"
    if weeks is not None:
        path += f";weeks={weeks}"
    return _result(path)


@server.tool()
def get_free_agents(
    league_key: str,
    position: str | None = None,
    status: str = "FA",
    sort: str = "AR",
    count: int = 25,
    start: int = 0,
) -> str:
    """Return players in league `449.l.12345`; status values are A (available), FA (free agent), W (waivers), T (taken), K (keepers), and sort values are AR (actual rank), OR (overall rank), PTS (fantasy points), NAME; player keys look like `449.p.30123`."""
    path = f"league/{league_key}/players;status={status};sort={sort};count={count};start={start}"
    if position is not None:
        path += f";position={position}"
    return _result(path)


@server.tool()
def search_players(league_key: str, name: str) -> str:
    """Return players matching a name in a league such as `449.l.12345`; returned player keys look like `449.p.30123`."""
    return _result(f"league/{league_key}/players;search={quote(name, safe='')}")


@server.tool()
def get_player_stats(league_key: str, player_key: str, week: int | None = None) -> str:
    """Return season or weekly stats for player `449.p.30123` in league `449.l.12345`."""
    path = f"league/{league_key}/players;player_keys={player_key}/stats"
    if week is not None:
        path += f";type=week;week={week}"
    return _result(path)


@server.tool()
def get_transactions(league_key: str, count: int = 25, types: str | None = None) -> str:
    """Return transactions for league `449.l.12345`, optionally filtering comma-separated add, drop, trade, or commish types."""
    path = f"league/{league_key}/transactions;count={count}"
    if types is not None:
        path += f";types={types}"
    return _result(path)


@server.tool()
def get_draft_results(league_key: str) -> str:
    """Return draft results for a league key such as `449.l.12345`, including team keys like `449.l.12345.t.3`."""
    return _result(f"league/{league_key}/draftresults")


@server.tool()
def yahoo_get(path: str) -> str:
    """Return any Yahoo Fantasy v2 resource path, e.g. `league/449.l.12345/players;player_keys=449.p.30123/ownership`."""
    return _result(path)
