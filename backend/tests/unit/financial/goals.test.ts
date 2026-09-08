import { describe, expect, it } from 'vitest';
import { calculateGoalsScore, evaluateGoal } from '../../../src/domain/financial/goals.js';

describe('Goal Progress and Goals Component Scoring', () => {
  const asOfDate = '2026-09-08';

  describe('Single Goal Evaluation', () => {
    it('evaluates goal on start date with zero balance as expected: expectedAmount 0, progress 1, not behind', () => {
      // Documented example: Goal starts 2026-09-08, target 12000, current 0, targetDate 2027-09-08
      const goal = {
        id: 'goal-1',
        targetAmount: '12000.00',
        currentAmount: '0.00',
        startDate: '2026-09-08',
        targetDate: '2027-09-08',
      };
      const result = evaluateGoal(goal, asOfDate);

      expect(result.isValid).toBe(true);
      expect(result.expectedAmount).toBe('0.00');
      expect(result.cappedProgress).toBe(1);
      expect(result.isBehind).toBe(false);
      expect(result.isCompleted).toBe(false);
      expect(result.daysRemaining).toBe(365);
    });

    it('evaluates goal before start date: expectedAmount 0, progress 1, not behind', () => {
      const goal = {
        id: 'goal-future',
        targetAmount: '50000.00',
        currentAmount: '0.00',
        startDate: '2026-10-01',
        targetDate: '2027-10-01',
      };
      const result = evaluateGoal(goal, asOfDate);

      expect(result.isValid).toBe(true);
      expect(result.expectedAmount).toBe('0.00');
      expect(result.cappedProgress).toBe(1);
      expect(result.isBehind).toBe(false);
      expect(result.daysRemaining).toBe(388);
    });

    it('evaluates goal in progress with exact proportion', () => {
      // 100 days total, asOfDate is 50 days in
      const goal = {
        id: 'goal-mid',
        targetAmount: '1000.00',
        currentAmount: '250.00',
        startDate: '2026-06-01',
        targetDate: '2026-10-09',
      };
      // 2026-06-01 to 2026-10-09 is 130 days. 2026-06-01 to 2026-09-08 is 99 days.
      // Expected = 1000 * 99 / 130 = 761.538...
      const result = evaluateGoal(goal, asOfDate);
      expect(result.isValid).toBe(true);
      expect(result.isBehind).toBe(true); // 250 < 761.54
      expect(result.cappedProgress).toBeLessThan(1);
      expect(result.cappedProgress).toBeGreaterThan(0);
    });

    it('caps progress at 1 when current amount exceeds expected or target amount', () => {
      const goal = {
        id: 'goal-ahead',
        targetAmount: '1000.00',
        currentAmount: '1500.00',
        startDate: '2026-01-01',
        targetDate: '2026-12-31',
      };
      const result = evaluateGoal(goal, asOfDate);
      expect(result.isValid).toBe(true);
      expect(result.cappedProgress).toBe(1);
      expect(result.isBehind).toBe(false);
      expect(result.isCompleted).toBe(true);
    });

    it('evaluates goal on target date: expectedAmount = targetAmount', () => {
      const goal = {
        id: 'goal-due-today',
        targetAmount: '1000.00',
        currentAmount: '667.00',
        startDate: '2026-01-01',
        targetDate: '2026-09-08',
      };
      const result = evaluateGoal(goal, asOfDate);
      expect(result.isValid).toBe(true);
      expect(result.expectedAmount).toBe('1000.00');
      expect(result.cappedProgress).toBe(0.667);
      expect(result.isBehind).toBe(true);
      expect(result.isCompleted).toBe(false);
      expect(result.daysRemaining).toBe(0);
    });

    it('evaluates overdue goal correctly', () => {
      const goal = {
        id: 'goal-overdue',
        targetAmount: '1000.00',
        currentAmount: '800.00',
        startDate: '2025-01-01',
        targetDate: '2026-01-01',
      };
      const result = evaluateGoal(goal, asOfDate);
      expect(result.isValid).toBe(true);
      expect(result.expectedAmount).toBe('1000.00');
      expect(result.isBehind).toBe(true);
      expect(result.daysRemaining).toBeLessThan(0);
    });

    it('detects invalid goal configurations without throwing', () => {
      const invalidTarget = evaluateGoal(
        {
          id: 'bad-1',
          targetAmount: '0.00',
          currentAmount: '0.00',
          startDate: '2026-01-01',
          targetDate: '2026-12-31',
        },
        asOfDate
      );
      expect(invalidTarget.isValid).toBe(false);

      const invalidDates = evaluateGoal(
        {
          id: 'bad-2',
          targetAmount: '1000.00',
          currentAmount: '0.00',
          startDate: '2026-12-31',
          targetDate: '2026-01-01', // targetDate <= startDate
        },
        asOfDate
      );
      expect(invalidDates.isValid).toBe(false);
    });
  });

  describe('Goals Component Score Aggregation', () => {
    it('returns score null with missingFields when goals list is empty', () => {
      const result = calculateGoalsScore([], asOfDate);
      expect(result.score).toBeNull();
      expect(result.missingFields).toEqual(['goals']);
    });

    it('returns score null when even one goal is invalid and lists specific missing fields', () => {
      const goals = [
        {
          id: 'valid-1',
          targetAmount: '1000.00',
          currentAmount: '500.00',
          startDate: '2026-01-01',
          targetDate: '2026-12-31',
        },
        {
          id: 'invalid-2',
          targetAmount: '-50.00',
          currentAmount: '0.00',
          startDate: '2026-01-01',
          targetDate: '2026-12-31',
        },
      ];
      const result = calculateGoalsScore(goals, asOfDate);
      expect(result.score).toBeNull();
      expect(result.missingFields).toContain('goals[invalid-2].targetAmount');
      expect(result.evaluatedGoals.length).toBe(2);
    });

    it('averages progress across multiple goals and rounds half-up to 2 decimals', () => {
      // Example matching M2-010 specification: target 1000.00, current 667.00 due on asOfDate
      // Progress = 0.667
      // 15 * 0.667 = 10.005 -> rounds half-up to 10.01!
      const goals = [
        {
          id: 'goal-exact-round',
          targetAmount: '1000.00',
          currentAmount: '667.00',
          startDate: '2026-01-01',
          targetDate: '2026-09-08',
        },
      ];
      const result = calculateGoalsScore(goals, asOfDate);
      expect(result.score).toBe(10.01);
      expect(result.missingFields).toEqual([]);
    });

    it('correctly aggregates multiple valid goals', () => {
      const goals = [
        {
          id: 'g1',
          targetAmount: '1000.00',
          currentAmount: '1000.00', // progress 1
          startDate: '2026-01-01',
          targetDate: '2026-09-08',
        },
        {
          id: 'g2',
          targetAmount: '1000.00',
          currentAmount: '500.00', // progress 0.5
          startDate: '2026-01-01',
          targetDate: '2026-09-08',
        },
      ];
      // Avg progress = (1 + 0.5) / 2 = 0.75. Score = 15 * 0.75 = 11.25
      const result = calculateGoalsScore(goals, asOfDate);
      expect(result.score).toBe(11.25);
    });

    it('regression: exact half-up rounding for 9.00 / 1000.00 produces 0.14 (not 0.13)', () => {
      // 15 * (9 / 1000) = 0.135 -> exact half-up is 0.14
      const goals = [
        {
          id: 'goal-p1-regression',
          targetAmount: '1000.00',
          currentAmount: '9.00',
          startDate: '2026-01-01',
          targetDate: '2026-09-08',
        },
      ];
      const result = calculateGoalsScore(goals, asOfDate);
      expect(result.score).toBe(0.14);
      expect(result.missingFields).toEqual([]);
    });

    it('regression: extremely small ratio 0.01 / 10^15 does not produce NaN or throw', () => {
      const goals = [
        {
          id: 'goal-tiny-ratio',
          targetAmount: '1000000000000000.00',
          currentAmount: '0.01',
          startDate: '2026-01-01',
          targetDate: '2026-09-08',
        },
      ];
      const result = calculateGoalsScore(goals, asOfDate);
      expect(result.score).toBe(0.0);
      expect(Number.isNaN(result.score)).toBe(false);
      expect(result.missingFields).toEqual([]);
    });

    it('regression: validates asOfDate before early return on empty goals', () => {
      expect(() => calculateGoalsScore([], '2026-02-30')).toThrow();
    });

    it('AUD-001 regression: public GoalEvaluationResult contains no BigInt and serializes cleanly with JSON.stringify', () => {
      const goals = [
        {
          id: 'goal-pre-start',
          targetAmount: '1000.00',
          currentAmount: '0.00',
          startDate: '2026-10-01',
          targetDate: '2027-10-01',
        },
        {
          id: 'goal-mid',
          targetAmount: '1000.00',
          currentAmount: '250.00',
          startDate: '2026-01-01',
          targetDate: '2026-12-31',
        },
        {
          id: 'goal-due',
          targetAmount: '1000.00',
          currentAmount: '9.00',
          startDate: '2026-01-01',
          targetDate: '2026-09-08',
        },
      ];

      for (const g of goals) {
        const single = evaluateGoal(g, asOfDate);
        expect(() => JSON.stringify(single)).not.toThrow();
        const json = JSON.parse(JSON.stringify(single));
        expect(typeof json.cappedProgress).toBe('number');
        expect(typeof json.expectedAmount).toBe('string');
        expect('progressNumerator' in json).toBe(false);
        expect('progressDenominator' in json).toBe(false);
      }

      const componentResult = calculateGoalsScore(goals, asOfDate);
      expect(() => JSON.stringify(componentResult)).not.toThrow();
      const compJson = JSON.parse(JSON.stringify(componentResult));
      expect(compJson.score).toBeTypeOf('number');
      expect(Array.isArray(compJson.evaluatedGoals)).toBe(true);
    });
  });
});
