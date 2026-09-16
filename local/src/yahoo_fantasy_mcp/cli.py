"""Command-line entry point for authentication, checks, and MCP serving."""

from __future__ import annotations

import argparse
import getpass
import json
import logging
import sys
from typing import Any, Iterator

from .auth import TokenStore, YahooAuth, home_dir, load_credentials, save_credentials


def _league_records(value: Any) -> Iterator[dict]:
    if isinstance(value, dict):
        if "name" in value and "league_key" in value:
            yield value
        for child in value.values():
            yield from _league_records(child)
    elif isinstance(value, list):
        for child in value:
            yield from _league_records(child)


def _auth_command() -> int:
    credentials = load_credentials()
    if credentials is None:
        client_id = input("Yahoo Client ID: ").strip()
        client_secret = getpass.getpass("Yahoo Client Secret: ").strip()
        save_credentials(client_id, client_secret)
        credentials = client_id, client_secret
    auth = YahooAuth(*credentials, store=TokenStore())
    print(auth.authorize_url())
    print("Open this URL, approve access, and paste the code Yahoo shows.")
    code = input("Authorization code: ").strip()
    auth.exchange_code(code)
    print(f"Saved token to {home_dir() / 'token.json'}")
    return 0


def _check_command() -> int:
    try:
        from .server import list_my_leagues

        result = json.loads(list_my_leagues("nfl"))
        for league in _league_records(result):
            print(f"{league['name']} {league['league_key']}")
        return 0
    except Exception as error:
        print(str(error), file=sys.stderr)
        return 1


def main() -> int:
    parser = argparse.ArgumentParser(description="Read Yahoo Fantasy Sports through MCP.")
    subparsers = parser.add_subparsers(dest="command")
    subparsers.add_parser("auth", help="Authenticate with Yahoo using an out-of-band code.")
    subparsers.add_parser("check", help="List your NFL leagues to verify authentication.")
    subparsers.add_parser("serve", help="Run the MCP server over stdio.")
    args = parser.parse_args()

    if args.command == "auth":
        return _auth_command()
    if args.command == "check":
        return _check_command()

    logging.basicConfig(stream=sys.stderr)
    from .server import server

    server.run("stdio")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
