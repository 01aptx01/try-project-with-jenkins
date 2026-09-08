import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { HealthPanel } from '../components/health-panel.js';
import type { HealthResult } from '../lib/api-contracts.js';

describe('M4-011: HealthPanel Component', () => {
  it('renders COMPLETE health result with score, classification, and full breakdown', () => {
    const health: HealthResult = {
      score: 68,
      classification: 'MODERATE',
      status: 'COMPLETE',
      missingFields: [],
      breakdown: {
        liquidity: 15,
        debt: 18,
        savings: 10,
        goals: 15,
        investment: 10,
      },
    };

    render(<HealthPanel health={health} />);

    // Overall score
    expect(screen.getByTestId('health-overall-score-display')).toHaveTextContent('68 / 100');
    expect(screen.getByTestId('health-status-text')).toHaveTextContent('Classification: MODERATE');

    // Pillars breakdown
    expect(screen.getByTestId('health-comp-liquidity-score')).toHaveTextContent('15 / 20');
    expect(screen.getByTestId('health-comp-debt-score')).toHaveTextContent('18 / 20');
    expect(screen.getByTestId('health-comp-savings-score')).toHaveTextContent('10 / 20');
    expect(screen.getByTestId('health-comp-goals-score')).toHaveTextContent('15 / 20');
    expect(screen.getByTestId('health-comp-investment-score')).toHaveTextContent('10 / 20');

    // Missing fields should not be present
    expect(screen.queryByTestId('health-missing-fields-notice')).not.toBeInTheDocument();
  });

  describe('score boundary classifications', () => {
    it('handles 0 and 59.99 as AT_RISK', () => {
      const atRisk0: HealthResult = {
        score: 0,
        classification: 'AT_RISK',
        status: 'COMPLETE',
        missingFields: [],
        breakdown: { liquidity: 0, debt: 0, savings: 0, goals: 0, investment: 0 },
      };
      const { rerender } = render(<HealthPanel health={atRisk0} />);
      expect(screen.getByTestId('health-overall-score-display')).toHaveTextContent('0 / 100');
      expect(screen.getByTestId('health-status-text')).toHaveTextContent('Classification: AT_RISK');

      const atRisk59: HealthResult = {
        ...atRisk0,
        score: 59.99,
      };
      rerender(<HealthPanel health={atRisk59} />);
      expect(screen.getByTestId('health-overall-score-display')).toHaveTextContent('59.99 / 100');
      expect(screen.getByTestId('health-status-text')).toHaveTextContent('Classification: AT_RISK');
    });

    it('handles 60 and 79.99 as MODERATE', () => {
      const moderate60: HealthResult = {
        score: 60,
        classification: 'MODERATE',
        status: 'COMPLETE',
        missingFields: [],
        breakdown: { liquidity: 12, debt: 12, savings: 12, goals: 12, investment: 12 },
      };
      const { rerender } = render(<HealthPanel health={moderate60} />);
      expect(screen.getByTestId('health-overall-score-display')).toHaveTextContent('60 / 100');
      expect(screen.getByTestId('health-status-text')).toHaveTextContent('Classification: MODERATE');

      const moderate79: HealthResult = {
        ...moderate60,
        score: 79.99,
      };
      rerender(<HealthPanel health={moderate79} />);
      expect(screen.getByTestId('health-overall-score-display')).toHaveTextContent('79.99 / 100');
      expect(screen.getByTestId('health-status-text')).toHaveTextContent('Classification: MODERATE');
    });

    it('handles 80 and 100 as GOOD', () => {
      const good80: HealthResult = {
        score: 80,
        classification: 'GOOD',
        status: 'COMPLETE',
        missingFields: [],
        breakdown: { liquidity: 16, debt: 16, savings: 16, goals: 16, investment: 16 },
      };
      const { rerender } = render(<HealthPanel health={good80} />);
      expect(screen.getByTestId('health-overall-score-display')).toHaveTextContent('80 / 100');
      expect(screen.getByTestId('health-status-text')).toHaveTextContent('Classification: GOOD');

      const good100: HealthResult = {
        ...good80,
        score: 100,
        breakdown: { liquidity: 20, debt: 20, savings: 20, goals: 20, investment: 20 },
      };
      rerender(<HealthPanel health={good100} />);
      expect(screen.getByTestId('health-overall-score-display')).toHaveTextContent('100 / 100');
      expect(screen.getByTestId('health-status-text')).toHaveTextContent('Classification: GOOD');
    });
  });

  describe('INSUFFICIENT_DATA and partial breakdowns', () => {
    it('displays Not available for null score and preserves 0 vs null in breakdown', () => {
      const insufficientHealth: HealthResult = {
        score: null,
        classification: null,
        status: 'INSUFFICIENT_DATA',
        missingFields: ['financialProfile', 'customField.nestedPath'],
        breakdown: {
          liquidity: 0, // 0 must display as 0 / 20
          debt: null, // null must display as Not available
          savings: null,
          goals: 12, // partial calculation
          investment: null,
        },
      };

      render(<HealthPanel health={insufficientHealth} />);

      // Score must NOT be 0 or falsy converted
      expect(screen.getByTestId('health-overall-score-display')).toHaveTextContent('Not available');
      expect(screen.getByTestId('health-status-text')).toHaveTextContent(
        'Status: Insufficient Data for Calculation'
      );

      // Missing fields listed
      expect(screen.getByTestId('health-missing-fields-notice')).toBeInTheDocument();
      expect(screen.getByTestId('missing-field-financialProfile')).toHaveTextContent('financialProfile');
      expect(screen.getByTestId('missing-field-customField.nestedPath')).toHaveTextContent(
        'customField.nestedPath'
      );

      // Breakdown differentiation
      expect(screen.getByTestId('health-comp-liquidity-score')).toHaveTextContent('0 / 20');
      expect(screen.getByTestId('health-comp-debt-score')).toHaveTextContent('Not available');
      expect(screen.getByTestId('health-comp-goals-score')).toHaveTextContent('12 / 20');
      expect(screen.getByTestId('health-comp-investment-score')).toHaveTextContent('Not available');
    });
  });
});
