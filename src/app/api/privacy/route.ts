import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { isResponse, requireMutation, requireUser } from "@/server/http";
import { applyPrivacyAction } from "@/server/services/privacy-service";

const PrivacySchema = z.object({
  action: z.enum([
    "clear_history",
    "reset_profile",
    "clear_imports",
    "delete_account",
    "revoke_github",
  ]),
});

export async function POST(request: NextRequest) {
  const user = requireUser(request);
  if (isResponse(user)) return user;
  const rejection = requireMutation(request);
  if (rejection) return rejection;
  const input = PrivacySchema.safeParse(await request.json());
  if (!input.success)
    return NextResponse.json(
      { error: { code: "VALIDATION", message: "隐私操作无效。" } },
      { status: 400 },
    );
  await applyPrivacyAction(input.data.action);
  const response = NextResponse.json({ ok: true, action: input.data.action });
  if (input.data.action === "delete_account") {
    response.cookies.delete("gps_user");
    response.cookies.delete("gps_session");
    response.cookies.delete("gps_auth");
    response.cookies.delete("gps_csrf");
  }
  return response;
}
