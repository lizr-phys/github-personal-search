import { timingSafeEqual } from "node:crypto";

import { NextResponse, type NextRequest } from "next/server";

import { GitHubClient, type GitHubUser } from "@/github/client";
import { encryptSecret } from "@/server/security/crypto";
import { randomToken } from "@/server/security/csrf";
import { runtimeStore } from "@/server/runtime/store";
import { appUrl, getCanonicalAppUrl } from "@/server/security/app-url";
import { createSessionToken } from "@/server/security/session-token";

function equal(left?: string, right?: string): boolean {
  if (!left || !right) return false;
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const expected = request.cookies.get("gps_oauth_state")?.value;
  if (!code || !equal(state ?? undefined, expected))
    return NextResponse.redirect(
      appUrl("/settings?github=invalid-state", request),
    );
  const clientId = process.env.GITHUB_CLIENT_ID;
  const clientSecret = process.env.GITHUB_CLIENT_SECRET;
  if (!clientId || !clientSecret)
    return NextResponse.redirect(
      appUrl("/settings?github=not-configured", request),
    );
  try {
    const tokenResponse = await fetch(
      "https://github.com/login/oauth/access_token",
      {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          "User-Agent": "github-personal-search/1.0",
        },
        body: JSON.stringify({
          client_id: clientId,
          client_secret: clientSecret,
          code,
        }),
      },
    );
    if (!tokenResponse.ok)
      throw new Error(`OAuth token exchange failed: ${tokenResponse.status}`);
    const tokenPayload = (await tokenResponse.json()) as {
      access_token?: string;
      scope?: string;
      error?: string;
    };
    if (!tokenPayload.access_token)
      throw new Error(tokenPayload.error ?? "OAuth token missing");
    const github = new GitHubClient(tokenPayload.access_token);
    const profile = await github.request<GitHubUser>("/user", {
      cacheSeconds: 30,
    });
    await runtimeStore.mutate((runtime) => {
      runtime.user.isDemo = false;
      runtime.user.id = `github-${profile.data.id}`;
      runtime.user.githubLogin = profile.data.login;
      runtime.user.displayName = profile.data.name || profile.data.login;
      runtime.user.githubScopes = (tokenPayload.scope ?? "read:user")
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
      runtime.user.githubTokenEncrypted = encryptSecret(
        tokenPayload.access_token!,
      );
      runtime.user.githubConnectedAt = new Date().toISOString();
    });
    const response = NextResponse.redirect(
      appUrl("/settings?github=connected", request),
    );
    const secure = getCanonicalAppUrl(request).protocol === "https:";
    const sessionId = crypto.randomUUID();
    response.cookies.set("gps_user", `github-${profile.data.id}`, {
      httpOnly: true,
      secure,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });
    response.cookies.set("gps_session", sessionId, {
      httpOnly: true,
      secure,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 12,
    });
    response.cookies.set(
      "gps_auth",
      createSessionToken(`github-${profile.data.id}`, sessionId),
      {
        httpOnly: true,
        secure,
        sameSite: "lax",
        path: "/",
        maxAge: 60 * 60 * 12,
      },
    );
    response.cookies.set("gps_csrf", randomToken(), {
      httpOnly: false,
      secure,
      sameSite: "strict",
      path: "/",
      maxAge: 60 * 60 * 12,
    });
    response.cookies.delete("gps_oauth_state");
    return response;
  } catch (error) {
    console.error(
      JSON.stringify({
        level: "error",
        event: "github_oauth_callback_failed",
        message: (error as Error).message,
      }),
    );
    return NextResponse.redirect(appUrl("/settings?github=failed", request));
  }
}
