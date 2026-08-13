import { evaluateSearchRanking, type SearchEvaluationCase, type SearchEvaluationMetrics } from "./hybrid-search";
import {
  supportsEvaluationStage,
  type SemanticEvaluationStage,
  type SemanticEvaluationTrack,
  type SemanticModelDescriptor,
} from "./semantic-model-registry";

export interface SemanticEvaluationPlanItem {
  modelId: string;
  track: SemanticEvaluationTrack;
  stage: SemanticEvaluationStage;
  status: "ready" | "benchmark-only" | "experimental" | "unsupported";
}

export interface RecordedSemanticEvaluationRun {
  modelId: string;
  track: SemanticEvaluationTrack;
  stage: SemanticEvaluationStage;
  cases: readonly SearchEvaluationCase[];
  latencyMilliseconds: readonly number[];
  attemptedRequests: number;
  failedRequests: number;
}

export interface CompletedSemanticEvaluation {
  modelId: string;
  track: SemanticEvaluationTrack;
  stage: SemanticEvaluationStage;
  status: "completed";
  metrics: SearchEvaluationMetrics;
  p95LatencyMilliseconds: number;
  failureRate: number;
}

export interface UnsupportedSemanticEvaluation {
  modelId: string;
  track: SemanticEvaluationTrack;
  stage: SemanticEvaluationStage;
  status: "unsupported";
}

export type SemanticEvaluationResult = CompletedSemanticEvaluation | UnsupportedSemanticEvaluation;

export function createSemanticEvaluationPlan(
  models: readonly SemanticModelDescriptor[],
  tracks: readonly SemanticEvaluationTrack[] = ["image-to-image", "text-to-image"],
  stages: readonly SemanticEvaluationStage[] = ["retrieval", "reranking", "caption-bridge"],
): SemanticEvaluationPlanItem[] {
  return models.flatMap((model) => tracks.flatMap((track) => stages.map((stage) => ({
    modelId: model.id,
    track,
    stage,
    status: !supportsEvaluationStage(model, track, stage)
      ? "unsupported" as const
      : stage === "caption-bridge" ? "experimental" as const
      : model.lifecycle === "deprecated" ? "benchmark-only" as const : "ready" as const,
  }))));
}

export function percentile95(values: readonly number[]) {
  const valid = values.filter((value) => Number.isFinite(value) && value >= 0).sort((left, right) => left - right);
  if (valid.length === 0) return 0;
  return valid[Math.ceil(valid.length * 0.95) - 1];
}

export function evaluateRecordedSemanticRun(
  model: SemanticModelDescriptor,
  run: RecordedSemanticEvaluationRun,
  k = 10,
): SemanticEvaluationResult {
  if (run.modelId !== model.id) throw new Error("Recorded evaluation model id does not match the descriptor");
  if (!supportsEvaluationStage(model, run.track, run.stage)) {
    return { modelId: model.id, track: run.track, stage: run.stage, status: "unsupported" };
  }
  if (!Number.isInteger(run.attemptedRequests) || run.attemptedRequests < 0) {
    throw new Error("attemptedRequests must be a non-negative integer");
  }
  if (!Number.isInteger(run.failedRequests) || run.failedRequests < 0 || run.failedRequests > run.attemptedRequests) {
    throw new Error("failedRequests must be between zero and attemptedRequests");
  }

  return {
    modelId: model.id,
    track: run.track,
    stage: run.stage,
    status: "completed",
    metrics: evaluateSearchRanking(run.cases, k),
    p95LatencyMilliseconds: percentile95(run.latencyMilliseconds),
    failureRate: run.attemptedRequests === 0 ? 0 : run.failedRequests / run.attemptedRequests,
  };
}
