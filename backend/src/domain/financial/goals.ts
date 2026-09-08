import { daysBetween, isDateOnOrBefore, parseUtcDate } from './dates.js';
import { formatSatang, gcd, roundRationalHalfUp, tryParseSatang } from './money.js';
import type { GoalEvaluationResult, GoalInput } from './types.js';

export interface GoalsComponentResult {
  score: number | null;
  missingFields: string[];
  evaluatedGoals: GoalEvaluationResult[];
}

/**
 * Exact rational representation for intermediate calculations.
 * Invariant: denominator > 0n.
 */
export interface ExactRatio {
  readonly numerator: bigint;
  readonly denominator: bigint;
}

/**
 * Deterministic ordinal comparator for Goal entities:
 * 1. targetDate ascending (earlier date first)
 * 2. id ascending (lexical/ordinal code-point comparison, locale-independent)
 */
export function compareGoalTargetDateThenId(
  a: { targetDate: string; id: string },
  b: { targetDate: string; id: string }
): number {
  if (a.targetDate !== b.targetDate) {
    return a.targetDate < b.targetDate ? -1 : 1;
  }
  return a.id < b.id ? -1 : (a.id > b.id ? 1 : 0);
}

interface GoalEvaluationInternal {
  readonly result: GoalEvaluationResult;
  readonly missingFields: string[];
  readonly exactRatio?: ExactRatio;
}

/**
 * Internal single-pass validation and evaluation of a GoalInput.
 * Returns public GoalEvaluationResult (completely JSON-safe, no BigInt),
 * validation field errors, and internal ExactRatio if valid.
 */
function evaluateGoalInternal(goal: GoalInput, asOfDate: string): GoalEvaluationInternal {
  // Validate asOfDate format (throws if invalid caller date)
  parseUtcDate(asOfDate);

  const missingOrInvalidFields: string[] = [];
  const targetSatang = tryParseSatang(goal.targetAmount);
  if (targetSatang === null || targetSatang <= 0n) {
    missingOrInvalidFields.push(`goals[${goal.id}].targetAmount`);
  }

  const currentSatang = tryParseSatang(goal.currentAmount);
  if (currentSatang === null || currentSatang < 0n) {
    missingOrInvalidFields.push(`goals[${goal.id}].currentAmount`);
  }

  let validDates = true;
  try {
    parseUtcDate(goal.startDate);
  } catch {
    missingOrInvalidFields.push(`goals[${goal.id}].startDate`);
    validDates = false;
  }

  try {
    parseUtcDate(goal.targetDate);
  } catch {
    missingOrInvalidFields.push(`goals[${goal.id}].targetDate`);
    validDates = false;
  }

  if (validDates) {
    const totalDays = daysBetween(goal.startDate, goal.targetDate);
    if (totalDays <= 0) {
      missingOrInvalidFields.push(`goals[${goal.id}].targetDate`);
    }
  }

  if (missingOrInvalidFields.length > 0 || targetSatang === null || targetSatang <= 0n || currentSatang === null || currentSatang < 0n) {
    return {
      result: {
        id: goal.id,
        goalType: goal.goalType,
        targetAmount: goal.targetAmount,
        currentAmount: goal.currentAmount,
        startDate: goal.startDate,
        targetDate: goal.targetDate,
        isValid: false,
        expectedAmount: '0.00',
        cappedProgress: 0,
        isBehind: false,
        isCompleted: false,
        daysRemaining: 0,
      },
      missingFields: missingOrInvalidFields,
    };
  }

  const totalDays = daysBetween(goal.startDate, goal.targetDate);
  const daysRemaining = daysBetween(asOfDate, goal.targetDate);
  const isCompleted = currentSatang >= targetSatang;

  // Case 1: asOfDate <= startDate (not started yet or on start date)
  if (isDateOnOrBefore(asOfDate, goal.startDate)) {
    return {
      result: {
        id: goal.id,
        goalType: goal.goalType,
        targetAmount: formatSatang(targetSatang),
        currentAmount: formatSatang(currentSatang),
        startDate: goal.startDate,
        targetDate: goal.targetDate,
        isValid: true,
        expectedAmount: '0.00',
        cappedProgress: 1,
        isBehind: false,
        isCompleted,
        daysRemaining,
      },
      missingFields: [],
      exactRatio: { numerator: 1n, denominator: 1n },
    };
  }

  // Case 2: asOfDate >= targetDate (target date reached or passed)
  if (isDateOnOrBefore(goal.targetDate, asOfDate)) {
    const cappedSatang = currentSatang < targetSatang ? currentSatang : targetSatang;
    const progress = Number(cappedSatang) / Number(targetSatang);
    const isBehind = currentSatang < targetSatang;

    return {
      result: {
        id: goal.id,
        goalType: goal.goalType,
        targetAmount: formatSatang(targetSatang),
        currentAmount: formatSatang(currentSatang),
        startDate: goal.startDate,
        targetDate: goal.targetDate,
        isValid: true,
        expectedAmount: formatSatang(targetSatang),
        cappedProgress: progress,
        isBehind,
        isCompleted,
        daysRemaining,
      },
      missingFields: [],
      exactRatio: { numerator: cappedSatang, denominator: targetSatang },
    };
  }

  // Case 3: startDate < asOfDate < targetDate (in progress)
  const elapsedDays = daysBetween(goal.startDate, asOfDate);

  // Exact rational comparison for isBehind: current < (target * elapsed / total)
  // <=> current * total < target * elapsed
  const isBehind = currentSatang * BigInt(totalDays) < targetSatang * BigInt(elapsedDays);

  // Progress = current / expected = (current * total) / (target * elapsed)
  const currentScaled = currentSatang * BigInt(totalDays);
  const targetScaled = targetSatang * BigInt(elapsedDays);
  const cappedScaled = currentScaled < targetScaled ? currentScaled : targetScaled;
  const progress = targetScaled > 0n ? Number(cappedScaled) / Number(targetScaled) : 1;

  // Expected amount formatted as decimal string using exact half-up satang
  const expectedSatang =
    (targetSatang * BigInt(elapsedDays) * 2n + BigInt(totalDays)) / (BigInt(totalDays) * 2n);

  return {
    result: {
      id: goal.id,
      goalType: goal.goalType,
      targetAmount: formatSatang(targetSatang),
      currentAmount: formatSatang(currentSatang),
      startDate: goal.startDate,
      targetDate: goal.targetDate,
      isValid: true,
      expectedAmount: formatSatang(expectedSatang),
      cappedProgress: progress,
      isBehind,
      isCompleted,
      daysRemaining,
    },
    missingFields: [],
    exactRatio: { numerator: cappedScaled, denominator: targetScaled },
  };
}

/**
 * Validates and evaluates a single goal against a given UTC asOfDate.
 * Returns public GoalEvaluationResult containing only JSON-safe primitives (no BigInt).
 */
export function evaluateGoal(goal: GoalInput, asOfDate: string): GoalEvaluationResult {
  return evaluateGoalInternal(goal, asOfDate).result;
}

/**
 * Validates all goals and evaluates them, computing the aggregated Goals component score (Max 15).
 * Guarantees single-pass evaluation for reuse across Health, Primary Goal, and NBA.
 */
export function evaluateGoals(goals: GoalInput[], asOfDate: string): GoalsComponentResult {
  // Always validate caller asOfDate first regardless of whether goals list is empty
  parseUtcDate(asOfDate);

  if (!goals || goals.length === 0) {
    return {
      score: null,
      missingFields: ['goals'],
      evaluatedGoals: [],
    };
  }

  const evaluated = goals.map((g) => evaluateGoalInternal(g, asOfDate));
  const missingFields = Array.from(new Set(evaluated.flatMap((e) => e.missingFields))).sort();

  if (missingFields.length > 0) {
    return {
      score: null,
      missingFields,
      evaluatedGoals: evaluated.map((e) => e.result),
    };
  }

  // Calculate sum of capped progress using exact BigInt rationals
  let sumNum = 0n;
  let sumDen = 1n;

  for (const item of evaluated) {
    if (!item.exactRatio || item.exactRatio.denominator <= 0n) {
      throw new Error(`Invariant violation: valid goal ${item.result.id} missing valid exactRatio`);
    }
    const { numerator: num, denominator: den } = item.exactRatio;

    const gGcd = gcd(sumDen, den);
    const term1 = sumNum * (den / gGcd);
    const term2 = num * (sumDen / gGcd);
    sumNum = term1 + term2;
    sumDen = (sumDen / gGcd) * den;

    const redGcd = gcd(sumNum, sumDen);
    if (redGcd > 1n) {
      sumNum /= redGcd;
      sumDen /= redGcd;
    }
  }

  // Score = 15 * (sumNum / sumDen) / evaluated.length
  const scoreNumerator = 15n * sumNum;
  const scoreDenominator = BigInt(evaluated.length) * sumDen;
  const score = roundRationalHalfUp(scoreNumerator, scoreDenominator, 2);

  return {
    score,
    missingFields: [],
    evaluatedGoals: evaluated.map((e) => e.result),
  };
}

/**
 * Validates all goals and computes the aggregated Goals component score (Max 15).
 * Backward-compatible alias for evaluateGoals.
 */
export function calculateGoalsScore(goals: GoalInput[], asOfDate: string): GoalsComponentResult {
  return evaluateGoals(goals, asOfDate);
}
