import type {
  ClientFinancialProfileDetail,
  ClientGoalDetail,
  ClientPersonalProfile,
  ClientProfileSnapshotResponse,
} from "../contracts/api.js";
import type {
  ClientEvaluationInput,
  ClientEvaluationResult,
  FinancialProfileInput,
  GoalInput,
} from "../domain/financial/types.js";
import type { ClientWithFinancialData } from "../repositories/client.repository.js";

export function formatDateString(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function toDomainEvaluationInput(clientData: ClientWithFinancialData): ClientEvaluationInput {
  const profile: FinancialProfileInput | null = clientData.financialProfile
    ? {
        monthlyIncome: clientData.financialProfile.monthlyIncome?.toString() ?? null,
        monthlyExpense: clientData.financialProfile.monthlyExpense?.toString() ?? null,
        liquidAssets: clientData.financialProfile.liquidAssets?.toString() ?? null,
        totalAssets: clientData.financialProfile.totalAssets?.toString() ?? null,
        totalDebt: clientData.financialProfile.totalDebt?.toString() ?? null,
        savings: clientData.financialProfile.savings?.toString() ?? null,
        investments: clientData.financialProfile.investments?.toString() ?? null,
      }
    : null;

  const goals: GoalInput[] = clientData.goals.map((g) => ({
    id: g.id,
    goalType: g.goalType,
    targetAmount: g.targetAmount.toString(),
    currentAmount: g.currentAmount.toString(),
    startDate: formatDateString(g.startDate),
    targetDate: formatDateString(g.targetDate),
  }));

  return {
    client: {
      id: clientData.id,
      customerCode: clientData.customerCode,
      firstName: clientData.firstName,
      lastName: clientData.lastName,
      riskLevel: clientData.riskLevel,
    },
    financialProfile: profile,
    goals,
  };
}

export function toClientPersonalProfile(clientData: ClientWithFinancialData): ClientPersonalProfile {
  return {
    id: clientData.id,
    customerCode: clientData.customerCode,
    firstName: clientData.firstName,
    lastName: clientData.lastName,
    displayName: `${clientData.firstName} ${clientData.lastName}`,
    riskLevel: clientData.riskLevel,
    age: clientData.age,
    occupation: clientData.occupation,
  };
}

export function formatDecimal(val: unknown): string | null {
  if (val === null || val === undefined) return null;
  if (
    typeof val === "object" &&
    val !== null &&
    "toFixed" in val &&
    typeof (val as { toFixed: unknown }).toFixed === "function"
  ) {
    return (val as { toFixed: (digits: number) => string }).toFixed(2);
  }
  const num = Number(val);
  if (Number.isNaN(num)) return null;
  return num.toFixed(2);
}

export function toClientProfileSnapshotResponse(
  evaluation: ClientEvaluationResult,
  clientData: ClientWithFinancialData
): ClientProfileSnapshotResponse {
  const personalProfile = toClientPersonalProfile(clientData);

  const financialProfileDetail: ClientFinancialProfileDetail | null = clientData.financialProfile
    ? {
        id: clientData.financialProfile.id,
        monthlyIncome: formatDecimal(clientData.financialProfile.monthlyIncome),
        monthlyExpense: formatDecimal(clientData.financialProfile.monthlyExpense),
        liquidAssets: formatDecimal(clientData.financialProfile.liquidAssets),
        totalAssets: formatDecimal(clientData.financialProfile.totalAssets),
        totalDebt: formatDecimal(clientData.financialProfile.totalDebt),
        savings: formatDecimal(clientData.financialProfile.savings),
        investments: formatDecimal(clientData.financialProfile.investments),
      }
    : null;

  const goalsDetail: ClientGoalDetail[] = clientData.goals.map((g) => ({
    id: g.id,
    goalType: g.goalType,
    targetAmount: formatDecimal(g.targetAmount) ?? "0.00",
    currentAmount: formatDecimal(g.currentAmount) ?? "0.00",
    startDate: formatDateString(g.startDate),
    targetDate: formatDateString(g.targetDate),
  }));

  return {
    client: personalProfile,
    financialProfile: financialProfileDetail,
    goals: goalsDetail,
    primaryGoal: evaluation.primaryGoal,
    health: evaluation.health,
    recommendation: evaluation.recommendation,
    summary: evaluation.summary,
    asOfDate: evaluation.asOfDate,
  };
}
