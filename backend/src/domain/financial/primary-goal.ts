import { compareGoalTargetDateThenId } from './goals.js';
import type { GoalEvaluationResult, PrimaryGoalResult } from './types.js';

/**
 * Deterministically selects the Primary Goal from evaluated goals according to BR-10:
 * 1. Filters out invalid goals (invalid goals do not qualify as primary, though they affect health score).
 * 2. If any valid goals are uncompleted (currentAmount < targetAmount), selects the uncompleted goal
 *    with earliest targetDate. Breaks ties using goal ID (ascending lexical/ordinal order).
 * 3. If all valid goals are completed, selects the goal with earliest targetDate (breaks ties by ID).
 * 4. If no valid goals exist, returns null.
 */
export function selectPrimaryGoal(
  evaluatedGoals: GoalEvaluationResult[]
): PrimaryGoalResult | null {
  if (!evaluatedGoals || evaluatedGoals.length === 0) {
    return null;
  }

  const validGoals = evaluatedGoals.filter((g) => g.isValid);
  if (validGoals.length === 0) {
    return null;
  }

  const uncompleted = validGoals.filter((g) => !g.isCompleted);

  const selected =
    uncompleted.length > 0
      ? [...uncompleted].sort(compareGoalTargetDateThenId)[0]
      : [...validGoals].sort(compareGoalTargetDateThenId)[0];

  if (!selected) {
    return null;
  }

  return {
    id: selected.id,
    goalType: selected.goalType,
    targetAmount: selected.targetAmount,
    currentAmount: selected.currentAmount,
    startDate: selected.startDate,
    targetDate: selected.targetDate,
    expectedAmount: selected.expectedAmount,
    progress: selected.cappedProgress,
    isBehind: selected.isBehind,
    isCompleted: selected.isCompleted,
  };

}
