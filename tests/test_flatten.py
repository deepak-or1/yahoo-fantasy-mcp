import json
from pathlib import Path

from yahoo_fantasy_mcp.flatten import flatten

FIXTURES = Path(__file__).parent / "fixtures"


def test_standings_fixture_flattens_exactly():
    sample = json.loads((FIXTURES / "standings.json").read_text())
    expected = json.loads(r'''{
      "fantasy_content": {
        "xml:lang": "en-US",
        "yahoo:uri": "/fantasy/v2/league/449.l.12345/standings",
        "league": {
          "league_key": "449.l.12345", "league_id": "12345", "name": "The League",
          "num_teams": 10, "current_week": 2, "scoring_type": "head",
          "standings": {"teams": [
            {
              "team_key": "449.l.12345.t.1", "team_id": "1", "name": "Deepak's Team",
              "managers": {"manager": {"manager_id": "1", "nickname": "Deepak"}},
              "team_points": {"coverage_type": "season", "season": "2025", "total": "142.50"},
              "team_standings": {"rank": 1, "outcome_totals": {"wins": "1", "losses": "0", "ties": 0, "percentage": "1.000"}}
            },
            {
              "team_key": "449.l.12345.t.2", "team_id": "2", "name": "Anshul's Team",
              "managers": [{"manager_id": "2", "nickname": "Anshul"}, {"manager_id": "3", "nickname": "Co-manager"}],
              "team_points": {"coverage_type": "season", "season": "2025", "total": "120.10"},
              "team_standings": {"rank": 2, "outcome_totals": {"wins": "0", "losses": "1", "ties": 0, "percentage": ".000"}}
            }
          ]}
        }
      },
      "time": "30.5ms", "copyright": "Data provided by Yahoo! and STATS, LLC", "refresh_rate": "60"
    }''')
    assert flatten(sample) == expected


def test_players_fixture():
    sample = json.loads((FIXTURES / "players.json").read_text())
    players = flatten(sample)["fantasy_content"]["league"]["players"]
    assert len(players) == 2
    assert players[0]["eligible_positions"] == ["WR", "W/R/T"]
    assert players[1]["eligible_positions"] == ["WR", "W/R/T"]
    assert [player["name"]["full"] for player in players] == ["Alpha Receiver", "Beta Receiver"]


def test_r1_orders_numeric_keys_and_ignores_count():
    assert flatten({"1": "second", "0": "first", "count": 2}) == ["first", "second"]


def test_r1_empty_collection_from_count_only():
    assert flatten({"count": 0}) == []


def test_r2_drops_empty_values_and_merges_disjoint_dicts():
    assert flatten([{"a": 1}, [], {}, "", None, {"b": 2}]) == {"a": 1, "b": 2}


def test_r2_collision_keeps_list():
    assert flatten([{"a": 1}, {"a": 2, "b": 3}]) == [{"a": 1}, {"a": 2, "b": 3}]


def test_r3_unwraps_repeated_one_key_dicts():
    assert flatten([{"position": "WR"}, {"position": "W/R/T"}]) == ["WR", "W/R/T"]
