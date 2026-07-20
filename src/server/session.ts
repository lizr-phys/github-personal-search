import type { NextRequest } from "next/server";
import { verifySessionToken } from "@/server/security/session-token";

export function getSession(request: NextRequest): {
  userId?: string;
  sessionId: string;
} {
  const claims = verifySessionToken(request.cookies.get("gps_auth")?.value);
  if (!claims) return { sessionId: "anonymous" };
  return { userId: claims.userId, sessionId: claims.sessionId };
}
