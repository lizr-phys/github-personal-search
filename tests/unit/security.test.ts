import { createHmac } from "node:crypto";

import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { GET as proxyImage } from "@/app/api/image/route";
import { POST as githubWebhook } from "@/app/api/github/webhook/route";
import { apiError } from "@/server/http";
import {
  hasValidOrigin,
  validateMutationRequest,
} from "@/server/security/csrf";
import {
  createSessionToken,
  verifySessionToken,
} from "@/server/security/session-token";

describe("security boundaries", () => {
  beforeEach(() => {
    process.env.APP_URL = "http://localhost:3000";
    process.env.SESSION_SECRET = "test-session-secret-with-at-least-32-chars";
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    delete process.env.GITHUB_WEBHOOK_SECRET;
  });

  it("signs sessions and rejects tampering or expiry", () => {
    const valid = createSessionToken("demo-user", "session-a", 60);
    expect(verifySessionToken(valid)).toMatchObject({
      userId: "demo-user",
      sessionId: "session-a",
    });
    expect(verifySessionToken(`${valid.slice(0, -1)}x`)).toBeUndefined();
    expect(
      verifySessionToken(createSessionToken("demo-user", "expired", -1)),
    ).toBeUndefined();
  });

  it("uses canonical APP_URL instead of attacker-controlled Host", () => {
    const request = new NextRequest("http://attacker.example/api/search", {
      headers: { host: "attacker.example", origin: "http://attacker.example" },
    });
    expect(hasValidOrigin(request)).toBe(false);
    const valid = new NextRequest("http://localhost:3000/api/search", {
      headers: {
        origin: "http://localhost:3000",
        cookie: "gps_csrf=token",
        "x-gps-csrf": "token",
      },
    });
    expect(validateMutationRequest(valid)).toEqual({ ok: true });
  });

  it("allows HTTP only for a loopback production preview", () => {
    vi.stubEnv("NODE_ENV", "production");
    try {
      process.env.APP_URL = "http://127.0.0.1:3200";
      expect(
        hasValidOrigin(
          new NextRequest("http://127.0.0.1:3200/api/search", {
            headers: { origin: "http://127.0.0.1:3200" },
          }),
        ),
      ).toBe(true);
      process.env.APP_URL = "http://gps.example.com";
      expect(
        hasValidOrigin(
          new NextRequest("http://gps.example.com/api/search", {
            headers: { origin: "http://gps.example.com" },
          }),
        ),
      ).toBe(false);
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it("blocks non-HTTPS and non-allowlisted image proxy targets before fetching", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const response = await proxyImage(
      new NextRequest(
        "http://localhost:3000/api/image?url=http%3A%2F%2F127.0.0.1%2Fsecret",
      ),
    );
    expect(response.status).toBe(403);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("returns a generic 5xx response while retaining a request id", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const response = apiError(new Error("database password leaked in stack"));
    const payload = await response.json();
    expect(payload.error.message).not.toContain("password");
    expect(payload.error.requestId).toMatch(/[0-9a-f-]{36}/);
  });

  it("rejects oversized and invalid signed webhook bodies safely", async () => {
    process.env.GITHUB_WEBHOOK_SECRET = "webhook-test-secret";
    const oversized = await githubWebhook(
      new NextRequest("http://localhost:3000/api/github/webhook", {
        method: "POST",
        headers: { "content-length": String(1024 * 1024 + 1) },
        body: "x",
      }),
    );
    expect(oversized.status).toBe(413);

    const body = "not-json";
    const signature = `sha256=${createHmac("sha256", process.env.GITHUB_WEBHOOK_SECRET).update(body).digest("hex")}`;
    const invalid = await githubWebhook(
      new NextRequest("http://localhost:3000/api/github/webhook", {
        method: "POST",
        headers: { "x-hub-signature-256": signature, "x-github-event": "push" },
        body,
      }),
    );
    expect(invalid.status).toBe(400);
  });
});
