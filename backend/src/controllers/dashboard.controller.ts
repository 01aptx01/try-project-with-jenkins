import type { NextFunction, Request, Response } from "express";
import { clientListQuerySchema } from "../contracts/api.js";
import { UnauthorizedError } from "../errors.js";
import type { ClientRepository } from "../repositories/client.repository.js";
import { ClientListService } from "../services/client-list.service.js";

export interface DashboardControllerOptions {
  clientRepository?: ClientRepository | undefined;
  clientListService?: ClientListService | undefined;
  clock?: (() => string) | undefined;
}

export class DashboardController {
  private readonly clientListService: ClientListService;

  constructor(options: DashboardControllerOptions) {
    if (options.clientListService) {
      this.clientListService = options.clientListService;
    } else if (options.clientRepository) {
      this.clientListService = new ClientListService({
        clientRepository: options.clientRepository,
        clock: options.clock,
      });
    } else {
      throw new Error(
        "DashboardController requires either clientListService or clientRepository"
      );
    }
  }

  getMorningActionPlan = async (
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

      const result = await this.clientListService.getMorningActionPlan({
        rmId: user.id,
        search: query.search,
        priority: query.priority,
        health: query.health,
        page: query.page,
        pageSize: query.pageSize,
      });

      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  };
}
