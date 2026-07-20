import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { isResponse, requireMutation, requireUser } from "@/server/http";
import { updateSubscription } from "@/server/services/subscription-service";

const UpdateSchema = z.object({
  enabled: z.boolean().optional(),
  frequency: z.enum(["daily", "weekly", "monthly"]).optional(),
});

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const user = requireUser(request);
  if (isResponse(user)) return user;
  const rejection = requireMutation(request);
  if (rejection) return rejection;
  const input = UpdateSchema.safeParse(await request.json());
  if (!input.success)
    return NextResponse.json(
      { error: { code: "VALIDATION", message: "订阅更新无效。" } },
      { status: 400 },
    );
  const subscription = await updateSubscription(
    (await context.params).id,
    input.data,
  );
  if (!subscription)
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "订阅不存在。" } },
      { status: 404 },
    );
  return NextResponse.json({ ok: true, subscription });
}
