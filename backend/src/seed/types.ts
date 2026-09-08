import type { GoalType, RelationshipType, RiskLevel, UserRole } from "@prisma/client";

export interface SeedUser {
  id: string;
  email: string;
  passwordHash: string;
  name: string;
  role: UserRole;
}

export interface SeedClient {
  id: string;
  customerCode: string;
  firstName: string;
  lastName: string;
  age: number;
  occupation: string;
  riskLevel: RiskLevel;
  rmId: string;
}

export interface SeedFinancialProfile {
  id: string;
  clientId: string;
  monthlyIncome: string;
  monthlyExpense: string;
  liquidAssets: string;
  totalAssets: string;
  totalDebt: string;
  savings: string;
  investments: string;
}

export interface SeedGoal {
  id: string;
  clientId: string;
  goalType: GoalType;
  targetAmount: string;
  currentAmount: string;
  startDate: string; // YYYY-MM-DD
  targetDate: string; // YYYY-MM-DD
}

export interface SeedFamilyRelationship {
  id: string;
  clientId: string;
  relatedClientId: string;
  relationshipType: RelationshipType;
}

export interface SeedCatalogue {
  asOfDate: string; // YYYY-MM-DD
  rms: SeedUser[];
  clients: SeedClient[];
  profiles: SeedFinancialProfile[];
  goals: SeedGoal[];
  relationships: SeedFamilyRelationship[];
}
