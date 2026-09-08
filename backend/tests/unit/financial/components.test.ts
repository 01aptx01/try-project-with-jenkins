import { describe, expect, it } from 'vitest';
import {
  calculateDebtScore,
  calculateInvestmentScore,
  calculateLiquidityScore,
  calculateSavingsScore,
} from '../../../src/domain/financial/components.js';

describe('Financial Components Scoring', () => {
  describe('Liquidity Score (Max 25)', () => {
    it('returns null when profile is null or inputs are missing/non-positive', () => {
      expect(calculateLiquidityScore(null)).toEqual({
        score: null,
        missingFields: ['financialProfile'],
        metricValue: null,
      });

      expect(calculateLiquidityScore({ liquidAssets: null, monthlyExpense: '1000.00' })).toEqual({
        score: null,
        missingFields: ['financialProfile.liquidAssets'],
        metricValue: null,
      });

      expect(calculateLiquidityScore({ liquidAssets: '5000.00', monthlyExpense: '0.00' })).toEqual({
        score: null,
        missingFields: ['financialProfile.monthlyExpense'],
        metricValue: null,
      });

      expect(calculateLiquidityScore({ liquidAssets: '5000.00', monthlyExpense: '-10.00' })).toEqual({
        score: null,
        missingFields: ['financialProfile.monthlyExpense'],
        metricValue: null,
      });
    });

    it('evaluates exact thresholds: <1 = 0, >=1 = 8, >=3 = 18, >=6 = 25', () => {
      // < 1 month: 999.00 / 1000.00 = 0.999
      expect(calculateLiquidityScore({ liquidAssets: '999.00', monthlyExpense: '1000.00' }).score).toBe(0);

      // exactly 1 month: 1000.00 / 1000.00 = 1.0
      expect(calculateLiquidityScore({ liquidAssets: '1000.00', monthlyExpense: '1000.00' }).score).toBe(8);

      // 2.99 months
      expect(calculateLiquidityScore({ liquidAssets: '2990.00', monthlyExpense: '1000.00' }).score).toBe(8);

      // exactly 3 months
      expect(calculateLiquidityScore({ liquidAssets: '3000.00', monthlyExpense: '1000.00' }).score).toBe(18);

      // 5.99 months
      expect(calculateLiquidityScore({ liquidAssets: '5990.00', monthlyExpense: '1000.00' }).score).toBe(18);

      // exactly 6 months
      expect(calculateLiquidityScore({ liquidAssets: '6000.00', monthlyExpense: '1000.00' }).score).toBe(25);

      // > 6 months
      expect(calculateLiquidityScore({ liquidAssets: '10000.00', monthlyExpense: '1000.00' }).score).toBe(25);
    });
  });

  describe('Debt Score (Max 25)', () => {
    it('returns null when total_assets is missing, zero or negative', () => {
      expect(calculateDebtScore({ totalDebt: '1000.00', totalAssets: '0.00' })).toEqual({
        score: null,
        missingFields: ['financialProfile.totalAssets'],
        metricValue: null,
      });

      expect(calculateDebtScore({ totalDebt: '1000.00', totalAssets: null })).toEqual({
        score: null,
        missingFields: ['financialProfile.totalAssets'],
        metricValue: null,
      });

      expect(calculateDebtScore({ totalDebt: null, totalAssets: '10000.00' })).toEqual({
        score: null,
        missingFields: ['financialProfile.totalDebt'],
        metricValue: null,
      });
    });

    it('evaluates exact thresholds: <=20% = 25, <=40% = 18, <=60% = 8, >60% = 0', () => {
      // 0% debt
      expect(calculateDebtScore({ totalDebt: '0.00', totalAssets: '10000.00' }).score).toBe(25);

      // exactly 20%
      expect(calculateDebtScore({ totalDebt: '2000.00', totalAssets: '10000.00' }).score).toBe(25);

      // 20.01% (just above 20%)
      expect(calculateDebtScore({ totalDebt: '2001.00', totalAssets: '10000.00' }).score).toBe(18);

      // exactly 40%
      expect(calculateDebtScore({ totalDebt: '4000.00', totalAssets: '10000.00' }).score).toBe(18);

      // 40.01% (just above 40%)
      expect(calculateDebtScore({ totalDebt: '4001.00', totalAssets: '10000.00' }).score).toBe(8);

      // exactly 60%
      expect(calculateDebtScore({ totalDebt: '6000.00', totalAssets: '10000.00' }).score).toBe(8);

      // 60.01% (just above 60%)
      expect(calculateDebtScore({ totalDebt: '6001.00', totalAssets: '10000.00' }).score).toBe(0);

      // 100%
      expect(calculateDebtScore({ totalDebt: '10000.00', totalAssets: '10000.00' }).score).toBe(0);
    });
  });

  describe('Savings Score (Max 20)', () => {
    it('returns null when monthly_income is zero or missing', () => {
      expect(calculateSavingsScore({ monthlyIncome: '0.00', monthlyExpense: '500.00' })).toEqual({
        score: null,
        missingFields: ['financialProfile.monthlyIncome'],
        metricValue: null,
      });

      expect(calculateSavingsScore({ monthlyIncome: null, monthlyExpense: '500.00' })).toEqual({
        score: null,
        missingFields: ['financialProfile.monthlyIncome'],
        metricValue: null,
      });

      expect(calculateSavingsScore({ monthlyIncome: '1000.00', monthlyExpense: null })).toEqual({
        score: null,
        missingFields: ['financialProfile.monthlyExpense'],
        metricValue: null,
      });
    });

    it('evaluates exact thresholds: <=0 = 0, >0 = 7, >=10% = 14, >=20% = 20', () => {
      // negative savings (expense > income)
      expect(calculateSavingsScore({ monthlyIncome: '1000.00', monthlyExpense: '1200.00' }).score).toBe(0);

      // 0% savings (expense == income)
      expect(calculateSavingsScore({ monthlyIncome: '1000.00', monthlyExpense: '1000.00' }).score).toBe(0);

      // 1 satang savings > 0%
      expect(calculateSavingsScore({ monthlyIncome: '1000.00', monthlyExpense: '999.99' }).score).toBe(7);

      // 9.99% savings
      expect(calculateSavingsScore({ monthlyIncome: '1000.00', monthlyExpense: '900.10' }).score).toBe(7);

      // exactly 10% savings
      expect(calculateSavingsScore({ monthlyIncome: '1000.00', monthlyExpense: '900.00' }).score).toBe(14);

      // 19.99% savings
      expect(calculateSavingsScore({ monthlyIncome: '1000.00', monthlyExpense: '800.10' }).score).toBe(14);

      // exactly 20% savings
      expect(calculateSavingsScore({ monthlyIncome: '1000.00', monthlyExpense: '800.00' }).score).toBe(20);

      // > 20% savings
      expect(calculateSavingsScore({ monthlyIncome: '1000.00', monthlyExpense: '500.00' }).score).toBe(20);
    });

    it('ignores profile.savings field and relies strictly on income and expense cashflow', () => {
      const withHugeSavings = calculateSavingsScore({
        monthlyIncome: '1000.00',
        monthlyExpense: '800.00',
        savings: '999999999.00',
      });
      const withoutSavings = calculateSavingsScore({
        monthlyIncome: '1000.00',
        monthlyExpense: '800.00',
        savings: '0.00',
      });
      expect(withHugeSavings.score).toBe(20);
      expect(withoutSavings.score).toBe(20);
      expect(withHugeSavings.score).toBe(withoutSavings.score);
    });
  });

  describe('Investment Score (Max 15)', () => {
    it('returns null when total_assets is missing or non-positive', () => {
      expect(calculateInvestmentScore({ investments: '1000.00', totalAssets: '0.00' })).toEqual({
        score: null,
        missingFields: ['financialProfile.totalAssets'],
        metricValue: null,
      });

      expect(calculateInvestmentScore({ investments: null, totalAssets: '10000.00' })).toEqual({
        score: null,
        missingFields: ['financialProfile.investments'],
        metricValue: null,
      });
    });

    it('evaluates exact thresholds: <=0 = 0, >0 = 5, >=10% = 10, >=20% = 15', () => {
      // 0%
      expect(calculateInvestmentScore({ investments: '0.00', totalAssets: '10000.00' }).score).toBe(0);

      // 1 satang > 0%
      expect(calculateInvestmentScore({ investments: '0.01', totalAssets: '10000.00' }).score).toBe(5);

      // 9.99%
      expect(calculateInvestmentScore({ investments: '999.00', totalAssets: '10000.00' }).score).toBe(5);

      // exactly 10%
      expect(calculateInvestmentScore({ investments: '1000.00', totalAssets: '10000.00' }).score).toBe(10);

      // 19.99%
      expect(calculateInvestmentScore({ investments: '1999.00', totalAssets: '10000.00' }).score).toBe(10);

      // exactly 20%
      expect(calculateInvestmentScore({ investments: '2000.00', totalAssets: '10000.00' }).score).toBe(15);

      // > 20%
      expect(calculateInvestmentScore({ investments: '3000.00', totalAssets: '10000.00' }).score).toBe(15);
    });
  });
});
