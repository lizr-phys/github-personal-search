import { ALGORITHM_VERSIONS } from "@/config/algorithms";
import type {
  Evidence,
  InterestProfile,
  RankingFeatures,
  Repository,
  SearchIntent,
} from "@/domain/types";

export type Explanation = {
  text: string;
  evidence: Evidence[];
  version: string;
};

export class ExplanationBuilder {
  readonly version = ALGORITHM_VERSIONS.explanation;

  forSearch(
    repository: Repository,
    intent: SearchIntent,
    features: RankingFeatures,
  ): Explanation {
    const reasons: string[] = [];
    const evidence: Evidence[] = [];
    const matchedDomain = repository.domains.find((domain) =>
      intent.domains.includes(domain),
    );
    const matchedTechnology = repository.technologies.find((technology) =>
      intent.technologies.some(
        (candidate) =>
          technology.toLowerCase().includes(candidate.toLowerCase()) ||
          candidate.toLowerCase().includes(technology.toLowerCase()),
      ),
    );
    if (matchedDomain) {
      reasons.push(`用途：${matchedDomain}`);
      evidence.push(
        repository.evidence.find((item) => item.type === "topic") ??
          repository.evidence[0]!,
      );
    }
    if (matchedTechnology) {
      reasons.push(`技术：${matchedTechnology}`);
      evidence.push(
        repository.evidence.find((item) => item.type === "readme") ??
          repository.evidence[0]!,
      );
    }
    if (features.freshness > 0.7) {
      reasons.push(`近 7 日热度：${repository.trend7d.heat.toFixed(2)}`);
      evidence.push({
        type: "metadata",
        label: "仓库快照趋势",
        source: `demo:snapshot:${repository.fullName}:7d`,
        confidence: 0.9,
      });
    }
    if (!reasons.length && features.lexical > 0) {
      reasons.push("名称或 README 与查询词匹配");
      evidence.push(
        repository.evidence.find((item) => item.type === "readme") ??
          repository.evidence[0]!,
      );
    }
    if (!reasons.length)
      return {
        text: "证据只支持弱相关，请以 README 为准。",
        evidence: [],
        version: this.version,
      };
    return {
      text: reasons.slice(0, 2).join("；") + "。",
      evidence: evidence.slice(0, 2),
      version: this.version,
    };
  }

  forFeed(
    repository: Repository,
    profile: InterestProfile,
    features: RankingFeatures,
  ): Explanation {
    const matchedLongTerm = Object.keys(profile.longTerm).find(
      (term) =>
        repository.domains.includes(term) || repository.topics.includes(term),
    );
    const matchedShortTerm = Object.keys(profile.shortTerm).find(
      (term) =>
        repository.domains.includes(term) || repository.topics.includes(term),
    );
    const evidence: Evidence[] = [];
    const reasons: string[] = [];
    if (matchedShortTerm && features.shortTerm > 0) {
      reasons.push(`近期关注：${matchedShortTerm}`);
      evidence.push({
        type: "profile",
        label: "短期兴趣",
        source: `profile:short-term:${matchedShortTerm}`,
        confidence: 0.92,
      });
    } else if (matchedLongTerm && features.longTerm > 0) {
      reasons.push(`长期关注：${matchedLongTerm}`);
      evidence.push({
        type: "profile",
        label: "长期兴趣",
        source: `profile:long-term:${matchedLongTerm}`,
        confidence: 0.9,
      });
    }
    if (profile.languages[repository.language]) {
      reasons.push(`常用语言：${repository.language}`);
      evidence.push({
        type: "profile",
        label: "语言偏好",
        source: `profile:language:${repository.language}`,
        confidence: 0.9,
      });
    }
    if (!reasons.length && features.exploration > 0.65) {
      reasons.push("相邻方向探索");
      evidence.push({
        type: "metadata",
        label: "探索配额",
        source: `ranking:exploration:${repository.id}`,
        confidence: 0.8,
      });
    }
    if (!reasons.length)
      return {
        text: "质量与趋势达标，暂无个人偏好依据。",
        evidence: [repository.evidence[0]!],
        version: this.version,
      };
    return {
      text: reasons.slice(0, 2).join("，") + "。",
      evidence: [...evidence, repository.evidence[0]!].slice(0, 3),
      version: this.version,
    };
  }
}

export const explanationBuilder = new ExplanationBuilder();
