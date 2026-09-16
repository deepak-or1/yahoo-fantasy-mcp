import { getClient, type OAuthClient } from "@/lib/auth/clients";
import { constantTimeEqual, sha256 } from "@/lib/auth/crypto";
import { issueTokens, redeemCode, redeemRefreshToken } from "@/lib/auth/tokens";

export const runtime = "nodejs";

const NO_STORE = { "Cache-Control": "no-store", Pragma: "no-cache" };

function oauthError(code: string, description: string, status = 400) {
  return Response.json({ error: code, error_description: description }, { status, headers: NO_STORE });
}

async function readForm(req: Request): Promise<URLSearchParams> {
  const type = req.headers.get("content-type") ?? "";
  if (type.includes("application/json")) {
    const json = (await req.json()) as Record<string, unknown>;
    return new URLSearchParams(Object.entries(json).map(([k, v]) => [k, String(v)]));
  }
  return new URLSearchParams(await req.text());
}

/** Identify and, for confidential clients, authenticate the caller. */
async function authenticateClient(req: Request, form: URLSearchParams): Promise<OAuthClient | null> {
  let clientId = form.get("client_id") ?? "";
  let secret = form.get("client_secret") ?? "";
  const basic = req.headers.get("authorization");
  if (basic?.toLowerCase().startsWith("basic ")) {
    const decoded = Buffer.from(basic.slice(6), "base64").toString("utf8");
    const i = decoded.indexOf(":");
    if (i > 0) {
      clientId = decodeURIComponent(decoded.slice(0, i));
      secret = decodeURIComponent(decoded.slice(i + 1));
    }
  }
  const client = await getClient(clientId);
  if (!client) return null;
  if (client.tokenEndpointAuthMethod === "none") return client;
  if (!client.clientSecretHash || !secret || !constantTimeEqual(sha256(secret), client.clientSecretHash)) return null;
  return client;
}

export async function POST(req: Request) {
  const form = await readForm(req);
  const client = await authenticateClient(req, form);
  if (!client) return oauthError("invalid_client", "Unknown client or bad client credentials", 401);
  const grantType = form.get("grant_type");

  if (grantType === "authorization_code") {
    const code = form.get("code") ?? "";
    const redirectUri = form.get("redirect_uri") ?? "";
    const record = await redeemCode({
      code,
      clientId: client.clientId,
      redirectUri,
      codeVerifier: form.get("code_verifier") ?? undefined,
      pkceRequired: client.tokenEndpointAuthMethod === "none",
    });
    if (!record) return oauthError("invalid_grant", "Authorization code is invalid, expired, already used, or the PKCE verifier does not match");
    const tokens = await issueTokens({ userId: record.userId, clientId: client.clientId, scope: record.scope, resource: record.resource });
    return Response.json(tokens, { headers: NO_STORE });
  }

  if (grantType === "refresh_token") {
    const tokens = await redeemRefreshToken(form.get("refresh_token") ?? "", client.clientId);
    if (!tokens) return oauthError("invalid_grant", "Refresh token is invalid or expired");
    return Response.json(tokens, { headers: NO_STORE });
  }

  return oauthError("unsupported_grant_type", "grant_type must be authorization_code or refresh_token");
}
