/**
 * Authorization codes, access tokens and refresh tokens issued by this server to MCP clients.
 * Every secret is random, stored under its SHA-256, and single-use where the spec says so.
 */
import type { AuthInfo } from "@modelcontextprotocol/server";
import { kv } from "./store";
import { pkceMatches, randomToken, sha256 } from "./crypto";
import { baseUrl, RESOURCE_PATH, SCOPE } from "./env";

export const CODE_TTL_SECONDS = 300;
export const ACCESS_TTL_SECONDS = 3600;
export const REFRESH_TTL_SECONDS = 30 * 24 * 3600;

export interface CodeRecord {
  clientId: string;
  redirectUri: string;
  codeChallenge?: string;
  userId: string;
  scope: string;
  resource?: string;
}

interface AccessRecord {
  userId: string;
  clientId: string;
  scope: string;
  resource?: string;
  expiresAt: number;
}

interface RefreshRecord {
  userId: string;
  clientId: string;
  scope: string;
  resource?: string;
}

export interface IssuedTokens {
  access_token: string;
  token_type: "Bearer";
  expires_in: number;
  refresh_token: string;
  scope: string;
}

export async function issueCode(record: CodeRecord): Promise<string> {
  const code = randomToken(32);
  await kv().set(`code:${sha256(code)}`, record, CODE_TTL_SECONDS);
  return code;
}

/** Consume a code. Returns null when unknown, expired, already used, or not matching the caller. */
export async function redeemCode(params: {
  code: string;
  clientId: string;
  redirectUri: string;
  codeVerifier?: string;
  pkceRequired: boolean;
}): Promise<CodeRecord | null> {
  const record = await kv().getdel<CodeRecord>(`code:${sha256(params.code)}`);
  if (!record) return null;
  if (record.clientId !== params.clientId || record.redirectUri !== params.redirectUri) return null;
  if (record.codeChallenge) {
    if (!params.codeVerifier || !pkceMatches(params.codeVerifier, record.codeChallenge)) return null;
  } else if (params.pkceRequired) {
    return null;
  }
  return record;
}

export async function issueTokens(grant: {
  userId: string;
  clientId: string;
  scope: string;
  resource?: string;
}): Promise<IssuedTokens> {
  const access = randomToken(32);
  const refresh = randomToken(32);
  const expiresAt = Math.floor(Date.now() / 1000) + ACCESS_TTL_SECONDS;
  const accessRecord: AccessRecord = { ...grant, expiresAt };
  const refreshRecord: RefreshRecord = { ...grant };
  await kv().set(`at:${sha256(access)}`, accessRecord, ACCESS_TTL_SECONDS);
  await kv().set(`rt:${sha256(refresh)}`, refreshRecord, REFRESH_TTL_SECONDS);
  return { access_token: access, token_type: "Bearer", expires_in: ACCESS_TTL_SECONDS, refresh_token: refresh, scope: grant.scope };
}

/** Rotate a refresh token: the old one is consumed atomically, a new pair is issued. */
export async function redeemRefreshToken(token: string, clientId: string): Promise<IssuedTokens | null> {
  const record = await kv().getdel<RefreshRecord>(`rt:${sha256(token)}`);
  if (!record || record.clientId !== clientId) return null;
  return issueTokens(record);
}

/** Bearer verification for the MCP endpoint. */
export async function verifyAccessToken(token: string): Promise<AuthInfo | undefined> {
  if (!token || token.length > 256) return undefined;
  const record = await kv().get<AccessRecord>(`at:${sha256(token)}`);
  if (!record) return undefined;
  if (record.expiresAt <= Math.floor(Date.now() / 1000)) return undefined;
  return {
    token,
    clientId: record.clientId,
    scopes: record.scope.split(" ").filter(Boolean),
    expiresAt: record.expiresAt,
    resource: new URL(record.resource ?? `${baseUrl()}${RESOURCE_PATH}`),
    extra: { userId: record.userId },
  };
}

export { SCOPE };
