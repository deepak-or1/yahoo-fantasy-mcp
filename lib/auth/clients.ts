/**
 * OAuth clients: dynamic registration (RFC 7591) and Client ID Metadata Documents
 * (client_id is an https URL that serves its own metadata). ChatGPT and Claude use one or the other.
 */
import { kv } from "./store";
import { randomToken, sha256 } from "./crypto";

export interface OAuthClient {
  clientId: string;
  clientName: string;
  redirectUris: string[];
  /** "none" = public client, PKCE required. Confidential clients hold a secret (stored hashed). */
  tokenEndpointAuthMethod: "none" | "client_secret_post" | "client_secret_basic";
  clientSecretHash?: string;
  createdAt: number;
}

const CLIENT_TTL_SECONDS = 90 * 24 * 3600;
const CIMD_CACHE_SECONDS = 3600;

function isAllowedRedirect(uri: string): boolean {
  let url: URL;
  try {
    url = new URL(uri);
  } catch {
    return false;
  }
  if (url.hash) return false;
  if (url.protocol === "https:") return true;
  return url.protocol === "http:" && (url.hostname === "localhost" || url.hostname === "127.0.0.1");
}

export class ClientError extends Error {
  constructor(public code: string, message: string) {
    super(message);
  }
}

export interface RegistrationRequest {
  redirect_uris?: unknown;
  client_name?: unknown;
  token_endpoint_auth_method?: unknown;
  grant_types?: unknown;
  response_types?: unknown;
  scope?: unknown;
}

/** Register a client. Returns the client and, for confidential clients, the plaintext secret once. */
export async function registerClient(body: RegistrationRequest): Promise<{ client: OAuthClient; clientSecret?: string }> {
  const uris = body.redirect_uris;
  if (!Array.isArray(uris) || uris.length === 0 || uris.length > 10 || !uris.every((u) => typeof u === "string"))
    throw new ClientError("invalid_redirect_uri", "redirect_uris must be a list of 1 to 10 URLs");
  for (const uri of uris as string[]) {
    if (!isAllowedRedirect(uri)) throw new ClientError("invalid_redirect_uri", `Redirect URI not allowed: ${uri}`);
  }
  const method = body.token_endpoint_auth_method ?? "none";
  if (method !== "none" && method !== "client_secret_post" && method !== "client_secret_basic")
    throw new ClientError("invalid_client_metadata", "Unsupported token_endpoint_auth_method");
  const grants = Array.isArray(body.grant_types) ? (body.grant_types as unknown[]) : ["authorization_code"];
  for (const g of grants) {
    if (g !== "authorization_code" && g !== "refresh_token")
      throw new ClientError("invalid_client_metadata", `Unsupported grant type ${String(g)}`);
  }
  const name = typeof body.client_name === "string" ? body.client_name.slice(0, 100) : "Unnamed client";
  const clientId = randomToken(16);
  const clientSecret = method === "none" ? undefined : randomToken(32);
  const client: OAuthClient = {
    clientId,
    clientName: name,
    redirectUris: uris as string[],
    tokenEndpointAuthMethod: method,
    clientSecretHash: clientSecret ? sha256(clientSecret) : undefined,
    createdAt: Date.now(),
  };
  await kv().set(`client:${clientId}`, client, CLIENT_TTL_SECONDS);
  return { client, clientSecret };
}

function isMetadataUrl(clientId: string): boolean {
  let url: URL;
  try {
    url = new URL(clientId);
  } catch {
    return false;
  }
  if (url.protocol !== "https:" || url.username || url.password || url.hash) return false;
  const host = url.hostname;
  if (host === "localhost" || /^[\d.]+$/.test(host) || host.includes(":")) return false;
  return true;
}

async function fetchMetadataClient(clientId: string, fetchImpl: typeof fetch): Promise<OAuthClient> {
  const cacheKey = `cimd:${sha256(clientId)}`;
  const cached = await kv().get<OAuthClient>(cacheKey);
  if (cached) return cached;
  const response = await fetchImpl(clientId, {
    headers: { Accept: "application/json" },
    redirect: "error",
    signal: AbortSignal.timeout(5000),
  });
  if (!response.ok) throw new ClientError("invalid_client", "Client metadata document not reachable");
  const text = await response.text();
  if (text.length > 65536) throw new ClientError("invalid_client", "Client metadata document too large");
  let doc: Record<string, unknown>;
  try {
    doc = JSON.parse(text);
  } catch {
    throw new ClientError("invalid_client", "Client metadata document is not JSON");
  }
  if (doc.client_id !== clientId) throw new ClientError("invalid_client", "client_id in document does not match its URL");
  const uris = doc.redirect_uris;
  if (!Array.isArray(uris) || uris.length === 0 || !uris.every((u) => typeof u === "string" && isAllowedRedirect(u)))
    throw new ClientError("invalid_client", "Client metadata document has no usable redirect_uris");
  const method = "none" as const; // metadata-document clients are public; PKCE is required
  const client: OAuthClient = {
    clientId,
    clientName: typeof doc.client_name === "string" ? doc.client_name.slice(0, 100) : new URL(clientId).hostname,
    redirectUris: uris as string[],
    tokenEndpointAuthMethod: method,
    createdAt: Date.now(),
  };
  await kv().set(cacheKey, client, CIMD_CACHE_SECONDS);
  return client;
}

/** Look up a client by id: a registered client first, then a metadata-document client. */
export async function getClient(clientId: string, fetchImpl: typeof fetch = fetch): Promise<OAuthClient | null> {
  if (!clientId) return null;
  const registered = await kv().get<OAuthClient>(`client:${clientId}`);
  if (registered) return registered;
  if (isMetadataUrl(clientId)) return fetchMetadataClient(clientId, fetchImpl);
  return null;
}
