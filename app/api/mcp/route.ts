import { createMcpHandler, withMcpAuth } from "mcp-handler";
import { registerTools } from "@/lib/tools";
import { verifyToken } from "@/lib/session";

const handler = createMcpHandler((server) => registerTools(server), {
  serverInfo: { name: "yahoo-fantasy", version: "0.2.0" },
  instructions:
    "Call list_my_leagues first to learn the user's league key, then use that key with the other tools.",
});

const authed = withMcpAuth(handler, verifyToken, {
  required: true,
  resourceMetadataPath: "/.well-known/oauth-protected-resource",
});

export { authed as GET, authed as POST, authed as DELETE };
export const runtime = "nodejs";
export const maxDuration = 60;
