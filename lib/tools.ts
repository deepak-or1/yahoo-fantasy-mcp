import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";

import { userIdFromAuth } from "@/lib/session";
import { paths, yahooGet } from "@/lib/yahoo";

type ToolContext = Parameters<Parameters<McpServer["registerTool"]>[2]>[1];

async function result(ctx: ToolContext, path: string) {
  try {
    const userId = userIdFromAuth(ctx.http?.authInfo);
    const value = await yahooGet(userId, path);
    return { content: [{ type: "text" as const, text: JSON.stringify(value, null, 1) }] };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      isError: true,
      content: [{ type: "text" as const, text: message }],
    };
  }
}

const leagueKey = z.string().describe("League key like `449.l.12345`.");
const teamKey = z.string().describe("Team key like `449.l.12345.t.3`.");
const playerKey = z.string().describe("Player key like `449.p.30123`.");

export function registerTools(server: McpServer): void {
  server.registerTool(
    "list_my_leagues",
    {
      title: "List My Leagues",
      description:
        "Return your leagues for a sport and optional season; game keys look like `449` (2025 NFL), and league keys like `449.l.12345`.",
      inputSchema: z.object({
        sport: z.string().default("nfl"),
        season: z.number().int().optional(),
      }),
      annotations: { readOnlyHint: true },
    },
    async ({ sport, season }, ctx) => result(ctx, paths.listMyLeagues(sport, season)),
  );

  server.registerTool(
    "list_my_teams",
    {
      title: "List My Teams",
      description:
        "Return your teams for a sport and optional season; team keys look like `449.l.12345.t.3` and game keys like `449`.",
      inputSchema: z.object({
        sport: z.string().default("nfl"),
        season: z.number().int().optional(),
      }),
      annotations: { readOnlyHint: true },
    },
    async ({ sport, season }, ctx) => result(ctx, paths.listMyTeams(sport, season)),
  );

  server.registerTool(
    "get_league_settings",
    {
      title: "Get League Settings",
      description:
        "Return settings for a league whose key looks like `449.l.12345` (game key `449` is 2025 NFL).",
      inputSchema: z.object({ league_key: leagueKey }),
      annotations: { readOnlyHint: true },
    },
    async ({ league_key }, ctx) => result(ctx, paths.leagueSettings(league_key)),
  );

  server.registerTool(
    "get_standings",
    {
      title: "Get Standings",
      description: "Return standings for a league whose key looks like `449.l.12345`.",
      inputSchema: z.object({ league_key: leagueKey }),
      annotations: { readOnlyHint: true },
    },
    async ({ league_key }, ctx) => result(ctx, paths.standings(league_key)),
  );

  server.registerTool(
    "get_scoreboard",
    {
      title: "Get Scoreboard",
      description:
        "Return the scoreboard for an optional week in a league such as `449.l.12345`.",
      inputSchema: z.object({ league_key: leagueKey, week: z.number().int().optional() }),
      annotations: { readOnlyHint: true },
    },
    async ({ league_key, week }, ctx) => result(ctx, paths.scoreboard(league_key, week)),
  );

  server.registerTool(
    "get_teams",
    {
      title: "Get Teams",
      description:
        "Return all teams in a league such as `449.l.12345`; team keys look like `449.l.12345.t.3`.",
      inputSchema: z.object({ league_key: leagueKey }),
      annotations: { readOnlyHint: true },
    },
    async ({ league_key }, ctx) => result(ctx, paths.teams(league_key)),
  );

  server.registerTool(
    "get_roster",
    {
      title: "Get Roster",
      description:
        "Return roster players for an optional week; a team key looks like `449.l.12345.t.3` and player key like `449.p.30123`.",
      inputSchema: z.object({ team_key: teamKey, week: z.number().int().optional() }),
      annotations: { readOnlyHint: true },
    },
    async ({ team_key, week }, ctx) => result(ctx, paths.roster(team_key, week)),
  );

  server.registerTool(
    "get_matchups",
    {
      title: "Get Matchups",
      description:
        "Return matchups, optionally for comma-separated weeks like `1,2,3`, for a team key such as `449.l.12345.t.3`.",
      inputSchema: z.object({
        team_key: teamKey,
        weeks: z.string().optional().describe("Comma-separated weeks like `1,2,3`."),
      }),
      annotations: { readOnlyHint: true },
    },
    async ({ team_key, weeks }, ctx) => result(ctx, paths.matchups(team_key, weeks)),
  );

  server.registerTool(
    "get_free_agents",
    {
      title: "Get Free Agents",
      description:
        "Return players in league `449.l.12345`; status values are A (available), FA (free agent), W (waivers), T (taken), K (keepers), and sort values are AR (actual rank), OR (overall rank), PTS (fantasy points), NAME; player keys look like `449.p.30123`.",
      inputSchema: z.object({
        league_key: leagueKey,
        position: z.string().optional(),
        status: z.string().default("FA"),
        sort: z.string().default("AR"),
        count: z.number().int().default(25),
        start: z.number().int().default(0),
      }),
      annotations: { readOnlyHint: true },
    },
    async ({ league_key, position, status, sort, count, start }, ctx) =>
      result(ctx, paths.freeAgents(league_key, { position, status, sort, count, start })),
  );

  server.registerTool(
    "search_players",
    {
      title: "Search Players",
      description:
        "Return players matching a name in a league such as `449.l.12345`; returned player keys look like `449.p.30123`.",
      inputSchema: z.object({ league_key: leagueKey, name: z.string() }),
      annotations: { readOnlyHint: true },
    },
    async ({ league_key, name }, ctx) => result(ctx, paths.searchPlayers(league_key, name)),
  );

  server.registerTool(
    "get_player_stats",
    {
      title: "Get Player Stats",
      description:
        "Return season or weekly stats for player `449.p.30123` in league `449.l.12345`.",
      inputSchema: z.object({
        league_key: leagueKey,
        player_key: playerKey,
        week: z.number().int().optional(),
      }),
      annotations: { readOnlyHint: true },
    },
    async ({ league_key, player_key, week }, ctx) =>
      result(ctx, paths.playerStats(league_key, player_key, week)),
  );

  server.registerTool(
    "get_transactions",
    {
      title: "Get Transactions",
      description:
        "Return transactions for league `449.l.12345`, optionally filtering comma-separated add, drop, trade, or commish types.",
      inputSchema: z.object({
        league_key: leagueKey,
        count: z.number().int().default(25),
        types: z.string().optional().describe("Comma-separated add, drop, trade, or commish types."),
      }),
      annotations: { readOnlyHint: true },
    },
    async ({ league_key, count, types }, ctx) =>
      result(ctx, paths.transactions(league_key, count, types)),
  );

  server.registerTool(
    "get_draft_results",
    {
      title: "Get Draft Results",
      description:
        "Return draft results for a league key such as `449.l.12345`, including team keys like `449.l.12345.t.3`.",
      inputSchema: z.object({ league_key: leagueKey }),
      annotations: { readOnlyHint: true },
    },
    async ({ league_key }, ctx) => result(ctx, paths.draftResults(league_key)),
  );

  server.registerTool(
    "yahoo_get",
    {
      title: "Yahoo Get",
      description:
        "Return any Yahoo Fantasy v2 resource path, e.g. `league/449.l.12345/players;player_keys=449.p.30123/ownership`.",
      inputSchema: z.object({
        path: z.string().describe("Yahoo Fantasy v2 resource path."),
      }),
      annotations: { readOnlyHint: true },
    },
    async ({ path }, ctx) => result(ctx, path),
  );
}
