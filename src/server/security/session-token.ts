import { createHmac, timingSafeEqual } from "node:crypto";

type SessionClaims = { userId: string; sessionId: string; expiresAt: number };

function secret(): string {
  const configured = process.env.SESSION_SECRET;
  if (configured && configured.length >= 32) return configured;
  if (process.env.NODE_ENV === "production")
    throw new Error(
      "SESSION_SECRET must contain at least 32 characters in production",
    );
  return "gps-local-development-session-secret-only";
}

function sign(payload: string): string {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

export function createSessionToken(
  userId: string,
  sessionId: string,
  maxAgeSeconds = 12 * 60 * 60,
): string {
  const payload = Buffer.from(
    JSON.stringify({
      userId,
      sessionId,
      expiresAt: Date.now() + maxAgeSeconds * 1000,
    } satisfies SessionClaims),
  ).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

export function verifySessionToken(token?: string): SessionClaims | undefined {
  if (!token) return undefined;
  const [payload, providedSignature] = token.split(".");
  if (!payload || !providedSignature) return undefined;
  const expectedSignature = sign(payload);
  const left = Buffer.from(providedSignature);
  const right = Buffer.from(expectedSignature);
  if (left.length !== right.length || !timingSafeEqual(left, right))
    return undefined;
  try {
    const claims = JSON.parse(
      Buffer.from(payload, "base64url").toString("utf8"),
    ) as Partial<SessionClaims>;
    if (
      typeof claims.userId !== "string" ||
      typeof claims.sessionId !== "string" ||
      typeof claims.expiresAt !== "number" ||
      claims.expiresAt <= Date.now()
    )
      return undefined;
    return claims as SessionClaims;
  } catch {
    return undefined;
  }
}
