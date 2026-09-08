import {
  calculateDebtScore,
  calculateInvestmentScore,
  calculateLiquidityScore,
  calculateSavingsScore,
} from './components.js';
import { calculateGoalsScore, type GoalsComponentResult } from './goals.js';
import { roundHalfUp } from './money.js';
import type {
  FinancialProfileInput,
  GoalInput,
  HealthClassification,
  HealthResult,
  HealthScoreBreakdown,
} from './types.js';

export interface HealthEvaluationContext {
  profile: FinancialProfileInput | null;
  goals: GoalInput[];
  asOfDate: string;
}

/**
 * Aggregates the 5 financial components into a complete HealthResult.
 * Can accept either raw GoalInput[] (with asOfDate) or a pre-evaluated GoalsComponentResult.
 * If any component is null, status is INSUFFICIENT_DATA, score is null, and missingFields are exposed.
 */
export function calculateHealthResult(
  profile: FinancialProfileInput | null,
  goalsOrResult: GoalInput[] | GoalsComponentResult,
  asOfDate?: string
): HealthResult {
  const liquidity = calculateLiquidityScore(profile);
  const debt = calculateDebtScore(profile);
  const savings = calculateSavingsScore(profile);
  const investment = calculateInvestmentScore(profile);
  const goalsResult = Array.isArray(goalsOrResult)
    ? calculateGoalsScore(goalsOrResult, asOfDate!)
    : goalsOrResult;

  const breakdown: HealthScoreBreakdown = {
    liquidity: liquidity.score,
    debt: debt.score,
    savings: savings.score,
    goals: goalsResult.score,
    investment: investment.score,
  };

  const isComplete =
    liquidity.score !== null &&
    debt.score !== null &&
    savings.score !== null &&
    goalsResult.score !== null &&
    investment.score !== null;

  if (!isComplete) {
    const missingFieldsSet = new Set<string>();

    if (!profile) {
      missingFieldsSet.add('financialProfile');
    } else {
      liquidity.missingFields.forEach((f) => missingFieldsSet.add(f));
      debt.missingFields.forEach((f) => missingFieldsSet.add(f));
      savings.missingFields.forEach((f) => missingFieldsSet.add(f));
      investment.missingFields.forEach((f) => missingFieldsSet.add(f));
    }

    goalsResult.missingFields.forEach((f) => missingFieldsSet.add(f));

    const sortedMissingFields = Array.from(missingFieldsSet).sort();

    return {
      score: null,
      classification: null,
      status: 'INSUFFICIENT_DATA',
      missingFields: sortedMissingFields,
      breakdown,
    };
  }

  // All 5 components are valid
  const rawTotal =
    liquidity.score! + debt.score! + savings.score! + goalsResult.score! + investment.score!;
  const score = roundHalfUp(rawTotal, 2);

  let classification: HealthClassification;
  if (score >= 80) {
    classification = 'GOOD';
  } else if (score >= 60) {
    classification = 'MODERATE';
  } else {
    classification = 'AT_RISK';
  }

  return {
    score,
    classification,
    status: 'COMPLETE',
    missingFields: [],
    breakdown,
  };
}
