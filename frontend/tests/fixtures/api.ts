/**
 * Typed Synthetic API Fixtures for Frontend Component & Unit Tests.
 *
 * Provides compliant fixture data matching M3 backend runtime shapes.
 */

import type {
  AuthUserSummary,
  ClientCard,
  ClientListResponse,
  ClientProfileSnapshotResponse,
  FamilyGraphResponse,
  MorningActionPlanResponse,
  ApiErrorEnvelope,
} from '../../lib/api-contracts.js';

export const mockAuthUser: AuthUserSummary = {
  id: '11111111-1111-1111-1111-111111111111',
  name: 'Sarah Jenkins',
  role: 'RM',
};

export const mockCompleteClientCard: ClientCard = {
  id: '22222222-2222-2222-2222-222222222001',
  customerCode: 'C-001',
  displayName: 'Somchai Prasert',
  riskLevel: 'HIGH',
  health: {
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
  },
  recommendation: {
    action: 'Review Emergency Fund',
    reason: 'Emergency reserves are below 3 months of expenses',
    priority: 'HIGH',
    rule: 'BR-04.2',
  },
};

export const mockIncompleteClientCard: ClientCard = {
  id: '22222222-2222-2222-2222-222222222002',
  customerCode: 'C-002',
  displayName: 'Wandee Prasert',
  riskLevel: 'LOW',
  health: {
    score: null,
    classification: null,
    status: 'INSUFFICIENT_DATA',
    missingFields: ['monthlyIncome', 'monthlyExpense'],
    breakdown: {
      liquidity: null,
      debt: null,
      savings: null,
      goals: null,
      investment: null,
    },
  },
  recommendation: {
    action: 'Review Client Data',
    reason: 'Financial profile has missing core fields',
    priority: 'HIGH',
    rule: 'BR-04.1',
  },
};

export const mockClientListResponse: ClientListResponse = {
  items: [mockCompleteClientCard, mockIncompleteClientCard],
  page: 1,
  pageSize: 20,
  total: 2,
};

export const mockMorningActionPlanResponse: MorningActionPlanResponse = {
  items: [mockCompleteClientCard, mockIncompleteClientCard],
  page: 1,
  pageSize: 20,
  total: 2,
  asOfDate: '2026-09-08',
};

export const mockCompleteProfileSnapshot: ClientProfileSnapshotResponse = {
  client: {
    id: '22222222-2222-2222-2222-222222222001',
    customerCode: 'C-001',
    firstName: 'Somchai',
    lastName: 'Prasert',
    displayName: 'Somchai Prasert',
    riskLevel: 'HIGH',
    age: 45,
    occupation: 'Business Owner',
  },
  financialProfile: {
    id: '33333333-3333-3333-3333-333333333001',
    monthlyIncome: '150000.00',
    monthlyExpense: '95000.00',
    liquidAssets: '200000.00',
    totalAssets: '5500000.00',
    totalDebt: '2100000.00',
    savings: '350000.00',
    investments: '1500000.00',
  },
  goals: [
    {
      id: '44444444-4444-4444-4444-444444444001',
      goalType: 'RETIREMENT',
      targetAmount: '10000000.00',
      currentAmount: '2500000.00',
      startDate: '2020-01-01',
      targetDate: '2035-12-31',
    },
  ],
  primaryGoal: {
    id: '44444444-4444-4444-4444-444444444001',
    goalType: 'RETIREMENT',
    targetAmount: '10000000.00',
    currentAmount: '2500000.00',
    startDate: '2020-01-01',
    targetDate: '2035-12-31',
    expectedAmount: '4218750.00',
    progress: 0.59,
    isBehind: true,
    isCompleted: false,
  },
  health: {
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
  },
  recommendation: {
    action: 'Review Emergency Fund',
    reason: 'Emergency reserves are below 3 months of expenses',
    priority: 'HIGH',
    rule: 'BR-04.2',
  },
  summary:
    'Somchai Prasert has a Moderate financial health score of 68/100. Priority area is liquidity reserves.',
  asOfDate: '2026-09-08',
};

export const mockIncompleteProfileSnapshot: ClientProfileSnapshotResponse = {
  client: {
    id: '22222222-2222-2222-2222-222222222002',
    customerCode: 'C-002',
    firstName: 'Wandee',
    lastName: 'Prasert',
    displayName: 'Wandee Prasert',
    riskLevel: 'LOW',
    age: null,
    occupation: null,
  },
  financialProfile: null,
  goals: [],
  primaryGoal: null,
  health: {
    score: null,
    classification: null,
    status: 'INSUFFICIENT_DATA',
    missingFields: ['financialProfile'],
    breakdown: {
      liquidity: null,
      debt: null,
      savings: null,
      goals: null,
      investment: null,
    },
  },
  recommendation: {
    action: 'Review Client Data',
    reason: 'Client has no financial profile recorded',
    priority: 'HIGH',
    rule: 'BR-04.1',
  },
  summary:
    'Wandee Prasert currently lacks a complete financial profile. Action is required to gather financial information.',
  asOfDate: '2026-09-08',
};

export const mockFamilyGraphResponse: FamilyGraphResponse = {
  nodes: [
    {
      id: '22222222-2222-2222-2222-222222222001',
      label: 'Somchai Prasert',
      type: 'PRIMARY',
    },
    {
      id: '22222222-2222-2222-2222-222222222002',
      label: 'Wandee Prasert',
      type: 'RELATED',
    },
  ],
  edges: [
    {
      id: '55555555-5555-5555-5555-555555555001',
      source: '22222222-2222-2222-2222-222222222001',
      target: '22222222-2222-2222-2222-222222222002',
      relationshipType: 'SPOUSE',
    },
  ],
};

export const mockError401: ApiErrorEnvelope = {
  error: {
    code: 'UNAUTHORIZED',
    message: 'Invalid credentials',
    requestId: 'req-test-401',
  },
};

export const mockError404: ApiErrorEnvelope = {
  error: {
    code: 'NOT_FOUND',
    message: 'Client not found',
    requestId: 'req-test-404',
  },
};

export const mockError429: ApiErrorEnvelope = {
  error: {
    code: 'TOO_MANY_REQUESTS',
    message: 'Too many requests, please try again later',
    requestId: 'req-test-429',
  },
};

export const mockError503: ApiErrorEnvelope = {
  error: {
    code: 'DEPENDENCY_UNAVAILABLE',
    message: 'Database service is temporarily unavailable',
    requestId: 'req-test-503',
  },
};
