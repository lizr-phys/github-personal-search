import { NextResponse, type NextRequest } from "next/server";

import { hasValidOrigin, randomToken } from "@/server/security/csrf";
import { createSessionToken } from "@/server/security/session-token";

export function POST(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (!hasValidOrigin(request, origin))
    return NextResponse.json(
      { error: { code: "ORIGIN", message: "Origin mismatch" } },
      { status: 403 },
    );
  const response = NextResponse.json({ ok: true, redirect: "/onboarding" });
  const secure = request.nextUrl.protocol === "https:";
  const sessionId = crypto.randomUUID();
  response.cookies.set("gps_user", "demo-user", {
    httpOnly: true,
    sameSite: "lax",
    secure,
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  response.cookies.set("gps_session", sessionId, {
    httpOnly: true,
    sameSite: "lax",
    secure,
    path: "/",
    maxAge: 60 * 60 * 12,
  });
  response.cookies.set("gps_auth", createSessionToken("demo-user", sessionId), {
    httpOnly: true,
    sameSite: "lax",
    secure,
    path: "/",
    maxAge: 60 * 60 * 12,
  });
  response.cookies.set("gps_csrf", randomToken(), {
    httpOnly: false,
    sameSite: "strict",
    secure,
    path: "/",
    maxAge: 60 * 60 * 12,
  });
  return response;
}
