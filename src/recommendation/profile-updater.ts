import { INTERACTION_WEIGHTS } from "@/config/algorithms";
import type {
  InteractionType,
  InterestProfile,
  Repository,
} from "@/domain/types";
import { clamp } from "@/search/text";

export class UserProfileUpdater {
  apply(
    profile: InterestProfile,
    repository: Repository,
    type: InteractionType,
    undo = false,
  ): InterestProfile {
    const multiplier = undo ? -1 : 1;
    const weight = INTERACTION_WEIGHTS[type] * multiplier;
    const next = structuredClone(profile);
    const normalized = weight / 4;
    const deepAction = [
      "favorite",
      "learn",
      "ran",
      "reproduced",
      "used",
    ].includes(type);
    const shortAction = [
      "interested",
      "open_github",
      "open_demo",
      "dwell",
      "expand",
    ].includes(type);
    // Repository health, complexity and language feedback are scoped to their
    // own feature. Only explicit dislike/block-similar modifies topic taste.
    const negativePreferenceAction =
      type === "not_interested" || type === "block_similar";

    for (const domain of repository.domains.slice(0, 3)) {
      if (deepAction || negativePreferenceAction)
        next.longTerm[domain] = Number(
          clamp((next.longTerm[domain] ?? 0) + normalized, -5, 8).toFixed(3),
        );
      if (shortAction || deepAction || negativePreferenceAction)
        next.shortTerm[domain] = Number(
          clamp(
            (next.shortTerm[domain] ?? 0) + normalized * 1.35,
            -5,
            8,
          ).toFixed(3),
        );
    }
    if (type === "language_mismatch" && !undo) {
      if (!next.blockedLanguages.includes(repository.language))
        next.blockedLanguages.push(repository.language);
    } else if (type === "language_mismatch" && undo) {
      next.blockedLanguages = next.blockedLanguages.filter(
        (language) => language !== repository.language,
      );
    } else if (weight > 0) {
      next.languages[repository.language] = Number(
        clamp(
          (next.languages[repository.language] ?? 0) + normalized,
          -5,
          8,
        ).toFixed(3),
      );
    }
    next.sources.unshift({
      label: undo ? "撤销反馈" : "项目反馈",
      detail: `${type}: ${repository.fullName}`,
      at: new Date().toISOString(),
    });
    next.sources = next.sources.slice(0, 30);
    return next;
  }
}

export const userProfileUpdater = new UserProfileUpdater();
