import { evaluateClient } from "../domain/financial/evaluate-client.js";
import type { ClientEvaluationInput } from "../domain/financial/types.js";
import type { SeedCatalogue } from "./types.js";

export interface ValidationReport {
  isValid: boolean;
  errors: string[];
  rmCount: number;
  clientCount: number;
  profileCount: number;
  goalCount: number;
  relationshipCount: number;
  nbaCoverage: Record<string, number>;
  priorityCoverage: Record<string, number>;
}

const REQUIRED_NBA_ACTIONS = [
  "Review Emergency Fund",
  "Review Debt Position",
  "Review Goal Funding",
  "Schedule Financial Health Review",
  "Routine Financial Review",
] as const;

const REQUIRED_PRIORITIES = ["HIGH", "MEDIUM", "LOW"] as const;

const REQUIRED_RELATIONSHIP_TYPES = [
  "PARENT",
  "CHILD",
  "SPOUSE",
  "SIBLING",
] as const;

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function validateSeedCatalogue(catalogue: SeedCatalogue): ValidationReport {
  const errors: string[] = [];
  const { asOfDate, rms, clients, profiles, goals, relationships } = catalogue;

  // 1. As-of date validation
  if (!/^\d{4}-\d{2}-\d{2}$/.test(asOfDate) || Number.isNaN(Date.parse(asOfDate))) {
    errors.push(`Invalid asOfDate format: ${asOfDate} (must be YYYY-MM-DD)`);
  }

  // 2. RMs validation
  if (rms.length !== 2) {
    errors.push(`Expected exactly 2 RMs, got ${rms.length}`);
  }
  const rmIdSet = new Set<string>();
  const rmEmailSet = new Set<string>();
  for (const rm of rms) {
    if (!UUID_REGEX.test(rm.id)) {
      errors.push(`Invalid RM UUID: ${rm.id}`);
    }
    if (rmIdSet.has(rm.id)) {
      errors.push(`Duplicate RM id: ${rm.id}`);
    }
    rmIdSet.add(rm.id);

    if (rmEmailSet.has(rm.email.toLowerCase())) {
      errors.push(`Duplicate RM email: ${rm.email}`);
    }
    rmEmailSet.add(rm.email.toLowerCase());

    if (rm.role !== "RM") {
      errors.push(`RM ${rm.id} has invalid role ${rm.role}, must be RM`);
    }
    if (!rm.passwordHash) {
      errors.push(`RM ${rm.id} is missing passwordHash`);
    }
  }

  // 3. Clients validation
  if (clients.length !== 30) {
    errors.push(`Expected exactly 30 clients, got ${clients.length}`);
  }
  const clientIdSet = new Set<string>();
  const customerCodeSet = new Set<string>();
  const rmClientCount: Record<string, number> = {};

  for (const client of clients) {
    if (!UUID_REGEX.test(client.id)) {
      errors.push(`Invalid client UUID: ${client.id}`);
    }
    if (clientIdSet.has(client.id)) {
      errors.push(`Duplicate client id: ${client.id}`);
    }
    clientIdSet.add(client.id);

    if (customerCodeSet.has(client.customerCode)) {
      errors.push(`Duplicate customer code: ${client.customerCode}`);
    }
    customerCodeSet.add(client.customerCode);

    if (!rmIdSet.has(client.rmId)) {
      errors.push(`Client ${client.id} references unknown rmId: ${client.rmId}`);
    }
    rmClientCount[client.rmId] = (rmClientCount[client.rmId] ?? 0) + 1;
  }

  for (const rm of rms) {
    const count = rmClientCount[rm.id] ?? 0;
    if (count !== 15) {
      errors.push(`RM ${rm.id} (${rm.name}) has ${count} clients, expected exactly 15`);
    }
  }

  // Check expected customer codes C-001 to C-030
  for (let i = 1; i <= 30; i++) {
    const expectedCode = `C-${String(i).padStart(3, "0")}`;
    if (!customerCodeSet.has(expectedCode)) {
      errors.push(`Missing expected customer code: ${expectedCode}`);
    }
  }

  // 4. Financial profiles validation
  if (profiles.length !== 30) {
    errors.push(`Expected exactly 30 financial profiles, got ${profiles.length}`);
  }
  const profiledClientIds = new Set<string>();
  for (const profile of profiles) {
    if (!UUID_REGEX.test(profile.id)) {
      errors.push(`Invalid profile UUID: ${profile.id}`);
    }
    if (!clientIdSet.has(profile.clientId)) {
      errors.push(`Profile ${profile.id} references unknown client: ${profile.clientId}`);
    }
    if (profiledClientIds.has(profile.clientId)) {
      errors.push(`Client ${profile.clientId} has multiple profiles`);
    }
    profiledClientIds.add(profile.clientId);

    // All decimal fields must be valid numeric strings
    const decimalFields = [
      profile.monthlyIncome,
      profile.monthlyExpense,
      profile.liquidAssets,
      profile.totalAssets,
      profile.totalDebt,
      profile.savings,
      profile.investments,
    ];
    for (const val of decimalFields) {
      if (typeof val !== "string" || Number.isNaN(Number(val)) || Number(val) < 0) {
        errors.push(`Profile ${profile.id} contains invalid decimal amount: ${val}`);
      }
    }
  }

  // 5. Goals validation
  const clientGoalsCount: Record<string, number> = {};
  const goalIdSet = new Set<string>();
  for (const goal of goals) {
    if (!UUID_REGEX.test(goal.id)) {
      errors.push(`Invalid goal UUID: ${goal.id}`);
    }
    if (goalIdSet.has(goal.id)) {
      errors.push(`Duplicate goal id: ${goal.id}`);
    }
    goalIdSet.add(goal.id);

    if (!clientIdSet.has(goal.clientId)) {
      errors.push(`Goal ${goal.id} references unknown client: ${goal.clientId}`);
    }
    clientGoalsCount[goal.clientId] = (clientGoalsCount[goal.clientId] ?? 0) + 1;

    if (Number(goal.targetAmount) <= 0) {
      errors.push(`Goal ${goal.id} targetAmount must be strictly positive: ${goal.targetAmount}`);
    }
    if (Number(goal.currentAmount) < 0) {
      errors.push(`Goal ${goal.id} currentAmount cannot be negative: ${goal.currentAmount}`);
    }
    if (Date.parse(goal.startDate) >= Date.parse(goal.targetDate)) {
      errors.push(`Goal ${goal.id} startDate (${goal.startDate}) must be before targetDate (${goal.targetDate})`);
    }
  }

  for (const client of clients) {
    const count = clientGoalsCount[client.id] ?? 0;
    if (count < 1) {
      errors.push(`Client ${client.id} (${client.customerCode}) has no goals; minimum 1 required`);
    }
  }

  // 6. Family relationships validation
  const clientMap = new Map(clients.map((c) => [c.id, c]));
  const seenPairs = new Set<string>();
  const relationshipTypesSeen = new Set<string>();

  for (const rel of relationships) {
    if (!UUID_REGEX.test(rel.id)) {
      errors.push(`Invalid relationship UUID: ${rel.id}`);
    }
    if (rel.clientId === rel.relatedClientId) {
      errors.push(`Self-relationship detected on client ${rel.clientId}`);
    }
    const clientA = clientMap.get(rel.clientId);
    const clientB = clientMap.get(rel.relatedClientId);

    if (!clientA) {
      errors.push(`Relationship references non-existent client ${rel.clientId}`);
    }
    if (!clientB) {
      errors.push(`Relationship references non-existent client ${rel.relatedClientId}`);
    }

    // Intra-RM check
    if (clientA && clientB && clientA.rmId !== clientB.rmId) {
      errors.push(
        `Cross-RM relationship violation: client ${clientA.customerCode} (RM ${clientA.rmId}) is related to client ${clientB.customerCode} (RM ${clientB.rmId})`
      );
    }

    const pairKey = `${rel.clientId}:${rel.relatedClientId}`;
    if (seenPairs.has(pairKey)) {
      errors.push(`Duplicate relationship pair: ${pairKey}`);
    }
    seenPairs.add(pairKey);
    relationshipTypesSeen.add(rel.relationshipType);
  }

  for (const reqType of REQUIRED_RELATIONSHIP_TYPES) {
    if (!relationshipTypesSeen.has(reqType)) {
      errors.push(`Missing relationship type in seed: ${reqType}`);
    }
  }

  // 7. Deterministic evaluation coverage check (NBA & Priority)
  const profileMap = new Map(profiles.map((p) => [p.clientId, p]));
  const clientGoalsMap = new Map<string, typeof goals>();
  for (const goal of goals) {
    const existing = clientGoalsMap.get(goal.clientId) ?? [];
    existing.push(goal);
    clientGoalsMap.set(goal.clientId, existing);
  }

  const nbaCoverage: Record<string, number> = {};
  const priorityCoverage: Record<string, number> = {};

  for (const client of clients) {
    const profile = profileMap.get(client.id) ?? null;
    const clientGoals = clientGoalsMap.get(client.id) ?? [];

    const evalInput: ClientEvaluationInput = {
      client: {
        id: client.id,
        customerCode: client.customerCode,
        firstName: client.firstName,
        lastName: client.lastName,
        riskLevel: client.riskLevel,
      },
      financialProfile: profile
        ? {
            monthlyIncome: profile.monthlyIncome,
            monthlyExpense: profile.monthlyExpense,
            liquidAssets: profile.liquidAssets,
            totalAssets: profile.totalAssets,
            totalDebt: profile.totalDebt,
            savings: profile.savings,
            investments: profile.investments,
          }
        : null,
      goals: clientGoals.map((g) => ({
        id: g.id,
        goalType: g.goalType,
        targetAmount: g.targetAmount,
        currentAmount: g.currentAmount,
        startDate: g.startDate,
        targetDate: g.targetDate,
      })),
    };

    const evaluation = evaluateClient(evalInput, asOfDate);
    const action = evaluation.recommendation.action;
    const priority = evaluation.recommendation.priority;

    nbaCoverage[action] = (nbaCoverage[action] ?? 0) + 1;
    priorityCoverage[priority] = (priorityCoverage[priority] ?? 0) + 1;
  }

  for (const reqAction of REQUIRED_NBA_ACTIONS) {
    if (!nbaCoverage[reqAction] || nbaCoverage[reqAction] < 1) {
      errors.push(`Missing required NBA action in seed coverage: ${reqAction}`);
    }
  }

  for (const reqPriority of REQUIRED_PRIORITIES) {
    if (!priorityCoverage[reqPriority] || priorityCoverage[reqPriority] < 1) {
      errors.push(`Missing required Priority level in seed coverage: ${reqPriority}`);
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    rmCount: rms.length,
    clientCount: clients.length,
    profileCount: profiles.length,
    goalCount: goals.length,
    relationshipCount: relationships.length,
    nbaCoverage,
    priorityCoverage,
  };
}
