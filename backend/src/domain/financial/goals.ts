import { daysBetween, isDateOnOrBefore, parseUtcDate } from './dates.js';
import { formatSatang, gcd, roundRationalHalfUp, tryParseSatang } from './money.js';
import type { GoalEvaluationResult, GoalInput } from './types.js';

export interface GoalsComponentResult {
  score: number | null;
  missingFields: string[];
  evaluatedGoals: GoalEvaluationResult[];
}

/**
 * Validates and evaluates a single goal against a given UTC asOfDate.
 */
export function evaluateGoal(goal: GoalInput, asOfDate: string): GoalEvaluationResult {
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
    };
  }

  const totalDays = daysBetween(goal.startDate, goal.targetDate);
  const daysRemaining = daysBetween(asOfDate, goal.targetDate);
  const isCompleted = currentSatang >= targetSatang;

  // Case 1: asOfDate <= startDate (not started yet or on start date)
  if (isDateOnOrBefore(asOfDate, goal.startDate)) {
    return {
      id: goal.id,
      goalType: goal.goalType,
      targetAmount: formatSatang(targetSatang),
      currentAmount: formatSatang(currentSatang),
      startDate: goal.startDate,
      targetDate: goal.targetDate,
      isValid: true,
      expectedAmount: '0.00',
      cappedProgress: 1,
      progressNumerator: 1n,
      progressDenominator: 1n,
      isBehind: false,
      isCompleted,
      daysRemaining,
    };
  }

  // Case 2: asOfDate >= targetDate (target date reached or passed)
  if (isDateOnOrBefore(goal.targetDate, asOfDate)) {
    const cappedSatang = currentSatang < targetSatang ? currentSatang : targetSatang;
    const progress = Number(cappedSatang) / Number(targetSatang);
    const isBehind = currentSatang < targetSatang;

    return {
      id: goal.id,
      goalType: goal.goalType,
      targetAmount: formatSatang(targetSatang),
      currentAmount: formatSatang(currentSatang),
      startDate: goal.startDate,
      targetDate: goal.targetDate,
      isValid: true,
      expectedAmount: formatSatang(targetSatang),
      cappedProgress: progress,
      progressNumerator: cappedSatang,
      progressDenominator: targetSatang,
      isBehind,
      isCompleted,
      daysRemaining,
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
    id: goal.id,
    goalType: goal.goalType,
    targetAmount: formatSatang(targetSatang),
    currentAmount: formatSatang(currentSatang),
    startDate: goal.startDate,
    targetDate: goal.targetDate,
    isValid: true,
    expectedAmount: formatSatang(expectedSatang),
    cappedProgress: progress,
    progressNumerator: cappedScaled,
    progressDenominator: targetScaled,
    isBehind,
    isCompleted,
    daysRemaining,
  };
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

  const evaluatedGoals: GoalEvaluationResult[] = [];
  const missingFields: string[] = [];

  for (const goal of goals) {
    // Validate individual fields explicitly to record in missingFields
    const targetSatang = tryParseSatang(goal.targetAmount);
    if (targetSatang === null || targetSatang <= 0n) {
      missingFields.push(`goals[${goal.id}].targetAmount`);
    }

    const currentSatang = tryParseSatang(goal.currentAmount);
    if (currentSatang === null || currentSatang < 0n) {
      missingFields.push(`goals[${goal.id}].currentAmount`);
    }

    let startValid = true;
    try {
      parseUtcDate(goal.startDate);
    } catch {
      missingFields.push(`goals[${goal.id}].startDate`);
      startValid = false;
    }

    let targetValid = true;
    try {
      parseUtcDate(goal.targetDate);
    } catch {
      missingFields.push(`goals[${goal.id}].targetDate`);
      targetValid = false;
    }

    if (startValid && targetValid) {
      if (daysBetween(goal.startDate, goal.targetDate) <= 0) {
        missingFields.push(`goals[${goal.id}].targetDate`);
      }
    }

    const evaluated = evaluateGoal(goal, asOfDate);
    evaluatedGoals.push(evaluated);
  }

  if (missingFields.length > 0) {
    // Deduplicate and sort missing fields
    const sortedMissing = Array.from(new Set(missingFields)).sort();
    return {
      score: null,
      missingFields: sortedMissing,
      evaluatedGoals,
    };
  }

  // Calculate sum of capped progress using exact BigInt rationals
  let sumNum = 0n;
  let sumDen = 1n;

  for (const g of evaluatedGoals) {
    const num = g.progressNumerator ?? 0n;
    const den = g.progressDenominator ?? 1n;

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

  // Score = 15 * (sumNum / sumDen) / evaluatedGoals.length
  const scoreNumerator = 15n * sumNum;
  const scoreDenominator = BigInt(evaluatedGoals.length) * sumDen;
  const score = roundRationalHalfUp(scoreNumerator, scoreDenominator, 2);

  return {
    score,
    missingFields: [],
    evaluatedGoals,
  };
}

/**
 * Validates all goals and computes the aggregated Goals component score (Max 15).
 * Backward-compatible alias for evaluateGoals.
 */
export function calculateGoalsScore(goals: GoalInput[], asOfDate: string): GoalsComponentResult {
  return evaluateGoals(goals, asOfDate);
}
