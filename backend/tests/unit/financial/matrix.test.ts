import { describe, expect, it } from 'vitest';
import { evaluateClient } from '../../../src/domain/financial/index.js';
import type { ClientEvaluationInput } from '../../../src/domain/financial/types.js';


describe('Milestone 2 Acceptance & Boundary Matrix', () => {
  const asOfDate = '2026-09-08';

  /**
   * MANDATORY SPECIFICATION EXAMPLE:
   * income 1000.00, expense 800.00, liquid assets 4800.00, total assets 10000.00, debt 2000.00, investments 2000.00;
   * Goal target 1000.00, current 667.00 due exactly on asOfDate (starts before asOfDate).
   * Result must be:
   * breakdown: 25 + 25 + 20 + 10.01 + 15 = 95.01
   * classification: GOOD
   * NBA: Review Goal Funding (Rule BR-04.4)
   * Priority: MEDIUM (because goal is behind on target date)
   */
  it('passes the mandatory specification verification example', () => {
    const input: ClientEvaluationInput = {
      client: { id: 'client-spec', customerCode: 'C-SPEC' },
      financialProfile: {
        monthlyIncome: '1000.00',
        monthlyExpense: '800.00',
        liquidAssets: '4800.00',
        totalAssets: '10000.00',
        totalDebt: '2000.00',
        investments: '2000.00',
      },
      goals: [
        {
          id: 'goal-target-today',
          targetAmount: '1000.00',
          currentAmount: '667.00',
          startDate: '2026-01-01',
          targetDate: '2026-09-08', // exactly on asOfDate
        },
      ],
    };

    const result = evaluateClient(input, asOfDate);

    // Verify breakdown
    expect(result.health.breakdown).toEqual({
      liquidity: 25,
      debt: 25,
      savings: 20,
      goals: 10.01,
      investment: 15,
    });

    // Verify total score & classification
    expect(result.health.score).toBe(95.01);
    expect(result.health.classification).toBe('GOOD');
    expect(result.health.status).toBe('COMPLETE');

    // Verify Primary Goal
    expect(result.primaryGoal).not.toBeNull();
    expect(result.primaryGoal?.id).toBe('goal-target-today');
    expect(result.primaryGoal?.isBehind).toBe(true);

    // Verify NBA Recommendation & Priority
    expect(result.recommendation.rule).toBe('BR-04.4');
    expect(result.recommendation.action).toBe('Review Goal Funding');
    expect(result.recommendation.priority).toBe('MEDIUM');
    expect(result.recommendation.reason).toContain('goal-target-today');

    // Verify Summary contains expected values
    expect(result.summary).toContain('95.01');
    expect(result.summary).toContain('ดี (GOOD)');
    expect(result.summary).toContain('goal-target-today');
    expect(result.summary).toContain('Review Goal Funding');
    expect(result.summary).toContain('MEDIUM');
  });

  describe('Six NBA End-to-End Scenarios Matrix (Unit Fixtures)', () => {
    // Scenario 1: Insufficient data
    it('Scenario 1: Missing profile triggers BR-04.1 Review Client Data (MEDIUM)', () => {
      const input: ClientEvaluationInput = {
        client: { id: 'c1', customerCode: 'C-01' },
        financialProfile: null,
        goals: [
          {
            id: 'g1',
            targetAmount: '1000.00',
            currentAmount: '500.00',
            startDate: '2026-01-01',
            targetDate: '2027-01-01',
          },
        ],
      };
      const res = evaluateClient(input, asOfDate);
      expect(res.health.status).toBe('INSUFFICIENT_DATA');
      expect(res.recommendation.rule).toBe('BR-04.1');
      expect(res.recommendation.action).toBe('Review Client Data');
      expect(res.recommendation.priority).toBe('MEDIUM');
    });

    // Scenario 2: Emergency Fund Liquidity < 3 months
    it('Scenario 2: Low liquidity triggers BR-04.2 Review Emergency Fund (HIGH)', () => {
      const input: ClientEvaluationInput = {
        client: { id: 'c2', customerCode: 'C-02' },
        financialProfile: {
          monthlyIncome: '10000.00',
          monthlyExpense: '5000.00',
          liquidAssets: '10000.00', // 2.0 months (< 3)
          totalAssets: '100000.00',
          totalDebt: '10000.00',
          investments: '20000.00',
        },
        goals: [
          {
            id: 'g1',
            targetAmount: '1000.00',
            currentAmount: '1000.00',
            startDate: '2026-01-01',
            targetDate: '2027-01-01',
          },
        ],
      };
      const res = evaluateClient(input, asOfDate);
      expect(res.recommendation.rule).toBe('BR-04.2');
      expect(res.recommendation.action).toBe('Review Emergency Fund');
      expect(res.recommendation.priority).toBe('HIGH');
    });

    // Scenario 3: Debt ratio > 60%
    it('Scenario 3: High debt ratio triggers BR-04.3 Review Debt Position (HIGH)', () => {
      const input: ClientEvaluationInput = {
        client: { id: 'c3', customerCode: 'C-03' },
        financialProfile: {
          monthlyIncome: '10000.00',
          monthlyExpense: '3000.00',
          liquidAssets: '30000.00', // 10 months (OK)
          totalAssets: '100000.00',
          totalDebt: '65000.00', // 65% (> 60%)
          investments: '20000.00',
        },
        goals: [
          {
            id: 'g1',
            targetAmount: '1000.00',
            currentAmount: '1000.00',
            startDate: '2026-01-01',
            targetDate: '2027-01-01',
          },
        ],
      };
      const res = evaluateClient(input, asOfDate);
      expect(res.recommendation.rule).toBe('BR-04.3');
      expect(res.recommendation.action).toBe('Review Debt Position');
      expect(res.recommendation.priority).toBe('HIGH');
    });

    // Scenario 4: Goal Funding Behind (<= 365 days)
    it('Scenario 4: Behind goal triggers BR-04.4 Review Goal Funding (MEDIUM)', () => {
      const input: ClientEvaluationInput = {
        client: { id: 'c4', customerCode: 'C-04' },
        financialProfile: {
          monthlyIncome: '10000.00',
          monthlyExpense: '3000.00',
          liquidAssets: '30000.00',
          totalAssets: '100000.00',
          totalDebt: '20000.00',
          investments: '20000.00',
        },
        goals: [
          {
            id: 'goal-late',
            targetAmount: '10000.00',
            currentAmount: '500.00',
            startDate: '2026-01-01',
            targetDate: '2027-01-01', // ~115 days remaining (<= 365)
          },
        ],
      };
      const res = evaluateClient(input, asOfDate);
      expect(res.recommendation.rule).toBe('BR-04.4');
      expect(res.recommendation.action).toBe('Review Goal Funding');
      expect(res.recommendation.priority).toBe('MEDIUM');
    });

    // Scenario 5: Health Score < 60
    it('Scenario 5: Low health score triggers BR-04.5 Schedule Financial Health Review (MEDIUM)', () => {
      const input: ClientEvaluationInput = {
        client: { id: 'c5', customerCode: 'C-05' },
        financialProfile: {
          monthlyIncome: '10000.00',
          monthlyExpense: '10000.00', // S = 0
          liquidAssets: '30000.00', // L = 18 (3.0 months)
          totalAssets: '100000.00',
          totalDebt: '55000.00', // D = 8 (55% debt)
          investments: '0.00', // I = 0
        },
        goals: [
          {
            id: 'g-future',
            targetAmount: '1000.00',
            currentAmount: '1000.00', // G = 15 (not behind)
            startDate: '2026-10-01',
            targetDate: '2027-10-01',
          },
        ],
      };
      // Score = 18 + 8 + 0 + 15 + 0 = 41 (< 60)
      const res = evaluateClient(input, asOfDate);
      expect(res.health.score).toBe(41);
      expect(res.recommendation.rule).toBe('BR-04.5');
      expect(res.recommendation.action).toBe('Schedule Financial Health Review');
      expect(res.recommendation.priority).toBe('MEDIUM');
    });

    // Scenario 6: Routine Financial Review
    it('Scenario 6: Healthy client triggers BR-04.6 Routine Financial Review (LOW)', () => {
      const input: ClientEvaluationInput = {
        client: { id: 'c6', customerCode: 'C-06' },
        financialProfile: {
          monthlyIncome: '10000.00',
          monthlyExpense: '3000.00',
          liquidAssets: '30000.00',
          totalAssets: '100000.00',
          totalDebt: '10000.00',
          investments: '20000.00',
        },
        goals: [
          {
            id: 'g1',
            targetAmount: '1000.00',
            currentAmount: '1000.00',
            startDate: '2026-01-01',
            targetDate: '2027-01-01',
          },
        ],
      };
      const res = evaluateClient(input, asOfDate);
      expect(res.recommendation.rule).toBe('BR-04.6');
      expect(res.recommendation.action).toBe('Routine Financial Review');
      expect(res.recommendation.priority).toBe('LOW');
    });
  });

  describe('Boundary and Threshold Tests', () => {
    it('verifies exact threshold boundaries for liquidity, debt, and days remaining', () => {
      // 1. Liquidity exact 3.0 months -> not Rule 2
      const profileLiquidity3 = {
        monthlyIncome: '1000.00',
        monthlyExpense: '1000.00',
        liquidAssets: '3000.00', // 3.0 months
        totalAssets: '10000.00',
        totalDebt: '1000.00',
        investments: '2000.00',
      };
      const resL3 = evaluateClient(
        {
          client: { id: 'cL3', customerCode: 'C-L3' },
          financialProfile: profileLiquidity3,
          goals: [
            {
              id: 'g',
              targetAmount: '100.00',
              currentAmount: '100.00',
              startDate: '2026-01-01',
              targetDate: '2027-01-01',
            },
          ],
        },
        asOfDate
      );
      expect(resL3.recommendation.rule).not.toBe('BR-04.2');

      // 2. Debt exact 60.0% -> not Rule 3
      const profileDebt60 = {
        ...profileLiquidity3,
        liquidAssets: '5000.00',
        totalDebt: '6000.00', // 60.0%
      };
      const resD60 = evaluateClient(
        {
          client: { id: 'cD60', customerCode: 'C-D60' },
          financialProfile: profileDebt60,
          goals: [
            {
              id: 'g',
              targetAmount: '100.00',
              currentAmount: '100.00',
              startDate: '2026-01-01',
              targetDate: '2027-01-01',
            },
          ],
        },
        asOfDate
      );
      expect(resD60.recommendation.rule).not.toBe('BR-04.3');

      // 3. Days remaining 366 -> not Rule 4
      const res366 = evaluateClient(
        {
          client: { id: 'c366', customerCode: 'C-366' },
          financialProfile: {
            ...profileLiquidity3,
            liquidAssets: '5000.00',
            totalDebt: '1000.00',
          },
          goals: [
            {
              id: 'g-far',
              targetAmount: '10000.00',
              currentAmount: '0.00',
              startDate: '2026-01-01',
              targetDate: '2027-09-09', // 366 days
            },
          ],
        },
        asOfDate
      );
      expect(res366.recommendation.rule).not.toBe('BR-04.4');
    });
  });
});
