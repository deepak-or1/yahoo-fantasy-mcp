import { beforeEach, describe, expect, it, vi } from "vitest";
import { createHash } from "node:crypto";

process.env.TOKEN_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString("base64");
process.env.PUBLIC_BASE_URL = "https://example.test";
process.env.YAHOO_CLIENT_ID = "yid";
process.env.YAHOO_CLIENT_SECRET = "ysecret";

import { resetKvForTests, kv } from "@/lib/auth/store";
import { decrypt, encrypt, pkceMatches, sha256 } from "@/lib/auth/crypto";
import { registerClient, getClient } from "@/lib/auth/clients";
import { issueCode, issueTokens, redeemCode, redeemRefreshToken, verifyAccessToken } from "@/lib/auth/tokens";
import { parseAuthorizeRequest } from "@/lib/auth/authorize";
import { completeYahooLogin, getYahooAccessToken } from "@/lib/auth/yahoo";

const verifier = "a".repeat(64);
const challenge = createHash("sha256").update(verifier).digest("base64url");

beforeEach(() => resetKvForTests());

describe("crypto", () => {
  it("round-trips AES-GCM and rejects tampering", () => {
    const blob = encrypt("hello");
    expect(decrypt(blob)).toBe("hello");
    const parts = blob.split(".");
    parts[2] = parts[2].slice(0, -2) + "AA";
    expect(() => decrypt(parts.join("."))).toThrow();
  });
  it("checks PKCE S256", () => {
    expect(pkceMatches(verifier, challenge)).toBe(true);
    expect(pkceMatches("b".repeat(64), challenge)).toBe(false);
    expect(pkceMatches("short", challenge)).toBe(false);
  });
});

describe("clients", () => {
  it("registers a public client and rejects bad redirects", async () => {
    const { client, clientSecret } = await registerClient({ redirect_uris: ["https://chatgpt.com/cb"], client_name: "ChatGPT" });
    expect(clientSecret).toBeUndefined();
    expect((await getClient(client.clientId))?.redirectUris).toEqual(["https://chatgpt.com/cb"]);
    await expect(registerClient({ redirect_uris: ["http://evil.example/cb"] })).rejects.toThrow(/not allowed/);
    await expect(registerClient({ redirect_uris: [] })).rejects.toThrow();
  });
  it("stores confidential client secrets hashed", async () => {
    const { client, clientSecret } = await registerClient({ redirect_uris: ["https://x.test/cb"], token_endpoint_auth_method: "client_secret_post" });
    expect(clientSecret).toBeDefined();
    expect(client.clientSecretHash).toBe(sha256(clientSecret!));
    expect(JSON.stringify(await kv().get(`client:${client.clientId}`))).not.toContain(clientSecret);
  });
  it("loads a client from a metadata document and rejects mismatches", async () => {
    const id = "https://claude.ai/.well-known/client";
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ client_id: id, client_name: "Claude", redirect_uris: ["https://claude.ai/cb"] })));
    const client = await getClient(id, fetchImpl as unknown as typeof fetch);
    expect(client?.clientName).toBe("Claude");
    expect(client?.tokenEndpointAuthMethod).toBe("none");
    const bad = vi.fn(async () => new Response(JSON.stringify({ client_id: "https://other.test", redirect_uris: ["https://claude.ai/cb"] })));
    await expect(getClient("https://claude.ai/.well-known/other", bad as unknown as typeof fetch)).rejects.toThrow(/does not match/);
    expect(await getClient("http://claude.ai/plain")).toBeNull();
  });
});

describe("authorize request", () => {
  it("requires PKCE for public clients and a registered redirect", async () => {
    const { client } = await registerClient({ redirect_uris: ["https://c.test/cb"] });
    const base = { client_id: client.clientId, redirect_uri: "https://c.test/cb", response_type: "code", state: "s1" };
    await expect(parseAuthorizeRequest(new URLSearchParams(base))).rejects.toThrow(/PKCE/);
    await expect(parseAuthorizeRequest(new URLSearchParams({ ...base, redirect_uri: "https://c.test/other", code_challenge: challenge, code_challenge_method: "S256" }))).rejects.toThrow(/not registered/);
    const { request } = await parseAuthorizeRequest(new URLSearchParams({ ...base, code_challenge: challenge, code_challenge_method: "S256", scope: "fantasy:read" }));
    expect(request).toMatchObject({ clientId: client.clientId, state: "s1", codeChallenge: challenge, scope: "fantasy:read" });
    await expect(parseAuthorizeRequest(new URLSearchParams({ ...base, code_challenge: challenge, code_challenge_method: "S256", resource: "https://other.test/api/mcp" }))).rejects.toThrow(/resource/);
    const ok = await parseAuthorizeRequest(new URLSearchParams({ ...base, code_challenge: challenge, code_challenge_method: "S256", resource: "https://example.test/api/mcp" }));
    expect(ok.request.resource).toBe("https://example.test/api/mcp");
  });
});

describe("codes and tokens", () => {
  it("redeems a code once, with the right client, redirect and verifier", async () => {
    const code = await issueCode({ clientId: "c1", redirectUri: "https://c.test/cb", codeChallenge: challenge, userId: "u1", scope: "fantasy:read" });
    expect(await redeemCode({ code, clientId: "c2", redirectUri: "https://c.test/cb", codeVerifier: verifier, pkceRequired: true })).toBeNull();
    const code2 = await issueCode({ clientId: "c1", redirectUri: "https://c.test/cb", codeChallenge: challenge, userId: "u1", scope: "fantasy:read" });
    expect(await redeemCode({ code: code2, clientId: "c1", redirectUri: "https://c.test/cb", codeVerifier: "b".repeat(64), pkceRequired: true })).toBeNull();
    const code3 = await issueCode({ clientId: "c1", redirectUri: "https://c.test/cb", codeChallenge: challenge, userId: "u1", scope: "fantasy:read" });
    expect((await redeemCode({ code: code3, clientId: "c1", redirectUri: "https://c.test/cb", codeVerifier: verifier, pkceRequired: true }))?.userId).toBe("u1");
    expect(await redeemCode({ code: code3, clientId: "c1", redirectUri: "https://c.test/cb", codeVerifier: verifier, pkceRequired: true })).toBeNull();
  });
  it("issues verifiable tokens stored under their hash, and rotates refresh tokens", async () => {
    const tokens = await issueTokens({ userId: "u1", clientId: "c1", scope: "fantasy:read" });
    const info = await verifyAccessToken(tokens.access_token);
    expect(info?.extra?.userId).toBe("u1");
    expect(info?.resource?.toString()).toBe("https://example.test/api/mcp");
    expect(await kv().get(`at:${tokens.access_token}`)).toBeNull();
    expect(await kv().get(`at:${sha256(tokens.access_token)}`)).not.toBeNull();
    expect(await verifyAccessToken("nope")).toBeUndefined();
    const rotated = await redeemRefreshToken(tokens.refresh_token, "c1");
    expect(rotated?.access_token).not.toBe(tokens.access_token);
    expect(await redeemRefreshToken(tokens.refresh_token, "c1")).toBeNull();
    expect(await redeemRefreshToken(rotated!.refresh_token, "other-client")).toBeNull();
  });
});

describe("yahoo login", () => {
  it("exchanges the code, stores encrypted tokens, refreshes near expiry", async () => {
    const calls: string[] = [];
    const fetchImpl = vi.fn(async (url: string, init?: RequestInit) => {
      calls.push(String(init?.body ?? ""));
      return new Response(JSON.stringify({ access_token: `at${calls.length}`, refresh_token: "rt1", expires_in: calls.length === 1 ? 30 : 3600, xoauth_yahoo_guid: "GUID1" }));
    });
    const userId = await completeYahooLogin("ycode", fetchImpl as unknown as typeof fetch);
    expect(userId).toBe("GUID1");
    expect(calls[0]).toContain("grant_type=authorization_code");
    expect(calls[0]).toContain("redirect_uri=https%3A%2F%2Fexample.test%2Fapi%2Fyahoo%2Fcallback");
    const stored = JSON.stringify(await kv().get("user:GUID1"));
    expect(stored).not.toContain("at1");
    expect(stored).not.toContain("rt1");
    // expires_in was 30 s, inside the 60 s refresh window, so the next read refreshes.
    expect(await getYahooAccessToken("GUID1", fetchImpl as unknown as typeof fetch)).toBe("at2");
    expect(calls[1]).toContain("grant_type=refresh_token");
    expect(calls[1]).toContain("refresh_token=rt1");
    expect(await getYahooAccessToken("GUID1", fetchImpl as unknown as typeof fetch)).toBe("at2");
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });
});
