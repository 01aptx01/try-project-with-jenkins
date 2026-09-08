import { describe, expect, it } from 'vitest';
import { evaluateGoal } from '../../../src/domain/financial/goals.js';
import { selectPrimaryGoal } from '../../../src/domain/financial/primary-goal.js';

describe('Deterministic Primary Goal Selection', () => {
  const asOfDate = '2026-09-08';

  it('returns null when evaluated goals list is empty or has no valid goals', () => {
    expect(selectPrimaryGoal([])).toBeNull();

    const invalidGoals = [
      evaluateGoal(
        {
          id: 'bad-1',
          targetAmount: '0.00',
          currentAmount: '0.00',
          startDate: '2026-01-01',
          targetDate: '2026-12-31',
        },
        asOfDate
      ),
    ];
    expect(selectPrimaryGoal(invalidGoals)).toBeNull();
  });

  it('selects the uncompleted valid goal with the earliest target date', () => {
    const goals = [
      evaluateGoal(
        {
          id: 'goal-far',
          targetAmount: '10000.00',
          currentAmount: '1000.00',
          startDate: '2026-01-01',
          targetDate: '2030-01-01',
        },
        asOfDate
      ),
      evaluateGoal(
        {
          id: 'goal-near',
          targetAmount: '10000.00',
          currentAmount: '1000.00',
          startDate: '2026-01-01',
          targetDate: '2027-01-01',
        },
        asOfDate
      ),
    ];

    const primary = selectPrimaryGoal(goals);
    expect(primary).not.toBeNull();
    expect(primary?.id).toBe('goal-near');
  });

  it('breaks targetDate ties using goal ID in ascending lexical order', () => {
    const goals = [
      evaluateGoal(
        {
          id: 'goal-b',
          targetAmount: '10000.00',
          currentAmount: '1000.00',
          startDate: '2026-01-01',
          targetDate: '2027-01-01',
        },
        asOfDate
      ),
      evaluateGoal(
        {
          id: 'goal-a',
          targetAmount: '10000.00',
          currentAmount: '1000.00',
          startDate: '2026-01-01',
          targetDate: '2027-01-01',
        },
        asOfDate
      ),
    ];

    const primary = selectPrimaryGoal(goals);
    expect(primary?.id).toBe('goal-a');
  });

  it('produces identical output regardless of input array permutation', () => {
    const g1 = evaluateGoal(
      {
        id: 'g1',
        targetAmount: '1000.00',
        currentAmount: '200.00',
        startDate: '2026-01-01',
        targetDate: '2027-05-01',
      },
      asOfDate
    );
    const g2 = evaluateGoal(
      {
        id: 'g2',
        targetAmount: '1000.00',
        currentAmount: '200.00',
        startDate: '2026-01-01',
        targetDate: '2027-01-01',
      },
      asOfDate
    );

    const res1 = selectPrimaryGoal([g1, g2]);
    const res2 = selectPrimaryGoal([g2, g1]);

    expect(res1?.id).toBe('g2');
    expect(res2?.id).toBe('g2');
    expect(res1).toEqual(res2);
  });

  it('selects earliest target date among completed goals when all valid goals are completed', () => {
    const goals = [
      evaluateGoal(
        {
          id: 'done-later',
          targetAmount: '1000.00',
          currentAmount: '1000.00', // completed
          startDate: '2026-01-01',
          targetDate: '2028-01-01',
        },
        asOfDate
      ),
      evaluateGoal(
        {
          id: 'done-earlier',
          targetAmount: '1000.00',
          currentAmount: '1500.00', // completed
          startDate: '2026-01-01',
          targetDate: '2026-10-01',
        },
        asOfDate
      ),
    ];

    const primary = selectPrimaryGoal(goals);
    expect(primary?.id).toBe('done-earlier');
    expect(primary?.isCompleted).toBe(true);
  });

  it('ignores invalid goals when selecting primary goal', () => {
    const goals = [
      evaluateGoal(
        {
          id: 'bad-goal',
          targetAmount: '-500.00',
          currentAmount: '0.00',
          startDate: '2026-01-01',
          targetDate: '2026-06-01',
        },
        asOfDate
      ),
      evaluateGoal(
        {
          id: 'good-goal',
          targetAmount: '500.00',
          currentAmount: '100.00',
          startDate: '2026-01-01',
          targetDate: '2027-01-01',
        },
        asOfDate
      ),
    ];

    const primary = selectPrimaryGoal(goals);
    expect(primary?.id).toBe('good-goal');
  });

  it('AUD-004: breaks ties using strict ordinal/lexical comparison across mixed-case and punctuation', () => {
    // In ASCII/Unicode ordinal order, uppercase 'G' (71) < lowercase 'g' (103)
    // and '-' (45) < '_' (95)
    const goals = [
      evaluateGoal(
        {
          id: 'goal-a',
          targetAmount: '1000.00',
          currentAmount: '100.00',
          startDate: '2026-01-01',
          targetDate: '2027-01-01',
        },
        asOfDate
      ),
      evaluateGoal(
        {
          id: 'Goal_A',
          targetAmount: '1000.00',
          currentAmount: '100.00',
          startDate: '2026-01-01',
          targetDate: '2027-01-01',
        },
        asOfDate
      ),
    ];

    const primary = selectPrimaryGoal(goals);
    expect(primary?.id).toBe('Goal_A');
  });
});
