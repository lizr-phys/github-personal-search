import { NextResponse, type NextRequest } from "next/server";

import { randomToken } from "@/server/security/csrf";
import { appUrl, getCanonicalAppUrl } from "@/server/security/app-url";

export function GET(request: NextRequest) {
  const clientId = process.env.GITHUB_CLIENT_ID;
  if (!clientId)
    return NextResponse.redirect(
      appUrl("/settings?github=not-configured", request),
    );
  const state = randomToken();
  const callback = appUrl("/api/github/callback", request).toString();
  const authorize = new URL("https://github.com/login/oauth/authorize");
  authorize.searchParams.set("client_id", clientId);
  authorize.searchParams.set("redirect_uri", callback);
  authorize.searchParams.set("scope", "read:user");
  authorize.searchParams.set("state", state);
  const response = NextResponse.redirect(authorize);
  response.cookies.set("gps_oauth_state", state, {
    httpOnly: true,
    secure: getCanonicalAppUrl(request).protocol === "https:",
    sameSite: "lax",
    path: "/",
    maxAge: 600,
  });
  return response;
}
