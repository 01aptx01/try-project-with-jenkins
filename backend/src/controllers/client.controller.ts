import type { NextFunction, Request, Response } from "express";
import { evaluateClient } from "../domain/financial/evaluate-client.js";
import { BadRequestError, NotFoundError, UnauthorizedError } from "../errors.js";
import {
  toClientProfileSnapshotResponse,
  toDomainEvaluationInput,
} from "../mappers/client.mapper.js";
import type { ClientRepository } from "../repositories/client.repository.js";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface ClientControllerOptions {
  clientRepository: ClientRepository;
  clock?: (() => string) | undefined;
}

export class ClientController {
  private readonly clientRepository: ClientRepository;
  private readonly clock: () => string;

  constructor(options: ClientControllerOptions) {
    this.clientRepository = options.clientRepository;
    this.clock =
      options.clock ??
      (() => {
        return new Date().toISOString().slice(0, 10);
      });
  }

  getProfileSnapshot = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
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
      const responsePayload = toClientProfileSnapshotResponse(
        evaluation,
        clientData
      );

      res.status(200).json(responsePayload);
    } catch (err) {
      next(err);
    }
  };
}
