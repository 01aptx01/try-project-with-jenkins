import type {
  ClientCard,
  ClientListResponse,
  MorningActionPlanResponse,
} from "../contracts/api.js";
import {
  compareEvaluatedClients,
  evaluateClient,
} from "../domain/financial/evaluate-client.js";
import type { ClientEvaluationResult } from "../domain/financial/types.js";
import { toDomainEvaluationInput } from "../mappers/client.mapper.js";
import type {
  ClientRepository,
  ClientWithFinancialData,
} from "../repositories/client.repository.js";

export interface ClientListServiceOptions {
  clientRepository: ClientRepository;
  clock?: (() => string) | undefined;
}

export interface ClientListParams {
  rmId: string;
  search?: string | undefined;
  priority?: "HIGH" | "MEDIUM" | "LOW" | undefined;
  health?: "GOOD" | "MODERATE" | "AT_RISK" | "INSUFFICIENT_DATA" | undefined;
  page?: number | undefined;
  pageSize?: number | undefined;
}

export class ClientListService {
  private readonly clientRepository: ClientRepository;
  private readonly clock: () => string;

  constructor(options: ClientListServiceOptions) {
    this.clientRepository = options.clientRepository;
    this.clock =
      options.clock ??
      (() => {
        return new Date().toISOString().slice(0, 10);
      });
  }

  private async evaluateAndPaginate(params: ClientListParams): Promise<{
    items: ClientCard[];
    page: number;
    pageSize: number;
    total: number;
    asOfDate: string;
  }> {
    const page = params.page ?? 1;
    const pageSize = params.pageSize ?? 20;
    const asOfDate = this.clock();

    // 1. Single batch load of all clients owned by this RM
    const allClients = await this.clientRepository.findAllClientsByRmId(params.rmId);

    // 2. In-memory Text Search with Unicode NFC normalization
    let searchedClients = allClients;
    if (params.search !== undefined) {
      const query = params.search.trim().normalize("NFC").toLowerCase();
      if (query.length > 0) {
        searchedClients = allClients.filter((client: ClientWithFinancialData) => {
          const code = client.customerCode.normalize("NFC").toLowerCase();
          const fullName = `${client.firstName} ${client.lastName}`
            .normalize("NFC")
            .toLowerCase();
          return code.includes(query) || fullName.includes(query);
        });
      }
    }

    // 3. Evaluate each matching client
    const evaluatedClients: ClientEvaluationResult[] = searchedClients.map(
      (client: ClientWithFinancialData) => {
        const domainInput = toDomainEvaluationInput(client);
        return evaluateClient(domainInput, asOfDate);
      }
    );

    // 4. In-memory Filtering by Priority and Health (AND semantics)
    let filteredClients = evaluatedClients;
    if (params.priority) {
      filteredClients = filteredClients.filter(
        (e) => e.recommendation.priority === params.priority
      );
    }
    if (params.health) {
      filteredClients = filteredClients.filter((e) => {
        if (params.health === "INSUFFICIENT_DATA") {
          return e.health.status === "INSUFFICIENT_DATA";
        }
        return (
          e.health.status === "COMPLETE" &&
          e.health.classification === params.health
        );
      });
    }

    // 5. Deterministic sort: Priority (HIGH -> MEDIUM -> LOW) then customerCode ascending
    filteredClients.sort(compareEvaluatedClients);

    // 6. Total count after search and filters
    const total = filteredClients.length;

    // 7. Paginate (slice)
    const startIndex = (page - 1) * pageSize;
    const paginatedSlice =
      startIndex >= total
        ? []
        : filteredClients.slice(startIndex, startIndex + pageSize);

    // 8. Map to ClientCard response items
    const items: ClientCard[] = paginatedSlice.map((e) => ({
      id: e.client.id,
      customerCode: e.client.customerCode,
      displayName: `${e.client.firstName ?? ""} ${e.client.lastName ?? ""}`.trim(),
      riskLevel: e.client.riskLevel ?? "MEDIUM",
      health: e.health,
      recommendation: e.recommendation,
    }));

    return {
      items,
      page,
      pageSize,
      total,
      asOfDate,
    };
  }

  async getClientList(params: ClientListParams): Promise<ClientListResponse> {
    const result = await this.evaluateAndPaginate(params);
    return {
      items: result.items,
      page: result.page,
      pageSize: result.pageSize,
      total: result.total,
    };
  }

  async getMorningActionPlan(params: ClientListParams): Promise<MorningActionPlanResponse> {
    return this.evaluateAndPaginate(params);
  }
}

