import { metadataCorsOptionsRequestHandler } from "mcp-handler";
import { baseUrl, SCOPE } from "@/lib/auth/env";

export const runtime = "nodejs";

export function GET() {
  const issuer = baseUrl();
  return Response.json(
    {
      issuer,
      authorization_endpoint: `${issuer}/api/oauth/authorize`,
      token_endpoint: `${issuer}/api/oauth/token`,
      registration_endpoint: `${issuer}/api/oauth/register`,
      response_types_supported: ["code"],
      grant_types_supported: ["authorization_code", "refresh_token"],
      code_challenge_methods_supported: ["S256"],
      token_endpoint_auth_methods_supported: ["none", "client_secret_post", "client_secret_basic"],
      scopes_supported: [SCOPE],
      client_id_metadata_document_supported: true,
    },
    { headers: { "Access-Control-Allow-Origin": "*", "Cache-Control": "public, max-age=300" } },
  );
}

export const OPTIONS = metadataCorsOptionsRequestHandler();
