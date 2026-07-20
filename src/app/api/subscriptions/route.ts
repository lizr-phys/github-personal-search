import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { SearchIntentSchema } from "@/domain/types";
import {
  apiError,
  isResponse,
  requireMutation,
  requireUser,
} from "@/server/http";
import {
  createSubscription,
  listSubscriptions,
} from "@/server/services/subscription-service";

const SubscriptionSchema = z.object({
  name: z.string().trim().min(1).max(100),
  rawQuery: z.string().trim().min(1).max(300),
  intent: SearchIntentSchema,
  frequency: z.enum(["daily", "weekly", "monthly"]).default("weekly"),
  minRelevance: z.number().min(0).max(1).default(0.55),
  minQuality: z.number().min(0).max(1).default(0.7),
  heatThreshold: z.number().min(-3).max(3).default(0),
});

export async function GET(request: NextRequest) {
  const user = requireUser(request);
  if (isResponse(user)) return user;
  return NextResponse.json({ items: await listSubscriptions() });
}

export async function POST(request: NextRequest) {
  const user = requireUser(request);
  if (isResponse(user)) return user;
  const rejection = requireMutation(request);
  if (rejection) return rejection;
  try {
    return NextResponse.json({
      ok: true,
      subscription: await createSubscription(
        SubscriptionSchema.parse(await request.json()),
      ),
    });
  } catch (error) {
    if (error instanceof z.ZodError)
      return NextResponse.json(
        {
          error: {
            code: "VALIDATION",
            message: "订阅条件无效。",
            issues: error.issues,
          },
        },
        { status: 400 },
      );
    return apiError(error);
  }
}
