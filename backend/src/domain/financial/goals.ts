import { daysBetween, isDateOnOrBefore, parseUtcDate } from './dates.js';
import { formatSatang, roundHalfUp, tryParseSatang } from './money.js';
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
      isBehind: false,
      isCompleted,
      daysRemaining,
    };
  }

  // Case 2: asOfDate >= targetDate (target date reached or passed)
  if (isDateOnOrBefore(goal.targetDate, asOfDate)) {
    const progress = Math.min(1, Math.max(0, Number(currentSatang) / Number(targetSatang)));
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
  const num = Number(currentSatang * BigInt(totalDays));
  const den = Number(targetSatang * BigInt(elapsedDays));
  const rawProgress = den > 0 ? num / den : 1;
  const progress = Math.min(1, Math.max(0, rawProgress));

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
    isBehind,
    isCompleted,
    daysRemaining,
  };
}

/**
 * Validates all goals and computes the aggregated Goals component score (Max 15).
 * If goals is empty, or any goal is invalid, returns score null with missingFields.
 */
export function calculateGoalsScore(goals: GoalInput[], asOfDate: string): GoalsComponentResult {
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

  // Calculate average capped progress
  const totalProgress = evaluatedGoals.reduce((sum, g) => sum + g.cappedProgress, 0);
  const avgProgress = totalProgress / evaluatedGoals.length;
  const rawScore = 15 * avgProgress;
  const score = roundHalfUp(rawScore, 2);

  return {
    score,
    missingFields: [],
    evaluatedGoals,
  };
}
