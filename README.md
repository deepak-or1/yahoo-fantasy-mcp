# Yahoo Fantasy MCP

Let ChatGPT or Claude read your Yahoo Fantasy league. Standings, every roster, matchups, free agents, player stats, transactions, draft results. Read-only: it cannot set lineups or make moves.

It is an MCP server that runs on Vercel's free plan. Each person who connects signs in with their own Yahoo account, and their Yahoo tokens are stored encrypted in Upstash Redis (also free). One deployment serves any number of users.

There is also a laptop-only Python version in [`local/`](local/README.md) for Claude Desktop and Claude Code, with no hosting at all.

## Use a running deployment

Add the deployment's MCP URL as a custom connector and sign in with Yahoo when asked. The URL is `https://<app>.vercel.app/api/mcp`.

- ChatGPT: Settings → Connectors → Create. Developer mode has to be on, which needs a paid plan.
- Claude (web or desktop): Settings → Connectors → Add custom connector.
- Claude Code: `claude mcp add --transport http yahoo-fantasy https://<app>.vercel.app/api/mcp`

Then ask things like "who should I start at flex this week?" or "which running backs on waivers are worth a claim?".

## Deploy your own (about 15 minutes, all free)

### 1. Push this repo to GitHub

Fork it or push a copy under your account.

### 2. Create the Vercel project

1. At https://vercel.com/new import the repo. Framework: Next.js. Leave the defaults and deploy once. The first deploy fails on missing environment variables, which is expected.
2. Note the production URL, for example `https://yahoo-fantasy-mcp.vercel.app`.

### 3. Add Upstash Redis

In the Vercel project: Storage → Create Database → Upstash Redis (Marketplace) → free plan → connect it to the project. Vercel adds `KV_REST_API_URL` and `KV_REST_API_TOKEN` to the project's environment automatically.

### 4. Create the Yahoo app

At https://developer.yahoo.com/apps/create/:

- Application Name: anything.
- Application Type: Web Application.
- Redirect URI(s): `https://<your-app>.vercel.app/api/yahoo/callback` (exact, no trailing slash).
- API Permissions: Fantasy Sports, with Read selected.

Save, then copy the Client ID and Client Secret.

### 5. Set the environment variables

In the Vercel project: Settings → Environment Variables. Add for Production:

| Name | Value |
|---|---|
| `YAHOO_CLIENT_ID` | from step 4 |
| `YAHOO_CLIENT_SECRET` | from step 4 |
| `TOKEN_ENCRYPTION_KEY` | output of `openssl rand -base64 32` |
| `PUBLIC_BASE_URL` | `https://<your-app>.vercel.app` |

Redeploy (Deployments → ⋯ → Redeploy). Open the URL: the landing page shows the MCP URL to paste into ChatGPT or Claude.

## How the sign-in works

1. ChatGPT or Claude reads `/.well-known/oauth-protected-resource` and `/.well-known/oauth-authorization-server`, registers itself (dynamic client registration or a client metadata document), and sends you to `/api/oauth/authorize`.
2. You see a consent page naming the client, press Continue, and Yahoo asks you to sign in and approve.
3. Yahoo sends you back to `/api/yahoo/callback`. The server stores your Yahoo tokens encrypted with AES-256-GCM and hands the client its own short-lived code.
4. The client trades the code for an access token at `/api/oauth/token` (PKCE S256 required for public clients) and calls `/api/mcp` with it.

Access tokens last 1 hour, refresh tokens 30 days and rotate on use. Every secret is stored under its SHA-256 hash, so a copy of the database does not contain usable tokens. Your Yahoo access token is never sent to the AI client; only the server sees it.

## Develop

```sh
npm install
cp .env.example .env.local   # fill in the values
npm run dev                  # http://localhost:3000
npm test                     # 21 tests, no network
npm run typecheck
```

Without Redis variables set, storage is in memory, which is fine for local development and tests.

## Tools

`list_my_leagues`, `list_my_teams`, `get_league_settings`, `get_standings`, `get_scoreboard`, `get_teams`, `get_roster`, `get_matchups`, `get_free_agents`, `search_players`, `get_player_stats`, `get_transactions`, `get_draft_results`, and `yahoo_get` for any other Yahoo Fantasy v2 path.
