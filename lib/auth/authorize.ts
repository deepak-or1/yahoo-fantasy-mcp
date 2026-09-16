/**
 * The authorization request an MCP client starts, parked while the user goes through Yahoo.
 */
import { kv } from "./store";
import { randomToken } from "./crypto";
import { baseUrl, RESOURCE_PATH, SCOPE } from "./env";
import { ClientError, getClient, type OAuthClient } from "./clients";

export const AUTH_REQUEST_TTL_SECONDS = 600;

export interface AuthRequest {
  clientId: string;
  clientName: string;
  redirectUri: string;
  state?: string;
  codeChallenge?: string;
  scope: string;
  resource?: string;
}

/** Validate the query of GET /api/oauth/authorize. Throws ClientError when the client or redirect is bad. */
export async function parseAuthorizeRequest(params: URLSearchParams): Promise<{ request: AuthRequest; client: OAuthClient }> {
  const clientId = params.get("client_id") ?? "";
  const client = await getClient(clientId);
  if (!client) throw new ClientError("invalid_client", "Unknown client_id");
  const redirectUri = params.get("redirect_uri") ?? "";
  if (!client.redirectUris.includes(redirectUri)) throw new ClientError("invalid_request", "redirect_uri is not registered for this client");
  if (params.get("response_type") !== "code") throw new ClientError("unsupported_response_type", "response_type must be code");
  const challenge = params.get("code_challenge") ?? undefined;
  const method = params.get("code_challenge_method");
  if (challenge && method !== "S256") throw new ClientError("invalid_request", "code_challenge_method must be S256");
  if (!challenge && client.tokenEndpointAuthMethod === "none")
    throw new ClientError("invalid_request", "PKCE (code_challenge) is required for public clients");
  const requestedScope = params.get("scope");
  if (requestedScope && requestedScope.split(" ").some((s) => s && s !== SCOPE))
    throw new ClientError("invalid_scope", `Only the scope ${SCOPE} is available`);
  const resource = params.get("resource") ?? undefined;
  if (resource && resource.replace(/\/$/, "") !== `${baseUrl()}${RESOURCE_PATH}`)
    throw new ClientError("invalid_target", "resource must be this server's MCP URL");
  return {
    client,
    request: {
      clientId: client.clientId,
      clientName: client.clientName,
      redirectUri,
      state: params.get("state") ?? undefined,
      codeChallenge: challenge,
      scope: SCOPE,
      resource,
    },
  };
}

export async function parkAuthRequest(request: AuthRequest): Promise<string> {
  const id = randomToken(32);
  await kv().set(`authreq:${id}`, request, AUTH_REQUEST_TTL_SECONDS);
  return id;
}

/** Read without consuming: the consent page shows it, the consent POST re-reads it. */
export async function peekAuthRequest(id: string): Promise<AuthRequest | null> {
  if (!id || id.length > 128) return null;
  return kv().get<AuthRequest>(`authreq:${id}`);
}

/** Consume: the Yahoo callback takes it exactly once. */
export async function takeAuthRequest(id: string): Promise<AuthRequest | null> {
  if (!id || id.length > 128) return null;
  return kv().getdel<AuthRequest>(`authreq:${id}`);
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string);
}

/** The consent page. Plain HTML so it has no client-side JavaScript. */
export function consentPage(requestId: string, request: AuthRequest): string {
  const host = new URL(request.redirectUri).host;
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Connect Yahoo Fantasy</title>
<style>
  body{font-family:-apple-system,system-ui,sans-serif;margin:0;background:#f6f3ee;color:#1d1a16}
  main{max-width:420px;margin:12vh auto;padding:0 16px}
  .card{background:#fff;border-radius:14px;padding:28px 24px;box-shadow:0 8px 30px rgba(0,0,0,.06)}
  h1{font-size:20px;margin:0 0 12px}p{line-height:1.5;margin:0 0 12px}
  button{width:100%;padding:12px;border:0;border-radius:10px;background:#5f01d1;color:#fff;font-size:16px;cursor:pointer}
  small{color:#6b6560}
</style></head>
<body><main><div class="card">
<h1>Connect Yahoo Fantasy</h1>
<p><strong>${escapeHtml(request.clientName)}</strong> (${escapeHtml(host)}) wants read-only access to your Yahoo Fantasy leagues.</p>
<p>Next, Yahoo will ask you to sign in and approve. This server keeps your Yahoo tokens encrypted and only ever reads league data.</p>
<form method="post" action="/api/oauth/authorize">
<input type="hidden" name="request_id" value="${escapeHtml(requestId)}">
<button type="submit">Continue with Yahoo</button>
</form>
<p><small>Not you? Close this page and nothing happens.</small></p>
</div></main></body></html>`;
}
