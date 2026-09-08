import { tryParseSatang } from './money.js';
import type {
  FinancialProfileInput,
  GoalEvaluationResult,
  HealthResult,
  RecommendationResult,
} from './types.js';

export interface RecommendationEvaluationContext {
  health: HealthResult;
  profile: FinancialProfileInput | null;
  evaluatedGoals: GoalEvaluationResult[];
}

/**
 * Evaluates Next Best Action (NBA) and Priority in strict priority order (BR-04 / BR-05):
 * 1. Insufficient data -> Review Client Data (MEDIUM)
 * 2. Liquidity < 3 months -> Review Emergency Fund (HIGH)
 * 3. Debt ratio > 60% -> Review Debt Position (HIGH)
 * 4. At least one Goal is behind and daysRemaining <= 365 -> Review Goal Funding (MEDIUM)
 * 5. Health score < 60 -> Schedule Financial Health Review (MEDIUM)
 * 6. None of the above -> Routine Financial Review (LOW)
 */
export function evaluateRecommendation(
  context: RecommendationEvaluationContext
): RecommendationResult {
  const { health, profile, evaluatedGoals } = context;

  // 1. Rule BR-04.1: Insufficient Data
  if (health.status === 'INSUFFICIENT_DATA') {
    const fieldsText = health.missingFields.length > 0 ? health.missingFields.join(', ') : 'ข้อมูลสำคัญ';
    return {
      rule: 'BR-04.1',
      action: 'Review Client Data',
      priority: 'MEDIUM',
      reason: `ข้อมูลทางการเงินไม่ครบถ้วน (${fieldsText}) จำเป็นต้องทบทวนและบันทึกข้อมูลเพิ่มเติม`,
    };
  }

  // Helper values for profile metrics
  const liquidSatang = profile?.liquidAssets ? tryParseSatang(profile.liquidAssets) : null;
  const expenseSatang = profile?.monthlyExpense ? tryParseSatang(profile.monthlyExpense) : null;
  const debtSatang = profile?.totalDebt ? tryParseSatang(profile.totalDebt) : null;
  const assetsSatang = profile?.totalAssets ? tryParseSatang(profile.totalAssets) : null;

  // 2. Rule BR-04.2: Liquidity months < 3
  if (liquidSatang !== null && expenseSatang !== null && expenseSatang > 0n) {
    // liquidSatang / expenseSatang < 3  <=>  liquidSatang < 3n * expenseSatang
    if (liquidSatang < 3n * expenseSatang) {
      const months = Number(liquidSatang) / Number(expenseSatang);
      const monthsText =
        Number(months.toFixed(1)) >= 3
          ? `< 3 เดือน (${months.toFixed(2)} เดือน)`
          : `${months.toFixed(1)} เดือน`;
      return {
        rule: 'BR-04.2',
        action: 'Review Emergency Fund',
        priority: 'HIGH',
        reason: `สภาพคล่องปัจจุบันครอบคลุมค่าใช้จ่าย ${monthsText} ซึ่งต่ำกว่าเกณฑ์ขั้นต่ำ 3 เดือน`,
      };
    }
  }

  // 3. Rule BR-04.3: Debt ratio > 60%
  if (debtSatang !== null && assetsSatang !== null && assetsSatang > 0n) {
    // debtSatang / assetsSatang > 60%  <=>  debtSatang * 100n > assetsSatang * 60n
    if (debtSatang * 100n > assetsSatang * 60n) {
      const debtPercent = (Number(debtSatang) / Number(assetsSatang)) * 100;
      const debtText =
        Number(debtPercent.toFixed(2)) <= 60
          ? `> 60% (${debtPercent.toFixed(3)}%)`
          : `${debtPercent.toFixed(2)}%`;
      return {
        rule: 'BR-04.3',
        action: 'Review Debt Position',
        priority: 'HIGH',
        reason: `สัดส่วนหนี้สินต่อสินทรัพย์อยู่ที่ ${debtText} ซึ่งสูงกว่าเกณฑ์ 60%`,
      };
    }
  }

  // 4. Rule BR-04.4: At least one Goal is behind and days remaining <= 365
  // Check ALL valid goals
  const qualifyingBehindGoals = evaluatedGoals.filter(
    (g) => g.isValid && g.isBehind && g.daysRemaining <= 365
  );

  if (qualifyingBehindGoals.length > 0) {
    // Pick the one with earliest targetDate, tie-break by id ascending
    const sortedBehind = [...qualifyingBehindGoals].sort((a, b) => {
      if (a.targetDate !== b.targetDate) {
        return a.targetDate < b.targetDate ? -1 : 1;
      }
      return a.id.localeCompare(b.id);
    });

    const chosenGoal = sortedBehind[0];
    if (chosenGoal) {
      const timeText =
        chosenGoal.daysRemaining > 0
          ? `เหลือเวลาอีก ${chosenGoal.daysRemaining} วัน`
          : chosenGoal.daysRemaining === 0
          ? 'ครบกำหนดในวันนี้'
          : `เลยกำหนดเป้าหมายแล้ว ${Math.abs(chosenGoal.daysRemaining)} วัน`;

      return {
        rule: 'BR-04.4',
        action: 'Review Goal Funding',
        priority: 'MEDIUM',
        reason: `เป้าหมาย ${chosenGoal.id} มีความคืบหน้าล่าช้ากว่าแผน (${timeText}) ยอดปัจจุบัน ${chosenGoal.currentAmount} จากเป้าหมาย ${chosenGoal.targetAmount}`,
      };
    }

  }

  // 5. Rule BR-04.5: Health score < 60
  if (health.score !== null && health.score < 60) {
    return {
      rule: 'BR-04.5',
      action: 'Schedule Financial Health Review',
      priority: 'MEDIUM',
      reason: `คะแนนสุขภาพทางการเงินรวมอยู่ที่ ${health.score.toFixed(2)} คะแนน ต่ำกว่าเกณฑ์ 60 คะแนน`,
    };
  }

  // 6. Rule BR-04.6: Routine Review
  return {
    rule: 'BR-04.6',
    action: 'Routine Financial Review',
    priority: 'LOW',
    reason: 'สถานะทางการเงินและเป้าหมายอยู่ในเกณฑ์ปกติ ติดตามผลตามรอบระยะเวลาปกติ',
  };
}
