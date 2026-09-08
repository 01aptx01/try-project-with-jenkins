import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AppShell } from '../components/app-shell.js';
import { LoginForm } from '../components/login-form.js';
import { PriorityBadge, HealthBadge, RiskBadge } from '../components/ui/badges.js';
import { HealthPanel } from '../components/health-panel.js';
import { RecommendationCard } from '../components/recommendation-card.js';
import { SummaryPanel } from '../components/summary-panel.js';
import { GoalsPanel } from '../components/financial-details.js';
import { FamilySection } from '../components/family-section.js';
import type { HealthResult, RecommendationResult } from '../lib/api-contracts.js';

// Mock Next.js navigation
const mockPush = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
  usePathname: () => '/dashboard',
  useSearchParams: () => new URLSearchParams(),
}));

// Mock SessionProvider hook
vi.mock('../components/session-provider.js', () => ({
  useSession: () => ({
    user: { id: 'rm-1', name: 'John Doe', role: 'RM' },
    isAuthenticated: true,
    isLoading: false,
    logout: vi.fn(),
  }),
}));

describe('M4-016: Usability & WCAG 2.2 Accessibility Audits', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Dimension 1 & 5: Non-color reliance and semantic badges (SC 1.4.1, SC 1.4.3)', () => {
    it('PriorityBadge renders explicit textual priority level without relying on color alone', () => {
      const { rerender } = render(<PriorityBadge priority="HIGH" />);
      expect(screen.getByTestId('priority-badge')).toHaveTextContent('Priority: HIGH');

      rerender(<PriorityBadge priority="MEDIUM" />);
      expect(screen.getByTestId('priority-badge')).toHaveTextContent('Priority: MEDIUM');

      rerender(<PriorityBadge priority="LOW" />);
      expect(screen.getByTestId('priority-badge')).toHaveTextContent('Priority: LOW');
    });

    it('HealthBadge renders score and textual classification without relying on color alone', () => {
      const completeHealth: HealthResult = {
        status: 'COMPLETE',
        score: 75,
        classification: 'GOOD',
        breakdown: { liquidity: 15, debt: 15, savings: 15, goals: 15, investment: 15 },
        missingFields: [],
      };

      const { rerender } = render(<HealthBadge health={completeHealth} />);
      expect(screen.getByText('Health: 75/100 (GOOD)')).toBeInTheDocument();

      const insufficientHealth: HealthResult = {
        status: 'INSUFFICIENT_DATA',
        score: null,
        classification: null,
        breakdown: { liquidity: null, debt: null, savings: null, goals: null, investment: null },
        missingFields: ['totalAssets'],
      };

      rerender(<HealthBadge health={insufficientHealth} />);
      expect(screen.getByText('Health: Not available')).toBeInTheDocument();
    });

    it('RiskBadge renders clear text prefix', () => {
      render(<RiskBadge riskLevel="AGGRESSIVE" />);
      expect(screen.getByText('Risk: AGGRESSIVE')).toBeInTheDocument();
    });
  });

  describe('Dimension 3: Keyboard Navigation & Bypass Blocks (SC 2.4.1, SC 2.1.1)', () => {
    it('AppShell contains a Skip to main content link targeting main landmark id', () => {
      render(
        <AppShell>
          <div>Test Content</div>
        </AppShell>
      );

      const skipLink = screen.getByRole('link', { name: /skip to main content/i });
      expect(skipLink).toBeInTheDocument();
      expect(skipLink).toHaveAttribute('href', '#main-content');

      const mainLandmark = screen.getByRole('main');
      expect(mainLandmark).toHaveAttribute('id', 'main-content');
    });

    it('Navigation links have proper landmarks and accessible current page indicators', () => {
      render(
        <AppShell>
          <div>Test Content</div>
        </AppShell>
      );

      const mainNav = screen.getByRole('navigation', { name: /main navigation/i });
      expect(mainNav).toBeInTheDocument();

      const dashboardLink = screen.getByRole('link', { name: /morning action plan/i });
      expect(dashboardLink).toHaveAttribute('aria-current', 'page');
    });
  });

  describe('Dimension 4: Semantic Hierarchy, Landmarks & ARIA (SC 1.3.1, SC 4.1.2)', () => {
    it('LoginForm provides proper heading, labels, and aria-live polite alert', () => {
      render(<LoginForm />);

      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Meridian RM Portal');
      expect(screen.getByLabelText(/email address/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
    });

    it('HealthPanel provides progressbar roles and missing fields alerts', () => {
      const health: HealthResult = {
        status: 'INSUFFICIENT_DATA',
        score: null,
        classification: null,
        breakdown: { liquidity: null, debt: null, savings: null, goals: null, investment: null },
        missingFields: ['totalDebt', 'monthlyExpense'],
      };

      render(<HealthPanel health={health} />);

      expect(screen.getByRole('region', { name: /financial health analysis/i })).toBeInTheDocument();
      expect(screen.getByRole('region', { name: /missing fields notice/i })).toBeInTheDocument();
      expect(screen.getByText('totalDebt')).toBeInTheDocument();
      expect(screen.getByText('monthlyExpense')).toBeInTheDocument();

      // On null scores, role="progressbar" is omitted to avoid falsely announcing 0 (AUD-M4-008)
      expect(screen.queryAllByRole('progressbar')).toHaveLength(0);

      // When scores are present, role="progressbar" is rendered for all 5 components
      const completeHealth: HealthResult = {
        status: 'COMPLETE',
        score: 75,
        classification: 'GOOD',
        breakdown: { liquidity: 15, debt: 15, savings: 15, goals: 15, investment: 15 },
        missingFields: [],
      };
      render(<HealthPanel health={completeHealth} />);
      expect(screen.getAllByRole('progressbar')).toHaveLength(5);
    });

    it('RecommendationCard provides section with accessible heading and badge', () => {
      const recommendation: RecommendationResult = {
        rule: 'BR-04.1',
        action: 'Review Debt Position',
        reason: 'Debt service ratio exceeds conservative limits.',
        priority: 'HIGH',
      };

      render(<RecommendationCard recommendation={recommendation} />);

      expect(screen.getByRole('region', { name: /next best action/i })).toBeInTheDocument();
      expect(screen.getByTestId('profile-nba-action')).toHaveTextContent('Review Debt Position');
      expect(screen.getByTestId('nba-rule-id')).toHaveTextContent('BR-04.1');
    });

    it('SummaryPanel provides executive portfolio summary landmark', () => {
      render(<SummaryPanel summary="Client possesses strong liquid assets." />);

      expect(
        screen.getByRole('region', { name: /executive portfolio summary/i })
      ).toBeInTheDocument();
      expect(screen.getByTestId('profile-summary-text')).toHaveTextContent(
        'Client possesses strong liquid assets.'
      );
    });
  });

  describe('Dimension 4: Responsive tables with keyboard scrollable regions (SC 2.1.1, SC 1.3.1)', () => {
    it('Goals table provides keyboard-focusable role=region with aria-label', () => {
      render(
        <GoalsPanel
          primaryGoal={null}
          goals={[
            {
              id: 'g-1',
              goalType: 'Retirement',
              targetAmount: '5000000',
              currentAmount: '2500000',
              startDate: '2020-01-01',
              targetDate: '2030-01-01',
            },
          ]}
        />
      );

      const tableRegion = screen.getByRole('region', { name: /active goals table/i });
      expect(tableRegion).toBeInTheDocument();
      expect(tableRegion).toHaveAttribute('tabIndex', '0');
    });
  });

  describe('Dimension 5: Status announcements and toggles (SC 4.1.3, SC 2.5.8)', () => {
    it('FamilySection toggle provides aria-expanded attribute and minimum target size', () => {
      render(<FamilySection clientId="c-1" defaultExpanded={false} />);

      const toggleBtn = screen.getByTestId('toggle-family-btn');
      expect(toggleBtn).toBeInTheDocument();
      expect(toggleBtn).toHaveAttribute('aria-expanded', 'false');
    });
  });
});
