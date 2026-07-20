import { createHmac, timingSafeEqual } from "node:crypto";

import type { InteractionType } from "@/domain/types";

export type EmailFeedbackPayload = {
  emailId: string;
  repositoryId: string;
  action: Extract<InteractionType, "expand" | "favorite" | "not_interested">;
  expiresAt: number;
};

function secret(): string {
  return process.env.SESSION_SECRET || "gps-development-only-secret";
}

export function signEmailFeedback(payload: EmailFeedbackPayload): string {
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = createHmac("sha256", secret())
    .update(encoded)
    .digest("base64url");
  return `${encoded}.${signature}`;
}

export function verifyEmailFeedback(
  token: string,
): EmailFeedbackPayload | undefined {
  const [encoded, signature] = token.split(".");
  if (!encoded || !signature) return undefined;
  const expected = createHmac("sha256", secret()).update(encoded).digest();
  const received = Buffer.from(signature, "base64url");
  if (
    expected.length !== received.length ||
    !timingSafeEqual(expected, received)
  )
    return undefined;
  try {
    const payload = JSON.parse(
      Buffer.from(encoded, "base64url").toString("utf8"),
    ) as EmailFeedbackPayload;
    if (
      !payload.emailId ||
      !payload.repositoryId ||
      !["expand", "favorite", "not_interested"].includes(payload.action) ||
      payload.expiresAt < Date.now()
    )
      return undefined;
    return payload;
  } catch {
    return undefined;
  }
}
