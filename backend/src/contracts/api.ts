/**
 * API Contracts, Response Types, and Zod Schemas for Meridian Milestone 3.
 * Single source of truth for wire format across all backend endpoints.
 */

import { z } from 'zod';
import type {
  HealthResult,
  RecommendationResult,
  PrimaryGoalResult,
  PriorityLevel,
  HealthClassification,
} from '../domain/financial/types.js';
import type { RelationshipType } from '../family/relationships.js';

export type { PriorityLevel, HealthClassification };

// ==========================================
// Common & Error Envelopes
// ==========================================

export interface ApiErrorDetail {
  code: string;
  message: string;
  details?: unknown;
}

export interface ApiErrorEnvelope {
  error: ApiErrorDetail;
}

// ==========================================
// Authentication Types
// ==========================================

export const loginRequestSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1).max(72),
}).strict();

export type LoginRequest = z.infer<typeof loginRequestSchema>;

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
// Client Card & List Types
// ==========================================

export type HealthFilter = HealthClassification | 'INSUFFICIENT_DATA';

export interface ClientCard {
  id: string;
  customerCode: string;
  displayName: string;
  riskLevel: string;
  health: HealthResult;
  recommendation: RecommendationResult;
}

export const clientListQuerySchema = z.object({
  search: z.string().optional(),
  priority: z.enum(['HIGH', 'MEDIUM', 'LOW']).optional(),
  health: z.enum(['GOOD', 'MODERATE', 'AT_RISK', 'INSUFFICIENT_DATA']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
}).strict();

export type ClientListQuery = z.infer<typeof clientListQuerySchema>;

export interface ClientListResponse {
  items: ClientCard[];
  page: number;
  pageSize: number;
  total: number;
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
