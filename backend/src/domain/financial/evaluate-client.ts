import { parseUtcDate } from './dates.js';
import { evaluateGoals } from './goals.js';
import { calculateHealthResult } from './health.js';
import { selectPrimaryGoal } from './primary-goal.js';
import { evaluateRecommendation } from './recommendation.js';
import { generateClientSummary } from './summary.js';
import type {
  ClientEvaluationInput,
  ClientEvaluationResult,
  PriorityLevel,
} from './types.js';

const PRIORITY_RANKS: Record<PriorityLevel, number> = {
  HIGH: 3,
  MEDIUM: 2,
  LOW: 1,
};

/**
 * Unified pure domain evaluation entrypoint for a client.
 * Strictly idempotent, free of side-effects, does not mutate input or catch programming errors.
 */
export function evaluateClient(
  input: ClientEvaluationInput,
  asOfDate: string
): ClientEvaluationResult {
  // Validate asOfDate format. If invalid, throws Error directly (not converted to INSUFFICIENT_DATA).
  parseUtcDate(asOfDate);

  const goalsResult = evaluateGoals(input.goals, asOfDate);
  const health = calculateHealthResult(input.financialProfile, goalsResult);
  const primaryGoal = selectPrimaryGoal(goalsResult.evaluatedGoals);
  const recommendation = evaluateRecommendation({
    health,
    profile: input.financialProfile,
    evaluatedGoals: goalsResult.evaluatedGoals,
  });
  const summary = generateClientSummary({
    health,
    primaryGoal,
    recommendation,
    goalsCount: input.goals.length,
  });

  return {
    client: input.client,
    financialProfile: input.financialProfile,
    goals: input.goals,
    primaryGoal,
    health,
    recommendation,
    summary,
    asOfDate,
  };
}

/**
 * Deterministic comparator for evaluated clients:
 * 1. Priority order: HIGH -> MEDIUM -> LOW
 * 2. Tie-break: customerCode in ordinal order (locale-independent)
 */
export function compareEvaluatedClients(
  a: ClientEvaluationResult,
  b: ClientEvaluationResult
): number {
  const rankDiff = PRIORITY_RANKS[b.recommendation.priority] - PRIORITY_RANKS[a.recommendation.priority];
  if (rankDiff !== 0) {
    return rankDiff;
  }

  // Exact ordinal string comparison independent of runtime locale
  if (a.client.customerCode < b.client.customerCode) return -1;
  if (a.client.customerCode > b.client.customerCode) return 1;
  return 0;
}
