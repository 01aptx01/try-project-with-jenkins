import { tryParseSatang } from './money.js';
import type { FinancialProfileInput } from './types.js';

export interface ComponentScoreResult<T = number> {
  score: number | null;
  missingFields: string[];
  metricValue: T | null;
}

/**
 * Evaluates Liquidity component score (Max 25):
 * liquid_assets / monthly_expense
 * >= 6 months = 25
 * >= 3 months = 18
 * >= 1 month  = 8
 * < 1 month   = 0
 * Denominator must be strictly positive (> 0).
 */
export function calculateLiquidityScore(
  profile: FinancialProfileInput | null
): ComponentScoreResult<number> {
  if (!profile) {
    return { score: null, missingFields: ['financialProfile'], metricValue: null };
  }

  const missingFields: string[] = [];
  const liquidSatang = tryParseSatang(profile.liquidAssets);
  if (liquidSatang === null) {
    missingFields.push('financialProfile.liquidAssets');
  }

  const expenseSatang = tryParseSatang(profile.monthlyExpense);
  if (expenseSatang === null || expenseSatang <= 0n) {
    missingFields.push('financialProfile.monthlyExpense');
  }

  if (missingFields.length > 0 || liquidSatang === null || expenseSatang === null || expenseSatang <= 0n) {
    return { score: null, missingFields, metricValue: null };
  }

  // Calculate exact floating metric for reporting/reason
  const months = Number(liquidSatang) / Number(expenseSatang);

  // Exact integer comparison for scoring
  let score: number;
  if (liquidSatang >= 6n * expenseSatang) {
    score = 25;
  } else if (liquidSatang >= 3n * expenseSatang) {
    score = 18;
  } else if (liquidSatang >= 1n * expenseSatang) {
    score = 8;
  } else {
    score = 0;
  }

  return { score, missingFields: [], metricValue: months };
}

/**
 * Evaluates Debt component score (Max 25):
 * total_debt / total_assets
 * <= 20% = 25
 * <= 40% = 18
 * <= 60% = 8
 * > 60%  = 0
 * Denominator must be strictly positive (> 0).
 */
export function calculateDebtScore(
  profile: FinancialProfileInput | null
): ComponentScoreResult<number> {
  if (!profile) {
    return { score: null, missingFields: ['financialProfile'], metricValue: null };
  }

  const missingFields: string[] = [];
  const debtSatang = tryParseSatang(profile.totalDebt);
  if (debtSatang === null) {
    missingFields.push('financialProfile.totalDebt');
  }

  const assetsSatang = tryParseSatang(profile.totalAssets);
  if (assetsSatang === null || assetsSatang <= 0n) {
    missingFields.push('financialProfile.totalAssets');
  }

  if (missingFields.length > 0 || debtSatang === null || assetsSatang === null || assetsSatang <= 0n) {
    return { score: null, missingFields, metricValue: null };
  }

  const debtRatioPercent = (Number(debtSatang) / Number(assetsSatang)) * 100;

  let score: number;
  if (debtSatang * 100n <= assetsSatang * 20n) {
    score = 25;
  } else if (debtSatang * 100n <= assetsSatang * 40n) {
    score = 18;
  } else if (debtSatang * 100n <= assetsSatang * 60n) {
    score = 8;
  } else {
    score = 0;
  }

  return { score, missingFields: [], metricValue: debtRatioPercent };
}

/**
 * Evaluates Savings component score (Max 20):
 * (monthly_income - monthly_expense) / monthly_income
 * >= 20% = 20
 * >= 10% = 14
 * > 0%   = 7
 * <= 0%  = 0
 * Note: profile.savings is NOT used in this formula.
 * Denominator must be strictly positive (> 0).
 */
export function calculateSavingsScore(
  profile: FinancialProfileInput | null
): ComponentScoreResult<number> {
  if (!profile) {
    return { score: null, missingFields: ['financialProfile'], metricValue: null };
  }

  const missingFields: string[] = [];
  const incomeSatang = tryParseSatang(profile.monthlyIncome);
  if (incomeSatang === null || incomeSatang <= 0n) {
    missingFields.push('financialProfile.monthlyIncome');
  }

  const expenseSatang = tryParseSatang(profile.monthlyExpense);
  if (expenseSatang === null) {
    missingFields.push('financialProfile.monthlyExpense');
  }

  if (missingFields.length > 0 || incomeSatang === null || incomeSatang <= 0n || expenseSatang === null) {
    return { score: null, missingFields, metricValue: null };
  }

  const savingsSatang = incomeSatang - expenseSatang;
  const savingsRatePercent = (Number(savingsSatang) / Number(incomeSatang)) * 100;

  let score: number;
  if (savingsSatang <= 0n) {
    score = 0;
  } else if (savingsSatang * 100n >= incomeSatang * 20n) {
    score = 20;
  } else if (savingsSatang * 100n >= incomeSatang * 10n) {
    score = 14;
  } else {
    score = 7;
  }

  return { score, missingFields: [], metricValue: savingsRatePercent };
}

/**
 * Evaluates Investment component score (Max 15):
 * investments / total_assets
 * >= 20% = 15
 * >= 10% = 10
 * > 0%   = 5
 * <= 0%  = 0
 * Denominator must be strictly positive (> 0).
 */
export function calculateInvestmentScore(
  profile: FinancialProfileInput | null
): ComponentScoreResult<number> {
  if (!profile) {
    return { score: null, missingFields: ['financialProfile'], metricValue: null };
  }

  const missingFields: string[] = [];
  const investSatang = tryParseSatang(profile.investments);
  if (investSatang === null) {
    missingFields.push('financialProfile.investments');
  }

  const assetsSatang = tryParseSatang(profile.totalAssets);
  if (assetsSatang === null || assetsSatang <= 0n) {
    missingFields.push('financialProfile.totalAssets');
  }

  if (missingFields.length > 0 || investSatang === null || assetsSatang === null || assetsSatang <= 0n) {
    return { score: null, missingFields, metricValue: null };
  }

  const investRatePercent = (Number(investSatang) / Number(assetsSatang)) * 100;

  let score: number;
  if (investSatang <= 0n) {
    score = 0;
  } else if (investSatang * 100n >= assetsSatang * 20n) {
    score = 15;
  } else if (investSatang * 100n >= assetsSatang * 10n) {
    score = 10;
  } else {
    score = 5;
  }

  return { score, missingFields: [], metricValue: investRatePercent };
}
