/**
 * Financial domain types and evaluation contracts.
 * Free of Express, Prisma, or runtime environment dependencies.
 */

export type PriorityLevel = 'HIGH' | 'MEDIUM' | 'LOW';

export type HealthClassification = 'GOOD' | 'MODERATE' | 'AT_RISK';

export type HealthStatus = 'COMPLETE' | 'INSUFFICIENT_DATA';

export type RecommendationRuleId =
  | 'BR-04.1'
  | 'BR-04.2'
  | 'BR-04.3'
  | 'BR-04.4'
  | 'BR-04.5'
  | 'BR-04.6';

export type RecommendationAction =
  | 'Review Client Data'
  | 'Review Emergency Fund'
  | 'Review Debt Position'
  | 'Review Goal Funding'
  | 'Schedule Financial Health Review'
  | 'Routine Financial Review';

export interface FinancialProfileInput {
  monthlyIncome?: string | null | undefined;
  monthlyExpense?: string | null | undefined;
  liquidAssets?: string | null | undefined;
  totalAssets?: string | null | undefined;
  totalDebt?: string | null | undefined;
  /** Stored in DB but not used in Savings Score formula (BR-04 / BR-08) */
  savings?: string | null | undefined;
  investments?: string | null | undefined;
}

export interface GoalInput {
  id: string;
  goalType?: string | undefined;
  targetAmount: string;
  currentAmount: string;
  startDate: string; // YYYY-MM-DD UTC
  targetDate: string; // YYYY-MM-DD UTC
}

export interface ClientRefInput {
  id: string;
  customerCode: string;
  riskLevel?: string | undefined;
  firstName?: string | undefined;
  lastName?: string | undefined;
}

export interface ClientEvaluationInput {
  client: ClientRefInput;
  financialProfile: FinancialProfileInput | null;
  goals: GoalInput[];
}

export interface HealthScoreBreakdown {
  liquidity: number | null;
  debt: number | null;
  savings: number | null;
  goals: number | null;
  investment: number | null;
}

export interface HealthResult {
  score: number | null;
  classification: HealthClassification | null;
  status: HealthStatus;
  missingFields: string[];
  breakdown: HealthScoreBreakdown;
}

export interface GoalEvaluationResult {
  id: string;
  goalType?: string | undefined;
  targetAmount: string;
  currentAmount: string;
  startDate: string;
  targetDate: string;
  isValid: boolean;
  expectedAmount: string;
  cappedProgress: number; // 0 to 1
  progressNumerator?: bigint | undefined;
  progressDenominator?: bigint | undefined;
  isBehind: boolean;
  isCompleted: boolean;
  daysRemaining: number; // targetDate - asOfDate
}


export interface PrimaryGoalResult {
  id: string;
  goalType?: string | undefined;
  targetAmount: string;
  currentAmount: string;
  startDate: string;
  targetDate: string;
  expectedAmount: string;
  progress: number;
  isBehind: boolean;
  isCompleted: boolean;
}


export interface RecommendationResult {
  action: RecommendationAction;
  reason: string;
  priority: PriorityLevel;
  rule: RecommendationRuleId;
}

export interface ClientEvaluationResult {
  client: ClientRefInput;
  financialProfile: FinancialProfileInput | null;
  goals: GoalInput[];
  primaryGoal: PrimaryGoalResult | null;
  health: HealthResult;
  recommendation: RecommendationResult;
  summary: string;
  asOfDate: string;
}
