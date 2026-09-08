import { describe, expect, it } from 'vitest';
import { calculateHealthResult } from '../../../src/domain/financial/health.js';
import type { FinancialProfileInput, GoalInput } from '../../../src/domain/financial/types.js';

describe('Financial Health Aggregation and Insufficient Data', () => {
  const asOfDate = '2026-09-08';

  const validProfile: FinancialProfileInput = {
    monthlyIncome: '100000.00',
    monthlyExpense: '30000.00',
    liquidAssets: '180000.00', // 6 months -> 25
    totalAssets: '1000000.00',
    totalDebt: '200000.00', // 20% -> 25
    savings: '50000.00',
    investments: '200000.00', // 20% -> 15
  };

  const validGoals: GoalInput[] = [
    {
      id: 'g1',
      targetAmount: '100000.00',
      currentAmount: '100000.00', // progress 1.0 -> 15
      startDate: '2026-01-01',
      targetDate: '2026-09-08',
    },
  ];

  it('aggregates complete health score: 25 + 25 + 20 + 15 + 15 = 100 -> GOOD', () => {
    // savings: (100k - 30k) / 100k = 70% -> 20
    const result = calculateHealthResult(validProfile, validGoals, asOfDate);

    expect(result.status).toBe('COMPLETE');
    expect(result.score).toBe(100);
    expect(result.classification).toBe('GOOD');
    expect(result.missingFields).toEqual([]);
    expect(result.breakdown).toEqual({
      liquidity: 25,
      debt: 25,
      savings: 20,
      goals: 15,
      investment: 15,
    });
  });

  it('evaluates classification boundaries: 59.99 AT_RISK, 60 MODERATE, 79.99 MODERATE, 80 GOOD', () => {
    // 1. Exactly 80 -> GOOD
    // L=18, D=18, S=14, G=15, I=15 = 80
    const profile80: FinancialProfileInput = {
      monthlyIncome: '1000.00',
      monthlyExpense: '850.00', // savings rate 15% -> 14
      liquidAssets: '3000.00', // 3.52 months -> >=3 -> 18
      totalAssets: '10000.00',
      totalDebt: '4000.00', // 40% -> 18
      investments: '2000.00', // 20% -> 15
    };
    const goals15: GoalInput[] = [
      {
        id: 'g',
        targetAmount: '1000.00',
        currentAmount: '1000.00', // 15
        startDate: '2026-01-01',
        targetDate: '2026-09-08',
      },
    ];
    const res80 = calculateHealthResult(profile80, goals15, asOfDate);
    expect(res80.score).toBe(80);
    expect(res80.classification).toBe('GOOD');

    // 2. Exactly 60 -> MODERATE
    // L=18, D=18, S=14, G=0, I=10 = 60
    const profile60: FinancialProfileInput = {
      ...profile80,
      investments: '1000.00', // 10% -> 10
    };
    const goals0: GoalInput[] = [
      {
        id: 'g',
        targetAmount: '1000.00',
        currentAmount: '0.00', // 0
        startDate: '2026-01-01',
        targetDate: '2026-09-08',
      },
    ];
    const res60 = calculateHealthResult(profile60, goals0, asOfDate);
    expect(res60.score).toBe(60);
    expect(res60.classification).toBe('MODERATE');

    // 3. 59.99 -> AT_RISK
    // Target 1000, current 999 on target date -> progress = 0.999 -> goals = 15 * 0.999 = 14.985 -> round 14.99
    // L=18, D=18, S=14, G=14.99, I=5 = 69.99
    // To get 59.99: L=8, D=18, S=14, I=5, G=14.99 -> 8 + 18 + 14 + 5 + 14.99 = 59.99!
    const profile5999: FinancialProfileInput = {
      monthlyIncome: '1000.00',
      monthlyExpense: '850.00', // 14
      liquidAssets: '1000.00', // >=1 <3 -> 8
      totalAssets: '10000.00',
      totalDebt: '4000.00', // 40% -> 18
      investments: '500.00', // 5% -> 5
    };
    const goals1499: GoalInput[] = [
      {
        id: 'g',
        targetAmount: '1000.00',
        currentAmount: '999.00', // 14.99
        startDate: '2026-01-01',
        targetDate: '2026-09-08',
      },
    ];
    const res5999 = calculateHealthResult(profile5999, goals1499, asOfDate);
    expect(res5999.score).toBe(59.99);
    expect(res5999.classification).toBe('AT_RISK');
  });

  it('handles missing financialProfile container level', () => {
    const result = calculateHealthResult(null, validGoals, asOfDate);

    expect(result.status).toBe('INSUFFICIENT_DATA');
    expect(result.score).toBeNull();
    expect(result.classification).toBeNull();
    expect(result.missingFields).toEqual(['financialProfile']);
    expect(result.breakdown).toEqual({
      liquidity: null,
      debt: null,
      savings: null,
      goals: 15,
      investment: null,
    });
  });

  it('handles missing individual profile fields while keeping computed breakdown values without weight renormalization', () => {
    const partialProfile: FinancialProfileInput = {
      ...validProfile,
      monthlyIncome: null, // will invalidate savings
    };

    const result = calculateHealthResult(partialProfile, validGoals, asOfDate);

    expect(result.status).toBe('INSUFFICIENT_DATA');
    expect(result.score).toBeNull();
    expect(result.classification).toBeNull();
    expect(result.missingFields).toEqual(['financialProfile.monthlyIncome']);
    // Breakdown maintains calculated values where possible
    expect(result.breakdown.liquidity).toBe(25);
    expect(result.breakdown.debt).toBe(25);
    expect(result.breakdown.savings).toBeNull();
    expect(result.breakdown.goals).toBe(15);
    expect(result.breakdown.investment).toBe(15);
  });

  it('reports container-level missing goals when goals list is empty', () => {
    const result = calculateHealthResult(validProfile, [], asOfDate);

    expect(result.status).toBe('INSUFFICIENT_DATA');
    expect(result.score).toBeNull();
    expect(result.missingFields).toEqual(['goals']);
    expect(result.breakdown.goals).toBeNull();
  });

  it('deduplicates and sorts missing fields from multiple sources', () => {
    const brokenProfile: FinancialProfileInput = {
      liquidAssets: null,
      monthlyExpense: '0.00', // denominator <= 0
      monthlyIncome: null,
      totalAssets: '0.00',
      totalDebt: null,
      investments: null,
    };
    const brokenGoals: GoalInput[] = [
      {
        id: 'bad-goal',
        targetAmount: '-10.00',
        currentAmount: '0.00',
        startDate: '2026-01-01',
        targetDate: '2025-01-01',
      },
    ];

    const result = calculateHealthResult(brokenProfile, brokenGoals, asOfDate);
    expect(result.status).toBe('INSUFFICIENT_DATA');
    expect(result.missingFields).toEqual([
      'financialProfile.investments',
      'financialProfile.liquidAssets',
      'financialProfile.monthlyExpense',
      'financialProfile.monthlyIncome',
      'financialProfile.totalAssets',
      'financialProfile.totalDebt',
      'goals[bad-goal].targetAmount',
      'goals[bad-goal].targetDate',
    ]);

  });
});
