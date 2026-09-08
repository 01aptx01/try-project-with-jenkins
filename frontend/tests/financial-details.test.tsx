import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import {
  FinancialProfilePanel,
  GoalsPanel,
} from '../components/financial-details.js';
import {
  formatCurrency,
  formatDateOnly,
  formatProgressPercent,
} from '../lib/display-format.js';
import type {
  ClientFinancialProfileDetail,
  PrimaryGoalResult,
  ClientGoalDetail,
} from '../lib/api-contracts.js';

describe('M4-010: Display Formatting & Financial Details', () => {
  describe('display-format utilities', () => {
    it('formats currency correctly and preserves exact decimal precision without float loss', () => {
      expect(formatCurrency('150000.00')).toBe('150,000.00');
      expect(formatCurrency('95000.50')).toBe('95,000.50');
      // Huge amount
      expect(formatCurrency('1234567890.75')).toBe('1,234,567,890.75');
    });

    it('strictly differentiates between zero and null', () => {
      // Zero must show 0.00
      expect(formatCurrency('0.00')).toBe('0.00');
      expect(formatCurrency('0')).toBe('0.00');
      expect(formatCurrency(0)).toBe('0.00');

      // Null or undefined must show fallback
      expect(formatCurrency(null)).toBe('—');
      expect(formatCurrency(undefined)).toBe('—');
      expect(formatCurrency('')).toBe('—');
    });

    it('formats date-only strings without timezone drift', () => {
      expect(formatDateOnly('2026-09-08')).toBe('8 Sep 2026');
      expect(formatDateOnly('2025-01-01')).toBe('1 Jan 2025');
      expect(formatDateOnly('2035-12-31')).toBe('31 Dec 2035');
      expect(formatDateOnly(null)).toBe('—');
    });

    it('formats progress percentages cleanly', () => {
      expect(formatProgressPercent(0.59)).toBe('59%');
      expect(formatProgressPercent(1.0)).toBe('100%');
      expect(formatProgressPercent(0)).toBe('0%');
      expect(formatProgressPercent(null)).toBe('0%');
    });
  });

  describe('FinancialProfilePanel', () => {
    it('renders all 7 monetary metrics for a complete financial profile', () => {
      const financialProfile: ClientFinancialProfileDetail = {
        id: 'fin-1',
        monthlyIncome: '150000.00',
        monthlyExpense: '95000.00',
        liquidAssets: '200000.00',
        totalAssets: '5500000.00',
        totalDebt: '2100000.00',
        savings: '350000.00',
        investments: '1500000.00',
      };

      render(<FinancialProfilePanel financialProfile={financialProfile} />);

      expect(screen.getByTestId('fin-monthly-income')).toHaveTextContent('150,000.00');
      expect(screen.getByTestId('fin-monthly-expense')).toHaveTextContent('95,000.00');
      expect(screen.getByTestId('fin-liquid-assets')).toHaveTextContent('200,000.00');
      expect(screen.getByTestId('fin-total-assets')).toHaveTextContent('5,500,000.00');
      expect(screen.getByTestId('fin-total-debt')).toHaveTextContent('2,100,000.00');
      expect(screen.getByTestId('fin-savings')).toHaveTextContent('350,000.00');
      expect(screen.getByTestId('fin-investments')).toHaveTextContent('1,500,000.00');
    });

    it('distinguishes between zero and null fields in a partial profile', () => {
      const partialProfile: ClientFinancialProfileDetail = {
        id: 'fin-partial',
        monthlyIncome: '100000.00',
        monthlyExpense: '0.00', // Zero expense
        liquidAssets: null, // Null liquid assets
        totalAssets: '1000000.00',
        totalDebt: '0.00', // Zero debt
        savings: null,
        investments: null,
      };

      render(<FinancialProfilePanel financialProfile={partialProfile} />);

      // Zero fields show 0.00
      expect(screen.getByTestId('fin-monthly-expense')).toHaveTextContent('0.00');
      expect(screen.getByTestId('fin-total-debt')).toHaveTextContent('0.00');

      // Null fields show —
      expect(screen.getByTestId('fin-liquid-assets')).toHaveTextContent('—');
      expect(screen.getByTestId('fin-savings')).toHaveTextContent('—');
      expect(screen.getByTestId('fin-investments')).toHaveTextContent('—');
    });

    it('displays empty onboarding message when financialProfile is null', () => {
      render(<FinancialProfilePanel financialProfile={null} />);

      expect(screen.getByTestId('profile-incomplete-financial')).toHaveTextContent(
        /no financial profile recorded for this client/i
      );
    });
  });

  describe('GoalsPanel', () => {
    const primaryGoalBehind: PrimaryGoalResult = {
      id: 'g-1',
      goalType: 'RETIREMENT',
      targetAmount: '10000000.00',
      currentAmount: '2500000.00',
      expectedAmount: '4218750.00',
      startDate: '2020-01-01',
      targetDate: '2035-12-31',
      progress: 0.59,
      isBehind: true,
      isCompleted: false,
    };

    const secondaryGoal: ClientGoalDetail = {
      id: 'g-2',
      goalType: 'EDUCATION',
      targetAmount: '2000000.00',
      currentAmount: '1500000.00',
      startDate: '2022-06-01',
      targetDate: '2030-05-31',
    };

    it('renders primary goal with Behind Schedule status and On-track progress label', () => {
      render(
        <GoalsPanel primaryGoal={primaryGoalBehind} goals={[secondaryGoal]} />
      );

      expect(screen.getByTestId('primary-goal-type')).toHaveTextContent('RETIREMENT');
      expect(screen.getByTestId('primary-goal-target')).toHaveTextContent('10,000,000.00');
      expect(screen.getByTestId('primary-goal-current')).toHaveTextContent('2,500,000.00');
      expect(screen.getByTestId('primary-goal-expected')).toHaveTextContent('4,218,750.00');
      expect(screen.getByTestId('primary-goal-progress')).toHaveTextContent('59%');
      expect(screen.getByText('On-track progress')).toBeInTheDocument();
      expect(screen.getByTestId('primary-goal-status')).toHaveTextContent('Behind Schedule');
      expect(screen.getByTestId('primary-goal-timeline')).toHaveTextContent('1 Jan 2020 → 31 Dec 2035');

      // Table displays secondary goal
      expect(screen.getByText('EDUCATION')).toBeInTheDocument();
      expect(screen.getByText('1,500,000.00')).toBeInTheDocument();
    });

    it('renders Completed status badge when primary goal is completed', () => {
      const completedGoal: PrimaryGoalResult = {
        ...primaryGoalBehind,
        currentAmount: '10000000.00',
        progress: 1.0,
        isBehind: false,
        isCompleted: true,
      };

      render(<GoalsPanel primaryGoal={completedGoal} goals={[]} />);

      expect(screen.getByTestId('primary-goal-status')).toHaveTextContent('Completed');
      expect(screen.getByTestId('primary-goal-progress')).toHaveTextContent('100%');
    });

    it('renders On Track status badge when primary goal is progressing normally', () => {
      const onTrackGoal: PrimaryGoalResult = {
        ...primaryGoalBehind,
        progress: 0.85,
        isBehind: false,
        isCompleted: false,
      };

      render(<GoalsPanel primaryGoal={onTrackGoal} goals={[]} />);

      expect(screen.getByTestId('primary-goal-status')).toHaveTextContent('On Track');
      expect(screen.getByTestId('primary-goal-progress')).toHaveTextContent('85%');
    });

    it('displays empty state message when both primaryGoal and goals are null/empty', () => {
      render(<GoalsPanel primaryGoal={null} goals={[]} />);

      expect(screen.getByTestId('goals-panel-empty')).toHaveTextContent(
        /no active financial goals recorded for this client/i
      );
    });
  });
});
