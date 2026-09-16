import { takeAuthRequest } from "@/lib/auth/authorize";
import { completeYahooLogin } from "@/lib/auth/yahoo";
import { issueCode } from "@/lib/auth/tokens";

export const runtime = "nodejs";

function errorPage(message: string) {
  return new Response(`<!doctype html><meta charset="utf-8"><title>Cannot continue</title><p style="font-family:system-ui;margin:40px">${message}</p>`, {
    status: 400,
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
  });
}

/** Step 3: Yahoo sends the user back. Finish the Yahoo login, then hand the MCP client its code. */
export async function GET(req: Request) {
  const params = new URL(req.url).searchParams;
  const state = params.get("state") ?? "";
  const request = await takeAuthRequest(state);
  if (!request) return errorPage("This sign-in link expired or was already used. Start again from your AI client.");
  const redirect = new URL(request.redirectUri);
  if (request.state) redirect.searchParams.set("state", request.state);
  const yahooError = params.get("error");
  const code = params.get("code");
  if (yahooError || !code) {
    redirect.searchParams.set("error", "access_denied");
    redirect.searchParams.set("error_description", "Yahoo sign-in was not completed");
    return Response.redirect(redirect.toString(), 302);
  }
  let userId: string;
  try {
    userId = await completeYahooLogin(code);
  } catch (error) {
    console.error("yahoo login failed:", error instanceof Error ? error.message : "unknown");
    redirect.searchParams.set("error", "server_error");
    redirect.searchParams.set("error_description", "Yahoo sign-in failed");
    return Response.redirect(redirect.toString(), 302);
  }
  const ourCode = await issueCode({
    clientId: request.clientId,
    redirectUri: request.redirectUri,
    codeChallenge: request.codeChallenge,
    userId,
    scope: request.scope,
    resource: request.resource,
  });
  redirect.searchParams.set("code", ourCode);
  return new Response(null, { status: 302, headers: { Location: redirect.toString(), "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" } });
}
