import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import {
  apiError,
  isResponse,
  requireMutation,
  requireUser,
} from "@/server/http";
import { runtimeStore } from "@/server/runtime/store";

const ProfilePatchSchema = z.object({
  searchAffectsProfile: z.boolean().optional(),
  paused: z.boolean().optional(),
  removeLongTerm: z.string().max(80).optional(),
  removeShortTerm: z.string().max(80).optional(),
  blockedLanguages: z.array(z.string().max(40)).max(20).optional(),
  blockedOrganizations: z.array(z.string().max(80)).max(50).optional(),
  blockedTypes: z
    .array(
      z.enum([
        "application",
        "library",
        "framework",
        "template",
        "tutorial",
        "tool",
      ]),
    )
    .max(6)
    .optional(),
});

export async function GET(request: NextRequest) {
  const user = requireUser(request);
  if (isResponse(user)) return user;
  const state = await runtimeStore.read();
  return NextResponse.json({
    profile: state.profile,
    recentChanges: state.profile.sources.slice(0, 20),
    interactions: state.interactions
      .filter((item) => !item.undoneAt)
      .slice(-20)
      .reverse(),
  });
}

export async function PATCH(request: NextRequest) {
  const user = requireUser(request);
  if (isResponse(user)) return user;
  const rejection = requireMutation(request);
  if (rejection) return rejection;
  try {
    const input = ProfilePatchSchema.parse(await request.json());
    const profile = await runtimeStore.mutate((state) => {
      if (input.searchAffectsProfile !== undefined)
        state.profile.searchAffectsProfile = input.searchAffectsProfile;
      if (input.removeLongTerm)
        delete state.profile.longTerm[input.removeLongTerm];
      if (input.removeShortTerm)
        delete state.profile.shortTerm[input.removeShortTerm];
      if (input.blockedLanguages)
        state.profile.blockedLanguages = input.blockedLanguages;
      if (input.blockedOrganizations)
        state.profile.blockedOrganizations = input.blockedOrganizations;
      if (input.blockedTypes) state.profile.blockedTypes = input.blockedTypes;
      if (input.paused)
        state.profile.sources.unshift({
          label: "画像已暂停",
          detail: "推荐仅使用基础质量和趋势",
          at: new Date().toISOString(),
        });
      return state.profile;
    });
    return NextResponse.json({ ok: true, profile });
  } catch (error) {
    if (error instanceof z.ZodError)
      return NextResponse.json(
        { error: { code: "VALIDATION", message: "画像更新无效。" } },
        { status: 400 },
      );
    return apiError(error);
  }
}
