import { timingSafeEqual } from "node:crypto";

import type { NextRequest } from "next/server";
import { getCanonicalAppUrl } from "@/server/security/app-url";

function constantTimeEqual(left: string, right: string): boolean {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function validateMutationRequest(
  request: NextRequest,
): { ok: true } | { ok: false; message: string } {
  const origin = request.headers.get("origin");
  if (origin && !hasValidOrigin(request, origin))
    return { ok: false, message: "Origin mismatch" };
  const cookieToken = request.cookies.get("gps_csrf")?.value;
  const headerToken = request.headers.get("x-gps-csrf");
  if (
    !cookieToken ||
    !headerToken ||
    !constantTimeEqual(cookieToken, headerToken)
  )
    return { ok: false, message: "Invalid CSRF token" };
  return { ok: true };
}

export function hasValidOrigin(
  request: NextRequest,
  origin = request.headers.get("origin"),
): boolean {
  if (!origin) return true;
  try {
    return new URL(origin).origin === getCanonicalAppUrl(request).origin;
  } catch {
    return false;
  }
}

export function randomToken(): string {
  return (
    crypto.randomUUID().replaceAll("-", "") +
    crypto.randomUUID().replaceAll("-", "")
  );
}
