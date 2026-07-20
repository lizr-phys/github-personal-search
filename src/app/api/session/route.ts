import { NextResponse, type NextRequest } from "next/server";

import { getSession } from "@/server/session";
import { runtimeStore } from "@/server/runtime/store";
import { getRepositoryCatalog } from "@/server/repositories/catalog";

export async function GET(request: NextRequest) {
  const session = getSession(request);
  if (!session.userId)
    return NextResponse.json({ authenticated: false, mode: "demo" });
  const [state, catalog] = await Promise.all([
    runtimeStore.read(),
    getRepositoryCatalog(),
  ]);
  return NextResponse.json({
    authenticated: true,
    mode: state.user.isDemo ? "demo" : "github",
    user: {
      id: state.user.id,
      displayName: state.user.displayName,
      githubLogin: state.user.githubLogin,
      githubScopes: state.user.githubScopes,
      importedStarsCount: state.user.importedStars.length,
    },
    profile: state.profile,
    sessionId: session.sessionId,
    githubSync: state.githubSync,
    catalog: {
      mode: catalog.mode,
      githubCount: catalog.githubCount,
      demoCount: catalog.demoCount,
      dataUpdatedAt: catalog.dataUpdatedAt,
    },
    dataScope: state.user.githubLogin
      ? [
          "GitHub public profile",
          "public Stars",
          "public repository metadata/Topics/languages",
          "README and latest Release for explicitly refreshed repositories",
        ]
      : [
          "Public GitHub repository search on explicit request",
          "GPS demo repositories",
          "GPS interactions",
          "GPS knowledge library",
        ],
  });
}
