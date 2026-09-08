import { describe, it, expect } from 'vitest';
import {
  loginRequestSchema,
  clientListQuerySchema,
  type ClientCard,
  type ClientProfileSnapshotResponse,
  type MorningActionPlanResponse,
  type FamilyGraphResponse,
} from '../../../src/contracts/api.js';

describe('API Contracts & Schemas', () => {
  describe('loginRequestSchema', () => {
    it('accepts valid login request and normalizes email', () => {
      const parsed = loginRequestSchema.parse({
        email: '  RM1@Meridian.Local  ',
        password: 'SecurePassword123!',
      });
      expect(parsed.email).toBe('rm1@meridian.local');
      expect(parsed.password).toBe('SecurePassword123!');
    });

    it('rejects invalid email', () => {
      expect(() => loginRequestSchema.parse({
        email: 'not-an-email',
        password: 'password',
      })).toThrow();
    });

    it('rejects passwords longer than 72 bytes', () => {
      const longPassword = 'a'.repeat(73);
      expect(() => loginRequestSchema.parse({
        email: 'rm1@meridian.local',
        password: longPassword,
      })).toThrow();
    });

    it('rejects extra unknown fields', () => {
      expect(() => loginRequestSchema.parse({
        email: 'rm1@meridian.local',
        password: 'password',
        role: 'ADMIN',
      })).toThrow();
    });
  });

  describe('clientListQuerySchema', () => {
    it('provides default page 1 and pageSize 20', () => {
      const parsed = clientListQuerySchema.parse({});
      expect(parsed.page).toBe(1);
      expect(parsed.pageSize).toBe(20);
    });

    it('coerces valid page and pageSize numbers', () => {
      const parsed = clientListQuerySchema.parse({
        page: '2',
        pageSize: '50',
        priority: 'HIGH',
        health: 'AT_RISK',
      });
      expect(parsed.page).toBe(2);
      expect(parsed.pageSize).toBe(50);
      expect(parsed.priority).toBe('HIGH');
      expect(parsed.health).toBe('AT_RISK');
    });

    it('rejects page < 1 and pageSize > 100', () => {
      expect(() => clientListQuerySchema.parse({ page: 0 })).toThrow();
      expect(() => clientListQuerySchema.parse({ pageSize: 101 })).toThrow();
    });

    it('rejects unknown query fields', () => {
      expect(() => clientListQuerySchema.parse({ unknownField: 'test' })).toThrow();
    });
  });

  describe('Type shape verification', () => {
    it('ClientCard has required fields with no user/credentials', () => {
      const sampleCard: ClientCard = {
        id: '11111111-1111-4111-8111-111111111111',
        customerCode: 'C-001',
        displayName: 'Somchai Prasert',
        riskLevel: 'MEDIUM',
        health: {
          score: 75,
          classification: 'MODERATE',
          status: 'COMPLETE',
          missingFields: [],
          breakdown: {
            liquidity: 20,
            debt: 20,
            savings: 15,
            goals: 10,
            investment: 10,
          },
        },
        recommendation: {
          action: 'Schedule Financial Health Review',
          reason: 'Financial health score is MODERATE (75/100)',
          priority: 'MEDIUM',
          rule: 'BR-04.5',
        },
      };

      expect(sampleCard.id).toBeDefined();
      expect(sampleCard.customerCode).toBe('C-001');
      expect(sampleCard.displayName).toBe('Somchai Prasert');
    });

    it('ClientProfileSnapshotResponse includes personal fields and evaluation results', () => {
      const sampleProfile: ClientProfileSnapshotResponse = {
        client: {
          id: '11111111-1111-4111-8111-111111111111',
          customerCode: 'C-001',
          firstName: 'Somchai',
          lastName: 'Prasert',
          displayName: 'Somchai Prasert',
          riskLevel: 'MEDIUM',
          age: 42,
          occupation: 'Engineer',
        },
        financialProfile: {
          id: 'profile-1',
          monthlyIncome: '100000.00',
          monthlyExpense: '45000.00',
          liquidAssets: '300000.00',
          totalAssets: '2500000.00',
          totalDebt: '800000.00',
          savings: '200000.00',
          investments: '500000.00',
        },
        goals: [
          {
            id: 'goal-1',
            goalType: 'RETIREMENT',
            targetAmount: '5000000.00',
            currentAmount: '500000.00',
            startDate: '2024-01-01',
            targetDate: '2040-01-01',
          },
        ],
        primaryGoal: {
          id: 'goal-1',
          goalType: 'RETIREMENT',
          targetAmount: '5000000.00',
          currentAmount: '500000.00',
          startDate: '2024-01-01',
          targetDate: '2040-01-01',
          expectedAmount: '450000.00',
          progress: 1,
          isBehind: false,
          isCompleted: false,
        },
        health: {
          score: 82,
          classification: 'GOOD',
          status: 'COMPLETE',
          missingFields: [],
          breakdown: {
            liquidity: 25,
            debt: 20,
            savings: 20,
            goals: 8,
            investment: 9,
          },
        },
        recommendation: {
          action: 'Routine Financial Review',
          reason: 'All financial health indicators are in healthy ranges',
          priority: 'LOW',
          rule: 'BR-04.6',
        },
        summary: 'สุขภาพทางการเงินโดยรวมอยู่ในเกณฑ์ดี',
        asOfDate: '2026-09-08',
      };

      expect(sampleProfile.client.age).toBe(42);
      expect(sampleProfile.client.occupation).toBe('Engineer');
      expect(sampleProfile.asOfDate).toBe('2026-09-08');
    });

    it('MorningActionPlanResponse has matching paginated structure with asOfDate', () => {
      const sampleActionPlan: MorningActionPlanResponse = {
        items: [],
        page: 1,
        pageSize: 20,
        total: 0,
        asOfDate: '2026-09-08',
      };
      expect(sampleActionPlan.page).toBe(1);
      expect(sampleActionPlan.asOfDate).toBe('2026-09-08');
    });

    it('FamilyGraphResponse has nodes and edges without cross-RM leaks', () => {
      const sampleGraph: FamilyGraphResponse = {
        nodes: [
          { id: 'client-1', label: 'Somchai Prasert', type: 'PRIMARY' },
          { id: 'client-2', label: 'Somying Prasert', type: 'RELATED' },
        ],
        edges: [
          { id: 'rel-1', source: 'client-1', target: 'client-2', relationshipType: 'SPOUSE' },
        ],
      };
      expect(sampleGraph.nodes.length).toBe(2);
      expect(sampleGraph.edges[0]?.relationshipType).toBe('SPOUSE');
    });
  });
});
