import { createHmac, timingSafeEqual } from "node:crypto";

import { NextResponse, type NextRequest } from "next/server";
import { handleJob } from "@/server/jobs/handlers";

export async function POST(request: NextRequest) {
  const secret = process.env.GITHUB_WEBHOOK_SECRET;
  if (!secret)
    return NextResponse.json(
      {
        error: { code: "NOT_CONFIGURED", message: "Webhook is not configured" },
      },
      { status: 503 },
    );
  const contentLength = Number.parseInt(
    request.headers.get("content-length") ?? "0",
    10,
  );
  if (contentLength > 1024 * 1024)
    return NextResponse.json(
      {
        error: {
          code: "PAYLOAD_TOO_LARGE",
          message: "Webhook payload is too large",
        },
      },
      { status: 413 },
    );
  const body = await request.text();
  if (Buffer.byteLength(body, "utf8") > 1024 * 1024)
    return NextResponse.json(
      {
        error: {
          code: "PAYLOAD_TOO_LARGE",
          message: "Webhook payload is too large",
        },
      },
      { status: 413 },
    );
  const signature = request.headers.get("x-hub-signature-256") ?? "";
  const expected = `sha256=${createHmac("sha256", secret).update(body).digest("hex")}`;
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b))
    return NextResponse.json(
      {
        error: {
          code: "INVALID_SIGNATURE",
          message: "Invalid webhook signature",
        },
      },
      { status: 401 },
    );
  const event = request.headers.get("x-github-event");
  let refresh: unknown;
  if (["push", "release", "repository"].includes(event ?? "")) {
    let payload: { repository?: { full_name?: string } };
    try {
      payload = JSON.parse(body) as { repository?: { full_name?: string } };
    } catch {
      return NextResponse.json(
        {
          error: {
            code: "INVALID_JSON",
            message: "Webhook payload is not valid JSON",
          },
        },
        { status: 400 },
      );
    }
    if (payload.repository?.full_name)
      refresh = await handleJob("refresh-repository", {
        fullName: payload.repository.full_name,
        source: "webhook",
      });
  }
  return NextResponse.json(
    {
      accepted: true,
      event,
      delivery: request.headers.get("x-github-delivery"),
      refresh,
    },
    { status: 202 },
  );
}
