import { describe, expect, it } from 'vitest';
import { generateClientSummary } from '../../../src/domain/financial/summary.js';
import type {
  HealthResult,
  PrimaryGoalResult,
  RecommendationResult,
} from '../../../src/domain/financial/types.js';

describe('Client Summary Template Generation', () => {
  const completeHealth: HealthResult = {
    score: 85.5,
    classification: 'GOOD',
    status: 'COMPLETE',
    missingFields: [],
    breakdown: { liquidity: 25, debt: 25, savings: 20, goals: 15, investment: 0.5 },
  };

  const samplePrimaryGoal: PrimaryGoalResult = {
    id: 'goal-retire',
    goalType: 'RETIREMENT',
    targetAmount: '5000000.00',
    currentAmount: '1250000.00',
    startDate: '2026-01-01',
    targetDate: '2035-01-01',
    expectedAmount: '1250000.00',
    progress: 1,
    isBehind: false,
    isCompleted: false,
  };

  it('generates complete summary with primary goal and routine recommendation', () => {
    const rec: RecommendationResult = {
      action: 'Routine Financial Review',
      reason: 'สถานะทางการเงินและเป้าหมายอยู่ในเกณฑ์ปกติ ติดตามผลตามรอบระยะเวลาปกติ',
      priority: 'LOW',
      rule: 'BR-04.6',
    };

    const summary = generateClientSummary({
      health: completeHealth,
      primaryGoal: samplePrimaryGoal,
      recommendation: rec,
    });

    expect(summary).toContain('85.50');
    expect(summary).toContain('ดี (GOOD)');
    expect(summary).toContain('goal-retire');
    expect(summary).toContain('5000000.00');
    expect(summary).toContain('Routine Financial Review');
    expect(summary).toContain('LOW');
    expect(summary).toContain('BR-04.6');
    expect(summary).not.toContain('undefined');
    expect(summary).not.toContain('null');
  });

  it('handles null primary goal gracefully without string errors', () => {
    const rec: RecommendationResult = {
      action: 'Schedule Financial Health Review',
      reason: 'คะแนนสุขภาพทางการเงินรวมอยู่ที่ 55.00 คะแนน ต่ำกว่าเกณฑ์ 60 คะแนน',
      priority: 'MEDIUM',
      rule: 'BR-04.5',
    };

    const summary = generateClientSummary({
      health: { ...completeHealth, score: 55, classification: 'AT_RISK' },
      primaryGoal: null,
      recommendation: rec,
    });

    expect(summary).toContain('ยังไม่มีเป้าหมายทางการเงินหลัก');
    expect(summary).toContain('Schedule Financial Health Review');
    expect(summary).toContain('55.00');
    expect(summary).not.toContain('undefined');
    expect(summary).not.toContain('null');
  });

  it('AUD-003: distinguishes empty goals from invalid goals truthfully in summary', () => {
    const rec: RecommendationResult = {
      action: 'Review Client Data',
      reason: 'ข้อมูลทางการเงินไม่ครบถ้วน',
      priority: 'MEDIUM',
      rule: 'BR-04.1',
    };

    // Case A: 0 goals recorded
    const summaryNoGoals = generateClientSummary({
      health: { ...completeHealth, status: 'INSUFFICIENT_DATA', score: null },
      primaryGoal: null,
      recommendation: rec,
      goalsCount: 0,
    });
    expect(summaryNoGoals).toContain('ไม่มีเป้าหมายทางการเงินที่บันทึกไว้ในระบบ');

    // Case B: Goals were recorded, but all were invalid (primaryGoal is null)
    const summaryInvalidGoals = generateClientSummary({
      health: { ...completeHealth, status: 'INSUFFICIENT_DATA', score: null },
      primaryGoal: null,
      recommendation: rec,
      goalsCount: 2,
    });
    expect(summaryInvalidGoals).toContain('ยังไม่สามารถระบุเป้าหมายทางการเงินหลักได้ (ข้อมูลเป้าหมายไม่ครบถ้วนหรือไม่ผ่านเกณฑ์)');
    // Must NOT claim no goals were recorded!
    expect(summaryInvalidGoals).not.toContain('ไม่มีเป้าหมายทางการเงินที่บันทึกไว้ในระบบ');
  });

  it('handles insufficient data status and reports missing fields in summary', () => {
    const insufficientHealth: HealthResult = {
      score: null,
      classification: null,
      status: 'INSUFFICIENT_DATA',
      missingFields: ['financialProfile.monthlyIncome', 'goals'],
      breakdown: { liquidity: 25, debt: 25, savings: null, goals: null, investment: 10 },
    };

    const rec: RecommendationResult = {
      action: 'Review Client Data',
      reason: 'ข้อมูลทางการเงินไม่ครบถ้วน (financialProfile.monthlyIncome, goals)',
      priority: 'MEDIUM',
      rule: 'BR-04.1',
    };

    const summary = generateClientSummary({
      health: insufficientHealth,
      primaryGoal: null,
      recommendation: rec,
    });

    expect(summary).toContain('ข้อมูลไม่เพียงพอ');
    expect(summary).toContain('financialProfile.monthlyIncome');
    expect(summary).toContain('Review Client Data');
    expect(summary).toContain('MEDIUM');
    expect(summary).not.toContain('undefined');
    expect(summary).not.toContain('null');
  });

  it('formats emergency fund recommendation (BR-04.2) correctly', () => {
    const rec: RecommendationResult = {
      action: 'Review Emergency Fund',
      reason: 'สภาพคล่องปัจจุบันครอบคลุมค่าใช้จ่าย 2.3 เดือน ซึ่งต่ำกว่าเกณฑ์ขั้นต่ำ 3 เดือน',
      priority: 'HIGH',
      rule: 'BR-04.2',
    };

    const summary = generateClientSummary({
      health: completeHealth,
      primaryGoal: samplePrimaryGoal,
      recommendation: rec,
    });

    expect(summary).toContain('Review Emergency Fund');
    expect(summary).toContain('HIGH');
    expect(summary).toContain('2.3 เดือน');
  });

  it('formats debt position recommendation (BR-04.3) correctly', () => {
    const rec: RecommendationResult = {
      action: 'Review Debt Position',
      reason: 'สัดส่วนหนี้สินต่อสินทรัพย์อยู่ที่ 65.00% ซึ่งสูงกว่าเกณฑ์ 60%',
      priority: 'HIGH',
      rule: 'BR-04.3',
    };

    const summary = generateClientSummary({
      health: completeHealth,
      primaryGoal: samplePrimaryGoal,
      recommendation: rec,
    });

    expect(summary).toContain('Review Debt Position');
    expect(summary).toContain('65.00%');
  });

  it('formats goal funding recommendation (BR-04.4) correctly', () => {
    const rec: RecommendationResult = {
      action: 'Review Goal Funding',
      reason: 'เป้าหมาย goal-retire มีความคืบหน้าล่าช้ากว่าแผน (เหลือเวลาอีก 180 วัน)',
      priority: 'MEDIUM',
      rule: 'BR-04.4',
    };

    const summary = generateClientSummary({
      health: completeHealth,
      primaryGoal: samplePrimaryGoal,
      recommendation: rec,
    });

    expect(summary).toContain('Review Goal Funding');
    expect(summary).toContain('180 วัน');
  });
});
