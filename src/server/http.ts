import { NextResponse, type NextRequest } from "next/server";

import { getSession } from "@/server/session";
import { validateMutationRequest } from "@/server/security/csrf";

export function requireUser(
  request: NextRequest,
): { userId: string; sessionId: string } | NextResponse {
  const session = getSession(request);
  if (!session.userId)
    return NextResponse.json(
      {
        error: {
          code: "UNAUTHENTICATED",
          message: "请先进入演示模式或使用 GitHub 登录。",
        },
      },
      { status: 401 },
    );
  return { userId: session.userId, sessionId: session.sessionId };
}

export function requireMutation(
  request: NextRequest,
): NextResponse | undefined {
  const validation = validateMutationRequest(request);
  if (!validation.ok)
    return NextResponse.json(
      { error: { code: "CSRF", message: validation.message } },
      { status: 403 },
    );
  return undefined;
}

export function isResponse(value: unknown): value is NextResponse {
  return value instanceof NextResponse;
}

export function apiError(
  error: unknown,
  code = "INTERNAL_ERROR",
  status = 500,
): NextResponse {
  const message = error instanceof Error ? error.message : "Unexpected error";
  const requestId = crypto.randomUUID();
  console.error(
    JSON.stringify({
      level: "error",
      event: "api_error",
      code,
      message,
      requestId,
    }),
  );
  return NextResponse.json(
    {
      error: {
        code,
        message: status >= 500 ? "服务暂时不可用，请稍后重试。" : message,
        requestId,
      },
    },
    { status },
  );
}
