import type {
  HealthResult,
  PrimaryGoalResult,
  RecommendationResult,
} from './types.js';

export interface SummaryContext {
  health: HealthResult;
  primaryGoal: PrimaryGoalResult | null;
  recommendation: RecommendationResult;
  goalsCount?: number;
}

/**
 * Generates a deterministic, templated Thai client summary based on already evaluated results.
 * Strictly adheres to BR-06:
 * - Includes Health status or insufficient data status
 * - Includes Primary Goal details if present, or indicates absence truthfully
 * - Includes Main Issue directly drawn from the NBA reason
 * - Includes NBA Action, Priority, and Rule ID matching the recommendation
 * - Never invents facts, never outputs "undefined" or "null", never queries DB or clocks.
 */
export function generateClientSummary(context: SummaryContext): string {
  const { health, primaryGoal, recommendation } = context;

  // 1. Health Status segment
  let healthSegment: string;
  if (health.status === 'COMPLETE' && health.score !== null) {
    const classificationMap: Record<string, string> = {
      GOOD: 'ดี (GOOD)',
      MODERATE: 'ปานกลาง (MODERATE)',
      AT_RISK: 'มีความเสี่ยง (AT_RISK)',
    };
    const classLabel = health.classification ? classificationMap[health.classification] ?? health.classification : '';
    healthSegment = `สถานะสุขภาพทางการเงินอยู่ในระดับ ${classLabel} ด้วยคะแนนรวม ${health.score.toFixed(2)} จาก 100 คะแนน`;
  } else {
    const missing = health.missingFields.length > 0 ? ` (ขาดข้อมูล: ${health.missingFields.join(', ')})` : '';
    healthSegment = `สถานะสุขภาพทางการเงินยังไม่สามารถประเมินได้ครบถ้วนเนื่องจากข้อมูลไม่เพียงพอ${missing}`;
  }

  // 2. Primary Goal segment
  let goalSegment: string;
  if (primaryGoal) {
    const completionNote = primaryGoal.isCompleted ? ' (บรรลุเป้าหมายแล้ว)' : '';
    goalSegment = `เป้าหมายหลักคือ ${primaryGoal.id} (เป้าหมาย ${primaryGoal.targetAmount} บาท, ยอดปัจจุบัน ${primaryGoal.currentAmount} บาท, ครบกำหนด ${primaryGoal.targetDate}${completionNote})`;
  } else if (context.goalsCount === 0) {
    goalSegment = 'ปัจจุบันไม่มีเป้าหมายทางการเงินที่บันทึกไว้ในระบบ';
  } else if (context.goalsCount !== undefined && context.goalsCount > 0) {
    goalSegment = 'ปัจจุบันยังไม่สามารถระบุเป้าหมายทางการเงินหลักได้ (ข้อมูลเป้าหมายไม่ครบถ้วนหรือไม่ผ่านเกณฑ์)';
  } else {
    goalSegment = 'ปัจจุบันยังไม่มีเป้าหมายทางการเงินหลักที่ระบุได้ในระบบ';
  }

  // 3. Main Issue from NBA reason
  const issueSegment = `ประเด็นสำคัญที่พบ: ${recommendation.reason}`;

  // 4. NBA Action & Priority segment
  const actionSegment = `แนวทางดำเนินการถัดไป (Next Best Action): ดำเนินการ "${recommendation.action}" (ความสำคัญระดับ ${recommendation.priority} ตามกฎ ${recommendation.rule})`;

  return `${healthSegment} ${goalSegment} ${issueSegment} ${actionSegment}`;
}
