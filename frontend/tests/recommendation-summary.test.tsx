import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { RecommendationCard } from '../components/recommendation-card.js';
import { SummaryPanel } from '../components/summary-panel.js';
import type { RecommendationResult, RecommendationRuleId, RecommendationAction } from '../lib/api-contracts.js';

describe('RecommendationCard (M4-012)', () => {
  const rulesTestCases: Array<{
    rule: RecommendationRuleId;
    action: RecommendationAction;
    priority: 'HIGH' | 'MEDIUM' | 'LOW';
    reason: string;
  }> = [
    {
      rule: 'BR-04.1',
      action: 'Review Client Data',
      priority: 'MEDIUM',
      reason: 'ข้อมูลทางการเงินไม่ครบถ้วน จำเป็นต้องทบทวนและบันทึกข้อมูลเพิ่มเติม',
    },
    {
      rule: 'BR-04.2',
      action: 'Review Emergency Fund',
      priority: 'HIGH',
      reason: 'สภาพคล่องปัจจุบันครอบคลุมค่าใช้จ่าย < 3 เดือน ซึ่งต่ำกว่าเกณฑ์ขั้นต่ำ 3 เดือน',
    },
    {
      rule: 'BR-04.3',
      action: 'Review Debt Position',
      priority: 'HIGH',
      reason: 'ภาระหนี้สินเทียบกับสินทรัพย์รวมสูงเกิน 60% ควรพิจารณาแผนการชำระหนี้',
    },
    {
      rule: 'BR-04.4',
      action: 'Review Goal Funding',
      priority: 'MEDIUM',
      reason: 'มีเป้าหมายที่ล่าช้ากว่าแผนและใกล้ถึงกำหนดภายใน 1 ปี',
    },
    {
      rule: 'BR-04.5',
      action: 'Schedule Financial Health Review',
      priority: 'MEDIUM',
      reason: 'คะแนนสุขภาพทางการเงินรวมต่ำกว่า 60 คะแนน ควรนัดหมายวางแผนทางการเงินเชิงลึก',
    },
    {
      rule: 'BR-04.6',
      action: 'Routine Financial Review',
      priority: 'LOW',
      reason: 'สุขภาพทางการเงินอยู่ในเกณฑ์ปกติ ติดตามและทบทวนตามรอบปกติ',
    },
  ];

  rulesTestCases.forEach(({ rule, action, priority, reason }) => {
    it(`renders rule ${rule} (${action}) with priority ${priority}`, () => {
      const rec: RecommendationResult = {
        rule,
        action,
        priority,
      reason,
      };

      render(<RecommendationCard recommendation={rec} />);

      expect(screen.getByTestId('recommendation-card')).toBeInTheDocument();
      expect(screen.getByTestId('nba-rule-id')).toHaveTextContent(rule);
      expect(screen.getByTestId('profile-nba-action')).toHaveTextContent(action);
      expect(screen.getByTestId('profile-nba-reason')).toHaveTextContent(reason);

      const priorityBadge = screen.getByTestId('priority-badge');
      expect(priorityBadge).toHaveTextContent(priority);
    });
  });
});

describe('SummaryPanel (M4-012)', () => {
  it('renders summary text safely without HTML injection', () => {
    const rawSummary = 'Client maintains a strong net worth of ฿5,000,000. <script>alert("xss")</script>';
    render(<SummaryPanel summary={rawSummary} />);

    const summaryEl = screen.getByTestId('profile-summary-text');
    expect(summaryEl).toBeInTheDocument();
    expect(summaryEl.textContent).toContain('<script>alert("xss")</script>');
    // Ensure script tag is rendered as literal text, not HTML element
    expect(document.querySelector('script')).toBeNull();
  });

  it('renders standard executive summary text cleanly', () => {
    const summary = 'Client profile in good standing with balanced cash flow.';
    render(<SummaryPanel summary={summary} />);

    expect(screen.getByRole('heading', { name: /Executive Portfolio Summary/i })).toBeInTheDocument();
    expect(screen.getByTestId('profile-summary-text')).toHaveTextContent(summary);
  });
});
