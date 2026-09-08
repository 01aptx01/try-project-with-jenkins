import { describe, expect, it } from 'vitest';
import { evaluateGoal } from '../../../src/domain/financial/goals.js';
import { calculateHealthResult } from '../../../src/domain/financial/health.js';
import { evaluateRecommendation } from '../../../src/domain/financial/recommendation.js';
import type { FinancialProfileInput, GoalInput } from '../../../src/domain/financial/types.js';

describe('Next Best Action (NBA) and Priority Rules Evaluation', () => {
  const asOfDate = '2026-09-08';

  const healthyProfile: FinancialProfileInput = {
    monthlyIncome: '100000.00',
    monthlyExpense: '30000.00',
    liquidAssets: '180000.00', // 6.0 months
    totalAssets: '1000000.00',
    totalDebt: '100000.00', // 10%
    investments: '200000.00', // 20%
  };

  const healthyGoals: GoalInput[] = [
    {
      id: 'g-ok',
      targetAmount: '50000.00',
      currentAmount: '50000.00',
      startDate: '2026-01-01',
      targetDate: '2026-09-08',
    },
  ];

  it('triggers Rule 1 (BR-04.1 Review Client Data, MEDIUM) when data is insufficient', () => {
    const health = calculateHealthResult(null, healthyGoals, asOfDate);
    const rec = evaluateRecommendation({
      health,
      profile: null,
      evaluatedGoals: healthyGoals.map((g) => evaluateGoal(g, asOfDate)),
    });

    expect(rec.rule).toBe('BR-04.1');
    expect(rec.action).toBe('Review Client Data');
    expect(rec.priority).toBe('MEDIUM');
    expect(rec.reason).toContain('financialProfile');
  });

  it('triggers Rule 2 (BR-04.2 Review Emergency Fund, HIGH) when liquidity < 3 months', () => {
    const profileLowLiquidity: FinancialProfileInput = {
      ...healthyProfile,
      liquidAssets: '69000.00', // 69k / 30k = 2.3 months (< 3)
    };
    const health = calculateHealthResult(profileLowLiquidity, healthyGoals, asOfDate);
    const rec = evaluateRecommendation({
      health,
      profile: profileLowLiquidity,
      evaluatedGoals: healthyGoals.map((g) => evaluateGoal(g, asOfDate)),
    });

    expect(rec.rule).toBe('BR-04.2');
    expect(rec.action).toBe('Review Emergency Fund');
    expect(rec.priority).toBe('HIGH');
    expect(rec.reason).toContain('2.3');
  });


  it('triggers Rule 2 (BR-04.2) with non-contradictory reason when liquidity is just below 3 months', () => {
    const profileNear3Months: FinancialProfileInput = {
      ...healthyProfile,
      liquidAssets: '89000.00', // 89k / 30k = 2.966... months -> toFixed(1) would be 3.0
    };
    const health = calculateHealthResult(profileNear3Months, healthyGoals, asOfDate);
    const rec = evaluateRecommendation({
      health,
      profile: profileNear3Months,
      evaluatedGoals: healthyGoals.map((g) => evaluateGoal(g, asOfDate)),
    });

    expect(rec.rule).toBe('BR-04.2');
    expect(rec.priority).toBe('HIGH');
    expect(rec.reason).toContain('< 3 เดือน (2.97 เดือน)');
    expect(rec.reason).not.toContain('3.0 เดือน ซึ่งต่ำกว่าเกณฑ์ขั้นต่ำ 3 เดือน');
  });

  it('takes precedence of Rule 2 over Rule 3 when both liquidity < 3 and debt > 60% exist', () => {
    const badProfile: FinancialProfileInput = {
      ...healthyProfile,
      liquidAssets: '60000.00', // 2.0 months (< 3)
      totalDebt: '700000.00', // 70% (> 60%)
    };
    const health = calculateHealthResult(badProfile, healthyGoals, asOfDate);
    const rec = evaluateRecommendation({
      health,
      profile: badProfile,
      evaluatedGoals: healthyGoals.map((g) => evaluateGoal(g, asOfDate)),
    });

    expect(rec.rule).toBe('BR-04.2');
    expect(rec.priority).toBe('HIGH');
  });

  it('does NOT trigger Rule 2 when liquidity is exactly 3.0 months', () => {
    const profile3Months: FinancialProfileInput = {
      ...healthyProfile,
      liquidAssets: '90000.00', // exactly 3.0 months (90k / 30k)
    };
    const health = calculateHealthResult(profile3Months, healthyGoals, asOfDate);
    const rec = evaluateRecommendation({
      health,
      profile: profile3Months,
      evaluatedGoals: healthyGoals.map((g) => evaluateGoal(g, asOfDate)),
    });

    // Should NOT trigger Rule 2
    expect(rec.rule).not.toBe('BR-04.2');
  });

  it('triggers Rule 3 (BR-04.3 Review Debt Position, HIGH) when debt ratio > 60%', () => {
    const profileHighDebt: FinancialProfileInput = {
      ...healthyProfile,
      totalDebt: '700000.00', // 70.00%
    };
    const health = calculateHealthResult(profileHighDebt, healthyGoals, asOfDate);
    const rec = evaluateRecommendation({
      health,
      profile: profileHighDebt,
      evaluatedGoals: healthyGoals.map((g) => evaluateGoal(g, asOfDate)),
    });

    expect(rec.rule).toBe('BR-04.3');
    expect(rec.action).toBe('Review Debt Position');
    expect(rec.priority).toBe('HIGH');
    expect(rec.reason).toContain('70.00%');
  });

  it('triggers Rule 3 (BR-04.3) with non-contradictory reason when debt ratio is just above 60%', () => {
    const profileNear60Debt: FinancialProfileInput = {
      ...healthyProfile,
      totalDebt: '600001.00', // 60.0001% -> toFixed(2) would be 60.00%
    };
    const health = calculateHealthResult(profileNear60Debt, healthyGoals, asOfDate);
    const rec = evaluateRecommendation({
      health,
      profile: profileNear60Debt,
      evaluatedGoals: healthyGoals.map((g) => evaluateGoal(g, asOfDate)),
    });

    expect(rec.rule).toBe('BR-04.3');
    expect(rec.priority).toBe('HIGH');
    expect(rec.reason).toContain('> 60% (60.000%)');
    expect(rec.reason).not.toContain('60.00% ซึ่งสูงกว่าเกณฑ์ 60%');
  });

  it('does NOT trigger Rule 3 when debt ratio is exactly 60.0%', () => {
    const profile60Debt: FinancialProfileInput = {
      ...healthyProfile,
      totalDebt: '600000.00', // exactly 60.0%
    };
    const health = calculateHealthResult(profile60Debt, healthyGoals, asOfDate);
    const rec = evaluateRecommendation({
      health,
      profile: profile60Debt,
      evaluatedGoals: healthyGoals.map((g) => evaluateGoal(g, asOfDate)),
    });

    expect(rec.rule).not.toBe('BR-04.3');
  });

  describe('Rule 4 (BR-04.4 Review Goal Funding, MEDIUM) Boundary Checks', () => {
    it('triggers when a goal is behind and daysRemaining is exactly 365 days', () => {
      // asOfDate = 2026-09-08; targetDate = 2027-09-08 (365 days)
      const goals: GoalInput[] = [
        {
          id: 'goal-365',
          targetAmount: '10000.00',
          currentAmount: '100.00',
          startDate: '2026-01-01',
          targetDate: '2027-09-08',
        },
      ];
      const health = calculateHealthResult(healthyProfile, goals, asOfDate);
      const rec = evaluateRecommendation({
        health,
        profile: healthyProfile,
        evaluatedGoals: goals.map((g) => evaluateGoal(g, asOfDate)),
      });

      expect(rec.rule).toBe('BR-04.4');
      expect(rec.action).toBe('Review Goal Funding');
      expect(rec.priority).toBe('MEDIUM');
      expect(rec.reason).toContain('goal-365');
    });

    it('does NOT trigger when days remaining is 366 days', () => {
      // asOfDate = 2026-09-08; targetDate = 2027-09-09 (366 days)
      const goals: GoalInput[] = [
        {
          id: 'goal-366',
          targetAmount: '10000.00',
          currentAmount: '100.00',
          startDate: '2026-01-01',
          targetDate: '2027-09-09',
        },
      ];
      const health = calculateHealthResult(healthyProfile, goals, asOfDate);
      const rec = evaluateRecommendation({
        health,
        profile: healthyProfile,
        evaluatedGoals: goals.map((g) => evaluateGoal(g, asOfDate)),
      });

      expect(rec.rule).not.toBe('BR-04.4');
    });

    it('triggers when goal is due today (daysRemaining = 0) and behind', () => {
      const goals: GoalInput[] = [
        {
          id: 'goal-today',
          targetAmount: '1000.00',
          currentAmount: '500.00',
          startDate: '2026-01-01',
          targetDate: '2026-09-08',
        },
      ];
      const health = calculateHealthResult(healthyProfile, goals, asOfDate);
      const rec = evaluateRecommendation({
        health,
        profile: healthyProfile,
        evaluatedGoals: goals.map((g) => evaluateGoal(g, asOfDate)),
      });

      expect(rec.rule).toBe('BR-04.4');
      expect(rec.reason).toContain('ครบกำหนดในวันนี้');
    });

    it('triggers when goal is overdue (daysRemaining = -10)', () => {
      const goals: GoalInput[] = [
        {
          id: 'goal-overdue',
          targetAmount: '1000.00',
          currentAmount: '500.00',
          startDate: '2026-01-01',
          targetDate: '2026-08-29',
        },
      ];
      const health = calculateHealthResult(healthyProfile, goals, asOfDate);
      const rec = evaluateRecommendation({
        health,
        profile: healthyProfile,
        evaluatedGoals: goals.map((g) => evaluateGoal(g, asOfDate)),
      });

      expect(rec.rule).toBe('BR-04.4');
      expect(rec.reason).toContain('เลยกำหนดเป้าหมายแล้ว');
    });

    it('selects earliest target date goal (and tie-break by ID) when multiple goals are behind', () => {
      const goals: GoalInput[] = [
        {
          id: 'goal-z-early',
          targetAmount: '1000.00',
          currentAmount: '0.00',
          startDate: '2026-01-01',
          targetDate: '2026-10-01',
        },
        {
          id: 'goal-a-late',
          targetAmount: '1000.00',
          currentAmount: '0.00',
          startDate: '2026-01-01',
          targetDate: '2026-12-01',
        },
      ];
      const health = calculateHealthResult(healthyProfile, goals, asOfDate);
      const rec = evaluateRecommendation({
        health,
        profile: healthyProfile,
        evaluatedGoals: goals.map((g) => evaluateGoal(g, asOfDate)),
      });

      expect(rec.rule).toBe('BR-04.4');
      expect(rec.reason).toContain('goal-z-early');
    });
  });

  it('triggers Rule 5 (BR-04.5 Schedule Financial Health Review, MEDIUM) when Health < 60', () => {
    // Total score < 60 without triggering Rule 2 (liquidity >= 3), Rule 3 (debt <= 60%), or Rule 4 (no goals behind)
    const goals10: GoalInput[] = [
      {
        id: 'g-on-track',
        targetAmount: '1000.00',
        currentAmount: '1000.00',

        // Let's check:
        // L=18, D=8 (55% debt), S=0 (expense >= income), I=0 (0 investments), G=15 (not behind)
        // 18 + 8 + 0 + 0 + 15 = 41!
        startDate: '2026-10-01',
        targetDate: '2027-10-01',
      },
    ];
    const profile41: FinancialProfileInput = {
      monthlyIncome: '1000.00',
      monthlyExpense: '1000.00', // S = 0 (0% savings)
      liquidAssets: '3000.00', // L = 18 (3.0 months >= 3)
      totalAssets: '10000.00',
      totalDebt: '5500.00', // D = 8 (55% debt, <= 60%)
      investments: '0.00', // I = 0
    };

    const health = calculateHealthResult(profile41, goals10, asOfDate);
    expect(health.score).toBe(41);
    expect(health.score).toBeLessThan(60);

    const rec = evaluateRecommendation({
      health,
      profile: profile41,
      evaluatedGoals: goals10.map((g) => evaluateGoal(g, asOfDate)),
    });

    expect(rec.rule).toBe('BR-04.5');
    expect(rec.action).toBe('Schedule Financial Health Review');
    expect(rec.priority).toBe('MEDIUM');
    expect(rec.reason).toContain('41.00');
  });

  it('triggers Rule 6 (BR-04.6 Routine Financial Review, LOW) when everything is in good standing', () => {
    const health = calculateHealthResult(healthyProfile, healthyGoals, asOfDate);
    const rec = evaluateRecommendation({
      health,
      profile: healthyProfile,
      evaluatedGoals: healthyGoals.map((g) => evaluateGoal(g, asOfDate)),
    });

    expect(rec.rule).toBe('BR-04.6');
    expect(rec.action).toBe('Routine Financial Review');
    expect(rec.priority).toBe('LOW');
    expect(rec.reason).toContain('ปกติ');
  });
});
