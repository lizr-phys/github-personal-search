import { NextResponse, type NextRequest } from "next/server";

import { requireMutation } from "@/server/http";
import { runtimeStore } from "@/server/runtime/store";

export async function POST(request: NextRequest) {
  if (process.env.GPS_ENABLE_TEST_RESET !== "true")
    return NextResponse.json(
      { error: { code: "DISABLED", message: "Test reset is disabled" } },
      { status: 404 },
    );
  const rejection = requireMutation(request);
  if (rejection) return rejection;
  await runtimeStore.reset();
  return NextResponse.json({ ok: true });
}
