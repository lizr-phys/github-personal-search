import { NextResponse, type NextRequest } from "next/server";

import { verifyEmailFeedback } from "@/mail/feedback-token";
import { findRepositoryById } from "@/server/repositories/catalog";
import { runtimeStore } from "@/server/runtime/store";
import { recordInteraction } from "@/server/services/interaction-service";

export async function GET(request: NextRequest) {
  const payload = verifyEmailFeedback(
    request.nextUrl.searchParams.get("token") ?? "",
  );
  if (!payload)
    return NextResponse.json(
      {
        error: {
          code: "INVALID_EMAIL_TOKEN",
          message: "邮件反馈链接无效或已过期。",
        },
      },
      { status: 400 },
    );
  const state = await runtimeStore.read();
  if (
    !state.emails.some(
      (item) =>
        item.id === payload.emailId &&
        item.repositoryIds.includes(payload.repositoryId),
    )
  )
    return NextResponse.json(
      { error: { code: "EMAIL_NOT_FOUND", message: "邮件投递记录不存在。" } },
      { status: 404 },
    );
  const repository = await findRepositoryById(payload.repositoryId);
  if (!repository)
    return NextResponse.json(
      { error: { code: "REPOSITORY_NOT_FOUND", message: "项目不存在。" } },
      { status: 404 },
    );
  await recordInteraction({
    repositoryId: payload.repositoryId,
    type: payload.action,
    surface: "email",
    sessionId: `email:${payload.emailId}`,
  });
  const destination =
    payload.action === "favorite"
      ? "/library"
      : `/repository/${repository.owner}/${repository.name}?source=email`;
  return NextResponse.redirect(new URL(destination, request.url));
}
