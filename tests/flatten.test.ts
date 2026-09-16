import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { flatten } from "@/lib/flatten";

function fixture(name: string): unknown {
  return JSON.parse(readFileSync(join(__dirname, name), "utf8"));
}

describe("flatten", () => {
  it("flattens the standings fixture exactly", () => {
    expect(flatten(fixture("standings.json"))).toEqual({
      fantasy_content: {
        "xml:lang": "en-US",
        "yahoo:uri": "/fantasy/v2/league/449.l.12345/standings",
        league: {
          league_key: "449.l.12345",
          league_id: "12345",
          name: "The League",
          num_teams: 10,
          current_week: 2,
          scoring_type: "head",
          standings: {
            teams: [
              {
                team_key: "449.l.12345.t.1",
                team_id: "1",
                name: "Deepak's Team",
                managers: { manager: { manager_id: "1", nickname: "Deepak" } },
                team_points: { coverage_type: "season", season: "2025", total: "142.50" },
                team_standings: {
                  rank: 1,
                  outcome_totals: { wins: "1", losses: "0", ties: 0, percentage: "1.000" },
                },
              },
              {
                team_key: "449.l.12345.t.2",
                team_id: "2",
                name: "Anshul's Team",
                managers: [
                  { manager_id: "2", nickname: "Anshul" },
                  { manager_id: "3", nickname: "Co-manager" },
                ],
                team_points: { coverage_type: "season", season: "2025", total: "120.10" },
                team_standings: {
                  rank: 2,
                  outcome_totals: { wins: "0", losses: "1", ties: 0, percentage: ".000" },
                },
              },
            ],
          },
        },
      },
      time: "30.5ms",
      copyright: "Data provided by Yahoo! and STATS, LLC",
      refresh_rate: "60",
    });
  });

  it("flattens the players fixture", () => {
    const flattened = flatten(fixture("players.json")) as {
      fantasy_content: { league: { players: Array<Record<string, any>> } };
    };
    const players = flattened.fantasy_content.league.players;
    expect(players).toHaveLength(2);
    expect(players[0].eligible_positions).toEqual(["WR", "W/R/T"]);
    expect(players[1].eligible_positions).toEqual(["WR", "W/R/T"]);
    expect(players.map((player) => player.name.full)).toEqual(["Alpha Receiver", "Beta Receiver"]);
  });

  it("R1 orders numeric keys", () => {
    expect(flatten({ "1": "second", "0": "first", count: 2 })).toEqual(["first", "second"]);
  });

  it("R2 merges disjoint objects after dropping empty values", () => {
    expect(flatten([{ a: 1 }, [], {}, "", null, { b: 2 }])).toEqual({ a: 1, b: 2 });
  });

  it("R2 keeps collisions as an array", () => {
    expect(flatten([{ a: 1 }, { a: 2, b: 3 }])).toEqual([{ a: 1 }, { a: 2, b: 3 }]);
  });

  it("R3 unwraps repeated single-key objects", () => {
    expect(flatten([{ position: "WR" }, { position: "W/R/T" }])).toEqual(["WR", "W/R/T"]);
  });
});
