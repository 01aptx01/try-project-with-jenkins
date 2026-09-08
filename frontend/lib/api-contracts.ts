/**
 * Frontend Type-Only API Contracts Facade for Meridian.
 *
 * Strictly contains compile-time type and interface definitions.
 * ZERO runtime imports of Express, Prisma, Zod, or backend calculators.
 */

// ==========================================
// Common & Error Envelopes
// ==========================================

export interface ApiErrorDetail {
  code: string;
  message: string;
  requestId?: string | undefined;
  details?: unknown;
}

export interface ApiErrorEnvelope {
  error: ApiErrorDetail;
}

// ==========================================
// Authentication Types
// ==========================================

export interface LoginRequest {
  email: string;
  password: string;
}

export interface AuthUserSummary {
  id: string;
  name: string;
  role: 'RM';
}

export interface LoginResponse {
  user: AuthUserSummary;
}

export type MeResponse = AuthUserSummary;

// ==========================================
// Domain Primitives & Classifications
// ==========================================

export type PriorityLevel = 'HIGH' | 'MEDIUM' | 'LOW';

export type HealthClassification = 'GOOD' | 'MODERATE' | 'AT_RISK';

export type HealthStatus = 'COMPLETE' | 'INSUFFICIENT_DATA';

export type HealthFilter = HealthClassification | 'INSUFFICIENT_DATA';

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

export interface RecommendationResult {
  action: RecommendationAction;
  reason: string;
  priority: PriorityLevel;
  rule: RecommendationRuleId;
}

// ==========================================
// Client Card & List Types
// ==========================================

export interface ClientCard {
  id: string;
  customerCode: string;
  displayName: string;
  riskLevel: string;
  health: HealthResult;
  recommendation: RecommendationResult;
}

export interface ClientListQuery {
  search?: string | undefined;
  priority?: PriorityLevel | undefined;
  health?: HealthFilter | undefined;
  page?: number | undefined;
  pageSize?: number | undefined;
}

export interface ClientListResponse {
  items: ClientCard[];
  page: number;
  pageSize: number;
  total: number;
}

// ==========================================
// Dashboard Morning Action Plan Types
// ==========================================

export interface MorningActionPlanResponse {
  items: ClientCard[];
  page: number;
  pageSize: number;
  total: number;
  asOfDate: string; // YYYY-MM-DD
}

// ==========================================
// Client Profile Snapshot Types
// ==========================================

export interface ClientPersonalProfile {
  id: string;
  customerCode: string;
  firstName: string;
  lastName: string;
  displayName: string;
  riskLevel: string;
  age: number | null;
  occupation: string | null;
}

export interface ClientFinancialProfileDetail {
  id: string;
  monthlyIncome: string | null;
  monthlyExpense: string | null;
  liquidAssets: string | null;
  totalAssets: string | null;
  totalDebt: string | null;
  savings: string | null;
  investments: string | null;
}

export interface ClientGoalDetail {
  id: string;
  goalType: string;
  targetAmount: string;
  currentAmount: string;
  startDate: string; // YYYY-MM-DD
  targetDate: string; // YYYY-MM-DD
}

export interface ClientProfileSnapshotResponse {
  client: ClientPersonalProfile;
  financialProfile: ClientFinancialProfileDetail | null;
  goals: ClientGoalDetail[];
  primaryGoal: PrimaryGoalResult | null;
  health: HealthResult;
  recommendation: RecommendationResult;
  summary: string;
  asOfDate: string; // YYYY-MM-DD
}

// ==========================================
// Sub-endpoints Types
// ==========================================

export type ClientHealthResponse = HealthResult;

export type ClientRecommendationResponse = RecommendationResult;

export interface ClientSummaryResponse {
  summary: string;
  health: HealthResult;
  primaryGoal: PrimaryGoalResult | null;
  recommendation: RecommendationResult;
  asOfDate: string; // YYYY-MM-DD
}

// ==========================================
// Family Graph Types
// ==========================================

export type RelationshipType = 'PARENT' | 'CHILD' | 'SPOUSE' | 'SIBLING';

export type FamilyNodeType = 'PRIMARY' | 'RELATED';

export interface FamilyNode {
  id: string;
  label: string;
  type: FamilyNodeType;
}

export interface FamilyEdge {
  id: string;
  source: string;
  target: string;
  relationshipType: RelationshipType;
}

export interface FamilyGraphResponse {
  nodes: FamilyNode[];
  edges: FamilyEdge[];
}
