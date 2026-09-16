# Yahoo Fantasy MCP

This MCP server gives an assistant read-only access to Yahoo Fantasy Sports. It includes tools to list your leagues and teams, read league settings, standings, scoreboards, teams, rosters, matchups, free agents, player search and stats, transactions, draft results, and any Yahoo Fantasy v2 resource path through `yahoo_get`.

## 1. Create a Yahoo app

Create an app at https://developer.yahoo.com/apps/create/.

Set Application Type to Installed Application. The Redirect URI field is required even though it is never used, so enter `https://localhost:8080`. Under API Permissions, select Fantasy Sports and Read. Copy the Client ID and Client Secret.

The login flow uses Yahoo's out-of-band code (`oob`): you paste the code Yahoo shows into the terminal, so no local web server is needed.

## 2. Install and authenticate

Run:

```sh
uv sync
uv run yahoo-fantasy-mcp auth
uv run yahoo-fantasy-mcp check
```

The authentication command prompts for app credentials when they are not already configured, prints the Yahoo authorization URL, and asks for the code Yahoo displays.

## 3. Connect

For Claude Code, run:

```sh
claude mcp add yahoo-fantasy -- uv --directory /ABS/PATH/yahoo-fantasy-mcp run yahoo-fantasy-mcp serve
```

For Claude Desktop, add this server to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "yahoo-fantasy": {
      "command": "uv",
      "args": ["--directory", "/ABS/PATH/yahoo-fantasy-mcp", "run", "yahoo-fantasy-mcp", "serve"]
    }
  }
}
```

## 4. Example questions

- What leagues and teams am I in this season?
- Show my league standings and this week's scoreboard.
- Who are the highest-ranked free-agent wide receivers?
- Show my roster and player stats for week 2.
- What transactions happened most recently?

## 5. Credentials and tokens

Configuration lives in `$YAHOO_FANTASY_MCP_HOME` when set, otherwise in `~/.config/yahoo-fantasy-mcp`. The credential and token files are private, and access tokens, refresh tokens, and the client secret are never printed.
