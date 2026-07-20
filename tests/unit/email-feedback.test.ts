import { describe, expect, it } from "vitest";

import { signEmailFeedback, verifyEmailFeedback } from "@/mail/feedback-token";

describe("signed email feedback", () => {
  it("round-trips a signed action and rejects tampering or expiration", () => {
    const token = signEmailFeedback({
      emailId: "mail-1",
      repositoryId: "repo-1",
      action: "favorite",
      expiresAt: Date.now() + 60_000,
    });
    expect(verifyEmailFeedback(token)?.action).toBe("favorite");
    expect(verifyEmailFeedback(`${token}x`)).toBeUndefined();
    expect(
      verifyEmailFeedback(
        signEmailFeedback({
          emailId: "mail-1",
          repositoryId: "repo-1",
          action: "expand",
          expiresAt: Date.now() - 1,
        }),
      ),
    ).toBeUndefined();
  });
});
