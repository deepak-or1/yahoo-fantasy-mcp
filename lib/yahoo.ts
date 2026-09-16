import { flatten } from "@/lib/flatten";
import {
  getYahooAccessToken,
  refreshYahooAccessToken,
} from "@/lib/session";

export const BASE_URL = "https://fantasysports.yahooapis.com/fantasy/v2/";

const WRAPPER_KEYS = [
  "xml:lang",
  "yahoo:uri",
  "time",
  "copyright",
  "refresh_rate",
] as const;

export const paths = {
  listMyLeagues(sport: string, season?: number): string {
    let path = `users;use_login=1/games;game_codes=${sport}`;
    if (season !== undefined) path += `;seasons=${season}`;
    return `${path}/leagues`;
  },
  listMyTeams(sport: string, season?: number): string {
    let path = `users;use_login=1/games;game_codes=${sport}`;
    if (season !== undefined) path += `;seasons=${season}`;
    return `${path}/teams`;
  },
  leagueSettings(leagueKey: string): string {
    return `league/${leagueKey}/settings`;
  },
  standings(leagueKey: string): string {
    return `league/${leagueKey}/standings`;
  },
  scoreboard(leagueKey: string, week?: number): string {
    return `league/${leagueKey}/scoreboard${week === undefined ? "" : `;week=${week}`}`;
  },
  teams(leagueKey: string): string {
    return `league/${leagueKey}/teams`;
  },
  roster(teamKey: string, week?: number): string {
    return `team/${teamKey}/roster${week === undefined ? "" : `;week=${week}`}/players`;
  },
  matchups(teamKey: string, weeks?: string): string {
    return `team/${teamKey}/matchups${weeks === undefined ? "" : `;weeks=${weeks}`}`;
  },
  freeAgents(
    leagueKey: string,
    options: {
      position?: string;
      status: string;
      sort: string;
      count: number;
      start: number;
    },
  ): string {
    const { position, status, sort, count, start } = options;
    let path = `league/${leagueKey}/players;status=${status};sort=${sort};count=${count};start=${start}`;
    if (position !== undefined) path += `;position=${position}`;
    return path;
  },
  searchPlayers(leagueKey: string, name: string): string {
    return `league/${leagueKey}/players;search=${encodeURIComponent(name)}`;
  },
  playerStats(leagueKey: string, playerKey: string, week?: number): string {
    let path = `league/${leagueKey}/players;player_keys=${playerKey}/stats`;
    if (week !== undefined) path += `;type=week;week=${week}`;
    return path;
  },
  transactions(leagueKey: string, count: number, types?: string): string {
    let path = `league/${leagueKey}/transactions;count=${count}`;
    if (types !== undefined) path += `;types=${types}`;
    return path;
  },
  draftResults(leagueKey: string): string {
    return `league/${leagueKey}/draftresults`;
  },
};

export async function yahooGet(
  userId: string,
  path: string,
  fetchImpl: typeof fetch = fetch,
): Promise<Record<string, unknown>> {
  const url = `${BASE_URL}${path}${path.includes("?") ? "&" : "?"}format=json`;
  let token = await getYahooAccessToken(userId);
  let response = await fetchImpl(url, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
  });

  if (response.status === 401) {
    token = await refreshYahooAccessToken(userId);
    response = await fetchImpl(url, {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
    });
  }

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Yahoo API ${response.status} for ${path}: ${body.slice(0, 300)}`);
  }

  const normalized = flatten(await response.json());
  if (
    typeof normalized !== "object" ||
    normalized === null ||
    Array.isArray(normalized) ||
    !("fantasy_content" in normalized)
  ) {
    throw new Error("Unexpected Yahoo response shape");
  }
  const content = (normalized as Record<string, unknown>).fantasy_content;
  if (typeof content !== "object" || content === null || Array.isArray(content)) {
    throw new Error("Unexpected Yahoo response shape");
  }

  const result = content as Record<string, unknown>;
  for (const key of WRAPPER_KEYS) delete result[key];
  return result;
}
