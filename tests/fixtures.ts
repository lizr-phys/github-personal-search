import type { InterestProfile } from "@/domain/types";

export function profile(
  overrides: Partial<InterestProfile> = {},
): InterestProfile {
  return {
    completed: true,
    longTerm: { "scientific-computing": 2.5, visualization: 1.8, webgpu: 1.2 },
    shortTerm: { "physics-education": 1.5 },
    languages: { TypeScript: 2, Python: 1.8 },
    difficulty: "medium",
    blockedLanguages: [],
    blockedOrganizations: [],
    blockedTypes: [],
    searchAffectsProfile: true,
    sources: [],
    ...overrides,
  };
}

export const onboardingFeedback = [
  "qutip-qutip",
  "qmsolve-qmsolve",
  "phetsims-energy-skate-park",
  "falstad-circuitjs1",
  "geogebra-geogebra",
  "manimcommunity-manim",
  "jupyterlab-jupyterlab",
  "pyodide-pyodide",
  "matplotlib-matplotlib",
  "scikit-image-scikit-image",
].map((repositoryId, index) => ({
  repositoryId,
  type: index % 4 === 0 ? ("learn" as const) : ("interested" as const),
}));
