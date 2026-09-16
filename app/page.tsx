import { baseUrl, RESOURCE_PATH } from "@/lib/auth/env";

export default function Home() {
  const url = `${baseUrl()}${RESOURCE_PATH}`;
  return (
    <main style={{ maxWidth: 560, margin: "10vh auto", padding: "0 16px", lineHeight: 1.55 }}>
      <h1 style={{ fontSize: 26, marginBottom: 8 }}>Yahoo Fantasy MCP</h1>
      <p>Give ChatGPT or Claude read-only access to your Yahoo Fantasy league: standings, rosters, matchups, free agents, transactions.</p>
      <h2 style={{ fontSize: 18 }}>Connect</h2>
      <p>Add this URL as a custom connector, then sign in with Yahoo when asked:</p>
      <pre style={{ background: "#fff", padding: 14, borderRadius: 10, overflowX: "auto" }}>{url}</pre>
      <ul>
        <li>ChatGPT: Settings → Connectors → Create (developer mode must be on).</li>
        <li>Claude: Settings → Connectors → Add custom connector.</li>
        <li>Claude Code: <code>claude mcp add --transport http yahoo-fantasy {url}</code></li>
      </ul>
      <p style={{ color: "#6b6560", fontSize: 14 }}>
        This server only reads. It cannot set lineups or make moves. Yahoo tokens are stored encrypted and are never shown to the AI.
      </p>
    </main>
  );
}
