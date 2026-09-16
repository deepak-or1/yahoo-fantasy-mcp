import { ClientError, registerClient } from "@/lib/auth/clients";

export const runtime = "nodejs";

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "invalid_client_metadata", error_description: "Body must be JSON" }, { status: 400 });
  }
  try {
    const { client, clientSecret } = await registerClient(body as Record<string, unknown>);
    return Response.json(
      {
        client_id: client.clientId,
        ...(clientSecret ? { client_secret: clientSecret, client_secret_expires_at: 0 } : {}),
        client_id_issued_at: Math.floor(client.createdAt / 1000),
        client_name: client.clientName,
        redirect_uris: client.redirectUris,
        token_endpoint_auth_method: client.tokenEndpointAuthMethod,
        grant_types: ["authorization_code", "refresh_token"],
        response_types: ["code"],
      },
      { status: 201, headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    if (error instanceof ClientError) return Response.json({ error: error.code, error_description: error.message }, { status: 400 });
    throw error;
  }
}
