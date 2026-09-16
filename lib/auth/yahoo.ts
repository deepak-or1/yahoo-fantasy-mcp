/**
 * Yahoo's side of the login: exchange the callback code, keep each user's Yahoo tokens
 * encrypted at rest, refresh them when they expire.
 */
import { kv } from "./store";
import { decrypt, encrypt } from "./crypto";
import { baseUrl, requireEnv } from "./env";

export const YAHOO_AUTHORIZE_URL = "https://api.login.yahoo.com/oauth2/request_auth";
export const YAHOO_TOKEN_URL = "https://api.login.yahoo.com/oauth2/get_token";
const USER_TTL_SECONDS = 180 * 24 * 3600;

interface UserRecord {
  accessTokenEnc: string;
  refreshTokenEnc: string;
  /** Unix seconds. */
  expiresAt: number;
  updatedAt: number;
}

interface YahooTokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  xoauth_yahoo_guid?: string;
}

export function yahooCallbackUrl(): string {
  return `${baseUrl()}/api/yahoo/callback`;
}

export function yahooAuthorizeUrl(state: string): string {
  const query = new URLSearchParams({
    client_id: requireEnv("YAHOO_CLIENT_ID"),
    redirect_uri: yahooCallbackUrl(),
    response_type: "code",
    state,
    language: "en-us",
  });
  return `${YAHOO_AUTHORIZE_URL}?${query}`;
}

async function postToken(form: Record<string, string>, fetchImpl: typeof fetch): Promise<YahooTokenResponse> {
  const body = new URLSearchParams({
    client_id: requireEnv("YAHOO_CLIENT_ID"),
    client_secret: requireEnv("YAHOO_CLIENT_SECRET"),
    redirect_uri: yahooCallbackUrl(),
    ...form,
  });
  const response = await fetchImpl(YAHOO_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body,
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new Error(`Yahoo login failed (${response.status})`);
  const json = (await response.json()) as YahooTokenResponse;
  if (!json.access_token || typeof json.expires_in !== "number") throw new Error("Yahoo login returned no token");
  return json;
}

async function saveUser(userId: string, token: YahooTokenResponse, previousRefresh?: string): Promise<UserRecord> {
  const refresh = token.refresh_token ?? previousRefresh;
  if (!refresh) throw new Error("Yahoo login returned no refresh token");
  const record: UserRecord = {
    accessTokenEnc: encrypt(token.access_token),
    refreshTokenEnc: encrypt(refresh),
    expiresAt: Math.floor(Date.now() / 1000) + token.expires_in,
    updatedAt: Date.now(),
  };
  await kv().set(`user:${userId}`, record, USER_TTL_SECONDS);
  return record;
}

async function lookupGuid(accessToken: string, fetchImpl: typeof fetch): Promise<string> {
  const response = await fetchImpl("https://fantasysports.yahooapis.com/fantasy/v2/users;use_login=1?format=json", {
    headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" },
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new Error(`Could not read Yahoo profile (${response.status})`);
  const text = await response.text();
  const match = text.match(/"guid"\s*:\s*"([A-Za-z0-9_-]+)"/);
  if (!match) throw new Error("Yahoo profile has no guid");
  return match[1];
}

/** Finish Yahoo's redirect: exchange the code, store the tokens, return the stable Yahoo user id. */
export async function completeYahooLogin(code: string, fetchImpl: typeof fetch = fetch): Promise<string> {
  const token = await postToken({ code, grant_type: "authorization_code" }, fetchImpl);
  const userId = token.xoauth_yahoo_guid ?? (await lookupGuid(token.access_token, fetchImpl));
  await saveUser(userId, token);
  return userId;
}

export async function refreshYahooAccessToken(userId: string, fetchImpl: typeof fetch = fetch): Promise<string> {
  const record = await kv().get<UserRecord>(`user:${userId}`);
  if (!record) throw new Error("Yahoo account not connected. Reconnect this server in your AI client.");
  const previousRefresh = decrypt(record.refreshTokenEnc);
  const token = await postToken({ refresh_token: previousRefresh, grant_type: "refresh_token" }, fetchImpl);
  await saveUser(userId, token, previousRefresh);
  return token.access_token;
}

export async function getYahooAccessToken(userId: string, fetchImpl: typeof fetch = fetch): Promise<string> {
  const record = await kv().get<UserRecord>(`user:${userId}`);
  if (!record) throw new Error("Yahoo account not connected. Reconnect this server in your AI client.");
  if (record.expiresAt - 60 <= Math.floor(Date.now() / 1000)) return refreshYahooAccessToken(userId, fetchImpl);
  return decrypt(record.accessTokenEnc);
}
