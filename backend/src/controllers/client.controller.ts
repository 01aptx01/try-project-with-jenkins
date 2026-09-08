import type { NextFunction, Request, Response } from "express";
import {
  clientListQuerySchema,
  type ClientSummaryResponse,
} from "../contracts/api.js";
import { evaluateClient } from "../domain/financial/evaluate-client.js";
import type { ClientEvaluationResult } from "../domain/financial/types.js";
import { BadRequestError, NotFoundError, UnauthorizedError } from "../errors.js";
import {
  toClientProfileSnapshotResponse,
  toDomainEvaluationInput,
} from "../mappers/client.mapper.js";
import type {
  ClientRepository,
  ClientWithFinancialData,
} from "../repositories/client.repository.js";
import { ClientListService } from "../services/client-list.service.js";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface ClientControllerOptions {
  clientRepository: ClientRepository;
  clientListService?: ClientListService | undefined;
  clock?: (() => string) | undefined;
}

export class ClientController {
  private readonly clientRepository: ClientRepository;
  private readonly clientListService: ClientListService;
  private readonly clock: () => string;

  constructor(options: ClientControllerOptions) {
    this.clientRepository = options.clientRepository;
    this.clock =
      options.clock ??
      (() => {
        return new Date().toISOString().slice(0, 10);
      });
    this.clientListService =
      options.clientListService ??
      new ClientListService({
        clientRepository: this.clientRepository,
        clock: this.clock,
      });
  }

  private async evaluateClientById(req: Request): Promise<{
    clientData: ClientWithFinancialData;
    evaluation: ClientEvaluationResult;
    asOfDate: string;
  }> {
    const rawId = req.params.id;
    const id = Array.isArray(rawId) ? rawId[0] : rawId;
    if (!id || typeof id !== "string" || !UUID_REGEX.test(id)) {
      throw new BadRequestError("Invalid client ID format");
    }

    const user = req.user;
    if (!user) {
      throw new UnauthorizedError("Authentication required");
    }

    const clientData = await this.clientRepository.findClientById(id, user.id);
    if (!clientData) {
      throw new NotFoundError("Client not found");
    }

    const asOfDate = this.clock();
    const domainInput = toDomainEvaluationInput(clientData);
    const evaluation = evaluateClient(domainInput, asOfDate);

    return { clientData, evaluation, asOfDate };
  }

  getClientList = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const user = req.user;
      if (!user) {
        throw new UnauthorizedError("Authentication required");
      }

      const query = clientListQuerySchema.parse(req.query);

      const result = await this.clientListService.getClientList({
        rmId: user.id,
        search: query.search,
        priority: query.priority,
        health: query.health,
        page: query.page,
        pageSize: query.pageSize,
      });

      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  };

  getProfileSnapshot = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { clientData, evaluation } = await this.evaluateClientById(req);
      const responsePayload = toClientProfileSnapshotResponse(
        evaluation,
        clientData
      );

      res.status(200).json(responsePayload);
    } catch (err) {
      next(err);
    }
  };

  getClientHealth = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { evaluation } = await this.evaluateClientById(req);
      res.status(200).json(evaluation.health);
    } catch (err) {
      next(err);
    }
  };

  getClientRecommendation = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { evaluation } = await this.evaluateClientById(req);
      res.status(200).json(evaluation.recommendation);
    } catch (err) {
      next(err);
    }
  };

  getClientSummary = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { evaluation, asOfDate } = await this.evaluateClientById(req);
      const summaryPayload: ClientSummaryResponse = {
        summary: evaluation.summary,
        health: evaluation.health,
        primaryGoal: evaluation.primaryGoal,
        recommendation: evaluation.recommendation,
        asOfDate,
      };

      res.status(200).json(summaryPayload);
    } catch (err) {
      next(err);
    }
  };
}

