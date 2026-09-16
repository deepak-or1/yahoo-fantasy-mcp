/**
 * Interface between the MCP tools and the auth layer.
 * The implementations live in lib/auth/*.ts; tools import only from here.
 */
import type { AuthInfo } from "@modelcontextprotocol/server";
import { verifyAccessToken } from "@/lib/auth/tokens";
import { getYahooAccessToken as getToken, refreshYahooAccessToken as refreshToken } from "@/lib/auth/yahoo";

/** Bearer-token verifier for withMcpAuth. `extra.userId` is the Yahoo user id. */
export async function verifyToken(_req: Request, bearerToken?: string): Promise<AuthInfo | undefined> {
  if (!bearerToken) return undefined;
  return verifyAccessToken(bearerToken);
}

/** Read the user id out of the verified AuthInfo; throws if the request is unauthenticated. */
export function userIdFromAuth(authInfo: AuthInfo | undefined): string {
  const userId = authInfo?.extra?.userId;
  if (typeof userId !== "string" || !userId) throw new Error("Not authenticated");
  return userId;
}

/** A valid Yahoo access token for this user, refreshed when within 60 s of expiry. */
export async function getYahooAccessToken(userId: string): Promise<string> {
  return getToken(userId);
}

/** Force a refresh (call after Yahoo answers 401) and return the new access token. */
export async function refreshYahooAccessToken(userId: string): Promise<string> {
  return refreshToken(userId);
}
