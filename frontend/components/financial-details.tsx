'use client';

import React from 'react';
import type {
  ClientFinancialProfileDetail,
  ClientGoalDetail,
  PrimaryGoalResult,
} from '../lib/api-contracts.js';
import {
  formatCurrency,
  formatDateOnly,
  formatProgressPercent,
} from '../lib/display-format.js';

export interface FinancialProfilePanelProps {
  financialProfile: ClientFinancialProfileDetail | null;
}

export function FinancialProfilePanel({
  financialProfile,
}: FinancialProfilePanelProps) {
  if (!financialProfile) {
    return (
      <section
        aria-labelledby="financial-profile-heading"
        data-testid="profile-incomplete-financial"
        style={{
          padding: '1.5rem',
          backgroundColor: 'var(--bg-surface)',
          borderRadius: 'var(--radius-md)',
          border: '1px solid var(--border-color)',
        }}
      >
        <h2
          id="financial-profile-heading"
          style={{ fontSize: '1.125rem', fontWeight: 600, color: 'var(--text-primary)' }}
        >
          Financial Profile
        </h2>
        <p style={{ marginTop: '0.5rem', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
          No financial profile recorded for this client. Client financial onboarding is incomplete.
        </p>
      </section>
    );
  }

  const metrics = [
    { label: 'Monthly Income', value: financialProfile.monthlyIncome, testId: 'fin-monthly-income' },
    { label: 'Monthly Expense', value: financialProfile.monthlyExpense, testId: 'fin-monthly-expense' },
    { label: 'Liquid Assets', value: financialProfile.liquidAssets, testId: 'fin-liquid-assets' },
    { label: 'Total Assets', value: financialProfile.totalAssets, testId: 'fin-total-assets' },
    { label: 'Total Debt', value: financialProfile.totalDebt, testId: 'fin-total-debt' },
    { label: 'Savings', value: financialProfile.savings, testId: 'fin-savings' },
    { label: 'Investments', value: financialProfile.investments, testId: 'fin-investments' },
  ];

  return (
    <section
      aria-labelledby="financial-profile-heading"
      data-testid="financial-profile-panel"
      style={{
        padding: '1.5rem',
        backgroundColor: 'var(--bg-surface)',
        borderRadius: 'var(--radius-md)',
        border: '1px solid var(--border-color)',
        boxShadow: 'var(--shadow-sm)',
      }}
    >
      <h2
        id="financial-profile-heading"
        style={{ fontSize: '1.125rem', fontWeight: 600, color: 'var(--text-primary)' }}
      >
        Financial Profile
      </h2>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: '1rem',
          marginTop: '1.25rem',
        }}
      >
        {metrics.map((metric) => (
          <div
            key={metric.label}
            style={{
              padding: '0.875rem 1rem',
              backgroundColor: 'var(--bg-muted)',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border-color)',
            }}
          >
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 500 }}>
              {metric.label}
            </div>
            <div
              data-testid={metric.testId}
              style={{
                fontSize: '1.0625rem',
                fontWeight: 700,
                color: 'var(--text-primary)',
                marginTop: '0.25rem',
              }}
            >
              {formatCurrency(metric.value)}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

export interface GoalsPanelProps {
  primaryGoal: PrimaryGoalResult | null;
  goals: ClientGoalDetail[];
}

export function GoalsPanel({ primaryGoal, goals }: GoalsPanelProps) {
  if (!primaryGoal && goals.length === 0) {
    return (
      <section
        aria-labelledby="goals-heading"
        data-testid="goals-panel-empty"
        style={{
          padding: '1.5rem',
          backgroundColor: 'var(--bg-surface)',
          borderRadius: 'var(--radius-md)',
          border: '1px solid var(--border-color)',
        }}
      >
        <h2
          id="goals-heading"
          style={{ fontSize: '1.125rem', fontWeight: 600, color: 'var(--text-primary)' }}
        >
          Financial Goals
        </h2>
        <p style={{ marginTop: '0.5rem', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
          No active financial goals recorded for this client.
        </p>
      </section>
    );
  }

  return (
    <section
      aria-labelledby="goals-heading"
      data-testid="goals-panel"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '1.25rem',
        padding: '1.5rem',
        backgroundColor: 'var(--bg-surface)',
        borderRadius: 'var(--radius-md)',
        border: '1px solid var(--border-color)',
        boxShadow: 'var(--shadow-sm)',
      }}
    >
      <h2
        id="goals-heading"
        style={{ fontSize: '1.125rem', fontWeight: 600, color: 'var(--text-primary)' }}
      >
        Financial Goals
      </h2>

      {/* Primary Goal Highlight Card */}
      {primaryGoal && (
        <div
          data-testid="primary-goal-card"
          style={{
            padding: '1.25rem',
            backgroundColor: 'var(--bg-card)',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--border-color)',
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <span
                style={{
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  color: 'var(--primary)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                }}
              >
                Primary Goal
              </span>
              <h3
                data-testid="primary-goal-type"
                style={{ fontSize: '1.125rem', fontWeight: 700, color: 'var(--text-primary)' }}
              >
                {primaryGoal.goalType || 'Goal'}
              </h3>
            </div>

            {/* Status Badge */}
            <div>
              {primaryGoal.isCompleted ? (
                <span
                  data-testid="primary-goal-status"
                  style={{
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    padding: '0.25rem 0.625rem',
                    borderRadius: 'var(--radius-sm)',
                    backgroundColor: 'var(--priority-low-bg)',
                    color: 'var(--priority-low-text)',
                    border: '1px solid var(--priority-low-border)',
                  }}
                >
                  Completed
                </span>
              ) : primaryGoal.isBehind ? (
                <span
                  data-testid="primary-goal-status"
                  style={{
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    padding: '0.25rem 0.625rem',
                    borderRadius: 'var(--radius-sm)',
                    backgroundColor: 'var(--priority-high-bg)',
                    color: 'var(--priority-high-text)',
                    border: '1px solid var(--priority-high-border)',
                  }}
                >
                  Behind Schedule
                </span>
              ) : (
                <span
                  data-testid="primary-goal-status"
                  style={{
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    padding: '0.25rem 0.625rem',
                    borderRadius: 'var(--radius-sm)',
                    backgroundColor: 'var(--health-good-bg)',
                    color: 'var(--health-good-text)',
                    border: '1px solid var(--health-good-border)',
                  }}
                >
                  On Track
                </span>
              )}
            </div>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
              gap: '0.75rem',
            }}
          >
            <div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Target Amount</div>
              <div
                data-testid="primary-goal-target"
                style={{ fontSize: '0.9375rem', fontWeight: 600, color: 'var(--text-primary)' }}
              >
                {formatCurrency(primaryGoal.targetAmount)}
              </div>
            </div>

            <div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Current Amount</div>
              <div
                data-testid="primary-goal-current"
                style={{ fontSize: '0.9375rem', fontWeight: 600, color: 'var(--text-primary)' }}
              >
                {formatCurrency(primaryGoal.currentAmount)}
              </div>
            </div>

            <div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Expected Amount</div>
              <div
                data-testid="primary-goal-expected"
                style={{ fontSize: '0.9375rem', fontWeight: 600, color: 'var(--text-primary)' }}
              >
                {formatCurrency(primaryGoal.expectedAmount)}
              </div>
            </div>

            <div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                On-track progress
              </div>
              <div
                data-testid="primary-goal-progress"
                style={{ fontSize: '0.9375rem', fontWeight: 700, color: 'var(--primary)' }}
              >
                {formatProgressPercent(primaryGoal.progress)}
              </div>
            </div>

            <div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Timeline</div>
              <div
                data-testid="primary-goal-timeline"
                style={{ fontSize: '0.8125rem', fontWeight: 500, color: 'var(--text-secondary)' }}
              >
                {formatDateOnly(primaryGoal.startDate)} → {formatDateOnly(primaryGoal.targetDate)}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Other Goals List */}
      {goals.length > 0 && (
        <div style={{ overflowX: 'auto', marginTop: '0.5rem' }}>
          <h4 style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
            All Active Goals ({goals.length})
          </h4>
          <table
            style={{
              width: '100%',
              borderCollapse: 'collapse',
              fontSize: '0.8125rem',
              textAlign: 'left',
            }}
          >
            <thead>
              <tr
                style={{
                  borderBottom: '1px solid var(--border-color)',
                  backgroundColor: 'var(--bg-muted)',
                  color: 'var(--text-secondary)',
                }}
              >
                <th style={{ padding: '0.5rem 0.75rem' }}>Goal Type</th>
                <th style={{ padding: '0.5rem 0.75rem' }}>Current Amount</th>
                <th style={{ padding: '0.5rem 0.75rem' }}>Target Amount</th>
                <th style={{ padding: '0.5rem 0.75rem' }}>Start Date</th>
                <th style={{ padding: '0.5rem 0.75rem' }}>Target Date</th>
              </tr>
            </thead>
            <tbody>
              {goals.map((goal) => (
                <tr
                  key={goal.id}
                  style={{ borderBottom: '1px solid var(--border-color)' }}
                >
                  <td style={{ padding: '0.625rem 0.75rem', fontWeight: 600 }}>{goal.goalType}</td>
                  <td style={{ padding: '0.625rem 0.75rem' }}>{formatCurrency(goal.currentAmount)}</td>
                  <td style={{ padding: '0.625rem 0.75rem' }}>{formatCurrency(goal.targetAmount)}</td>
                  <td style={{ padding: '0.625rem 0.75rem', color: 'var(--text-secondary)' }}>
                    {formatDateOnly(goal.startDate)}
                  </td>
                  <td style={{ padding: '0.625rem 0.75rem', color: 'var(--text-secondary)' }}>
                    {formatDateOnly(goal.targetDate)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
