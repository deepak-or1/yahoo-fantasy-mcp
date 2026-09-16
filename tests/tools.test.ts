import { McpServer } from "@modelcontextprotocol/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/session", () => ({
  getYahooAccessToken: vi.fn(),
  refreshYahooAccessToken: vi.fn(),
  userIdFromAuth: vi.fn(),
}));

import { registerTools } from "@/lib/tools";
import { paths } from "@/lib/yahoo";

describe("Yahoo paths", () => {
  it("builds the exact Python resource paths", () => {
    expect(paths.listMyLeagues("nfl")).toBe("users;use_login=1/games;game_codes=nfl/leagues");
    expect(paths.listMyLeagues("nfl", 2025)).toBe(
      "users;use_login=1/games;game_codes=nfl;seasons=2025/leagues",
    );
    expect(paths.listMyTeams("nfl")).toBe("users;use_login=1/games;game_codes=nfl/teams");
    expect(paths.listMyTeams("nfl", 2025)).toBe(
      "users;use_login=1/games;game_codes=nfl;seasons=2025/teams",
    );
    expect(paths.leagueSettings("449.l.12345")).toBe("league/449.l.12345/settings");
    expect(paths.standings("449.l.12345")).toBe("league/449.l.12345/standings");
    expect(paths.scoreboard("449.l.12345")).toBe("league/449.l.12345/scoreboard");
    expect(paths.scoreboard("449.l.12345", 2)).toBe("league/449.l.12345/scoreboard;week=2");
    expect(paths.teams("449.l.12345")).toBe("league/449.l.12345/teams");
    expect(paths.roster("449.l.12345.t.3")).toBe("team/449.l.12345.t.3/roster/players");
    expect(paths.roster("449.l.12345.t.3", 2)).toBe(
      "team/449.l.12345.t.3/roster;week=2/players",
    );
    expect(paths.matchups("449.l.12345.t.3")).toBe("team/449.l.12345.t.3/matchups");
    expect(paths.matchups("449.l.12345.t.3", "1,2,3")).toBe(
      "team/449.l.12345.t.3/matchups;weeks=1,2,3",
    );
    expect(
      paths.freeAgents("449.l.12345", {
        status: "FA",
        sort: "AR",
        count: 25,
        start: 0,
      }),
    ).toBe("league/449.l.12345/players;status=FA;sort=AR;count=25;start=0");
    expect(
      paths.freeAgents("449.l.12345", {
        position: "WR",
        status: "A",
        sort: "PTS",
        count: 10,
        start: 5,
      }),
    ).toBe("league/449.l.12345/players;status=A;sort=PTS;count=10;start=5;position=WR");
    expect(paths.searchPlayers("449.l.12345", "A/B Player")).toBe(
      "league/449.l.12345/players;search=A%2FB%20Player",
    );
    expect(paths.playerStats("449.l.12345", "449.p.30123")).toBe(
      "league/449.l.12345/players;player_keys=449.p.30123/stats",
    );
    expect(paths.playerStats("449.l.12345", "449.p.30123", 2)).toBe(
      "league/449.l.12345/players;player_keys=449.p.30123/stats;type=week;week=2",
    );
    expect(paths.transactions("449.l.12345", 25)).toBe(
      "league/449.l.12345/transactions;count=25",
    );
    expect(paths.transactions("449.l.12345", 10, "add,drop")).toBe(
      "league/449.l.12345/transactions;count=10;types=add,drop",
    );
    expect(paths.draftResults("449.l.12345")).toBe("league/449.l.12345/draftresults");
  });
});

describe("registerTools", () => {
  it("registers exactly the 14 expected tool names", () => {
    const server = new McpServer({ name: "t", version: "0" });
    const registerTool = vi.spyOn(server, "registerTool");
    registerTools(server);
    expect(registerTool.mock.calls.map(([name]) => name)).toEqual([
      "list_my_leagues",
      "list_my_teams",
      "get_league_settings",
      "get_standings",
      "get_scoreboard",
      "get_teams",
      "get_roster",
      "get_matchups",
      "get_free_agents",
      "search_players",
      "get_player_stats",
      "get_transactions",
      "get_draft_results",
      "yahoo_get",
    ]);
  });
});
