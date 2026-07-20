import { ALGORITHM_VERSIONS } from "@/config/algorithms";

export type TrendInput = {
  id: string;
  starsDelta: number;
  forksDelta: number;
  commitsDelta: number;
  issuesPrsDelta: number;
  releaseSignal: number;
  ageDays: number;
};

export type TrendScore = TrendInput & { heat: number; version: string };

function zScores(values: number[]): number[] {
  const mean =
    values.reduce((sum, value) => sum + value, 0) / Math.max(values.length, 1);
  const variance =
    values.reduce((sum, value) => sum + (value - mean) ** 2, 0) /
    Math.max(values.length, 1);
  const deviation = Math.sqrt(variance);
  return values.map((value) => (deviation ? (value - mean) / deviation : 0));
}

export class TrendCalculator {
  readonly version = ALGORITHM_VERSIONS.trend;

  calculate(group: TrendInput[]): TrendScore[] {
    const starZ = zScores(
      group.map(
        (item) => item.starsDelta / Math.sqrt(Math.max(1, item.ageDays)),
      ),
    );
    const forkZ = zScores(
      group.map(
        (item) => item.forksDelta / Math.sqrt(Math.max(1, item.ageDays)),
      ),
    );
    const commitZ = zScores(group.map((item) => item.commitsDelta));
    const issueZ = zScores(group.map((item) => item.issuesPrsDelta));
    return group.map((item, index) => ({
      ...item,
      heat: Number(
        (
          0.38 * (starZ[index] ?? 0) +
          0.15 * (forkZ[index] ?? 0) +
          0.15 * (commitZ[index] ?? 0) +
          0.12 * (issueZ[index] ?? 0) +
          0.1 * item.releaseSignal +
          0.1 * Math.max(0, 1 - item.ageDays / 365)
        ).toFixed(6),
      ),
      version: this.version,
    }));
  }
}

export const trendCalculator = new TrendCalculator();
