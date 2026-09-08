import { describe, expect, it } from 'vitest';
import {
  compareEvaluatedClients,
  evaluateClient,
} from '../../../src/domain/financial/evaluate-client.js';
import type { ClientEvaluationInput } from '../../../src/domain/financial/types.js';

describe('Unified evaluateClient Entrypoint and Priority Comparator', () => {
  const asOfDate = '2026-09-08';

  const baseInput: ClientEvaluationInput = {
    client: { id: 'client-1', customerCode: 'C-001' },
    financialProfile: {
      monthlyIncome: '100000.00',
      monthlyExpense: '40000.00',
      liquidAssets: '240000.00',
      totalAssets: '1000000.00',
      totalDebt: '200000.00',
      investments: '200000.00',
    },
    goals: [
      {
        id: 'goal-1',
        targetAmount: '500000.00',
        currentAmount: '200000.00',
        startDate: '2026-01-01',
        targetDate: '2028-01-01',
      },
    ],
  };

  it('produces all evaluation segments consistently from a single evaluation call', () => {
    const result = evaluateClient(baseInput, asOfDate);

    expect(result.asOfDate).toBe(asOfDate);
    expect(result.client).toEqual(baseInput.client);
    expect(result.health.status).toBe('COMPLETE');
    expect(result.primaryGoal?.id).toBe('goal-1');
    expect(result.recommendation.action).toBe('Routine Financial Review');
    expect(result.summary).toContain('Routine Financial Review');
  });

  it('is completely idempotent across repeated evaluations', () => {
    const res1 = evaluateClient(baseInput, asOfDate);
    const res2 = evaluateClient(baseInput, asOfDate);

    expect(res1).toEqual(res2);
  });

  it('does not mutate the input object and respects Object.freeze', () => {
    const frozenInput: ClientEvaluationInput = Object.freeze({
      client: Object.freeze({ id: 'client-frozen', customerCode: 'C-FRZ' }),
      financialProfile: Object.freeze({
        monthlyIncome: '80000.00',
        monthlyExpense: '30000.00',
        liquidAssets: '180000.00',
        totalAssets: '500000.00',
        totalDebt: '50000.00',
        investments: '100000.00',
      }),
      goals: Object.freeze([
        Object.freeze({
          id: 'g-frz',
          targetAmount: '100000.00',
          currentAmount: '50000.00',
          startDate: '2026-01-01',
          targetDate: '2027-01-01',
        }),
      ]) as unknown as ClientEvaluationInput['goals'],
    });

    expect(() => evaluateClient(frozenInput, asOfDate)).not.toThrow();
  });

  it('throws an error on invalid asOfDate and does NOT convert it to INSUFFICIENT_DATA', () => {
    expect(() => evaluateClient(baseInput, '2026-02-30')).toThrow();
    expect(() => evaluateClient(baseInput, 'invalid-date')).toThrow();
  });

  it('produces equivalent results regardless of goals array input ordering', () => {
    const g1 = {
      id: 'g1',
      targetAmount: '1000.00',
      currentAmount: '500.00',
      startDate: '2026-01-01',
      targetDate: '2027-01-01',
    };
    const g2 = {
      id: 'g2',
      targetAmount: '2000.00',
      currentAmount: '1000.00',
      startDate: '2026-01-01',
      targetDate: '2027-06-01',
    };

    const res1 = evaluateClient({ ...baseInput, goals: [g1, g2] }, asOfDate);
    const res2 = evaluateClient({ ...baseInput, goals: [g2, g1] }, asOfDate);

    expect(res1.health.score).toBe(res2.health.score);
    expect(res1.primaryGoal?.id).toBe(res2.primaryGoal?.id);
    expect(res1.recommendation.rule).toBe(res2.recommendation.rule);
  });

  describe('compareEvaluatedClients', () => {
    it('sorts clients strictly by priority: HIGH -> MEDIUM -> LOW', () => {
      const clientLow = evaluateClient(baseInput, asOfDate); // LOW (Routine)

      const clientMed = evaluateClient(
        { ...baseInput, client: { id: 'c-med', customerCode: 'C-002' }, financialProfile: null },
        asOfDate
      ); // MEDIUM (Review Client Data)

      const clientHigh = evaluateClient(
        {
          ...baseInput,
          client: { id: 'c-high', customerCode: 'C-003' },
          financialProfile: {
            ...baseInput.financialProfile!,
            liquidAssets: '10000.00', // 10k / 40k = 0.25 months (< 3) -> HIGH
          },
        },
        asOfDate
      );

      // Pass in order [LOW, MEDIUM, HIGH]
      const sorted = [clientLow, clientMed, clientHigh].sort(compareEvaluatedClients);

      expect(sorted[0]?.recommendation.priority).toBe('HIGH');
      expect(sorted[1]?.recommendation.priority).toBe('MEDIUM');
      expect(sorted[2]?.recommendation.priority).toBe('LOW');
      expect(sorted[0]?.client.customerCode).toBe('C-003');

    });

    it('breaks priority ties by customerCode ordinal ascending order', () => {
      const c1 = evaluateClient(
        { ...baseInput, client: { id: 'c1', customerCode: 'C-002' } },
        asOfDate
      );
      const c2 = evaluateClient(
        { ...baseInput, client: { id: 'c2', customerCode: 'C-001' } },
        asOfDate
      );
      const c3 = evaluateClient(
        { ...baseInput, client: { id: 'c3', customerCode: 'C-010' } },
        asOfDate
      );

      const sorted = [c1, c2, c3].sort(compareEvaluatedClients);
      expect(sorted.map((c) => c.client.customerCode)).toEqual(['C-001', 'C-002', 'C-010']);
    });
  });

  it('AUD-001 regression: full ClientEvaluationResult serializes cleanly with JSON.stringify without BigInt errors', () => {
    const evaluated = evaluateClient(baseInput, asOfDate);
    expect(() => JSON.stringify(evaluated)).not.toThrow();

    const serialized = JSON.stringify(evaluated);
    expect(serialized).not.toContain('progressNumerator');
    expect(serialized).not.toContain('progressDenominator');

    const parsed = JSON.parse(serialized);
    expect(parsed.client.customerCode).toBe('C-001');
    expect(parsed.health.score).toBe(100);
    expect(parsed.primaryGoal.id).toBe('goal-1');
  });
});
