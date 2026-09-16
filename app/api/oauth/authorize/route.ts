import { ClientError } from "@/lib/auth/clients";
import { consentPage, parkAuthRequest, parseAuthorizeRequest, peekAuthRequest } from "@/lib/auth/authorize";
import { yahooAuthorizeUrl } from "@/lib/auth/yahoo";

export const runtime = "nodejs";

function errorPage(message: string, status = 400) {
  return new Response(`<!doctype html><meta charset="utf-8"><title>Cannot continue</title><p style="font-family:system-ui;margin:40px">${message}</p>`, {
    status,
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
  });
}

/** Step 1: an MCP client sends the user here. Validate, park the request, show consent. */
export async function GET(req: Request) {
  const params = new URL(req.url).searchParams;
  try {
    const { request } = await parseAuthorizeRequest(params);
    const id = await parkAuthRequest(request);
    return new Response(consentPage(id, request), {
      headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" },
    });
  } catch (error) {
    if (error instanceof ClientError) return errorPage(`${error.message}.`);
    throw error;
  }
}

/** Step 2: the user pressed Continue. Send them to Yahoo with our parked request id as state. */
export async function POST(req: Request) {
  const form = await req.formData();
  const id = String(form.get("request_id") ?? "");
  const request = await peekAuthRequest(id);
  if (!request) return errorPage("This sign-in link expired. Start again from your AI client.");
  return Response.redirect(yahooAuthorizeUrl(id), 303);
}
