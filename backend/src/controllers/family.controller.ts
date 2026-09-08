import type { NextFunction, Request, Response } from "express";
import type {
  FamilyEdge,
  FamilyGraphResponse,
  FamilyNode,
} from "../contracts/api.js";
import { BadRequestError, NotFoundError, UnauthorizedError } from "../errors.js";
import type { ClientRepository } from "../repositories/client.repository.js";
import type { FamilyRepository } from "../repositories/family.repository.js";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function getClientDisplayName(client: {
  firstName: string | null;
  lastName: string | null;
  customerCode: string;
}): string {
  const fullName = `${client.firstName ?? ""} ${client.lastName ?? ""}`.trim();
  return fullName.length > 0 ? fullName : client.customerCode;
}

export interface FamilyControllerOptions {
  clientRepository: ClientRepository;
  familyRepository: FamilyRepository;
}

export class FamilyController {
  private readonly clientRepository: ClientRepository;
  private readonly familyRepository: FamilyRepository;

  constructor(options: FamilyControllerOptions) {
    this.clientRepository = options.clientRepository;
    this.familyRepository = options.familyRepository;
  }

  getFamilyGraph = async (
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

      // 1. Verify primary client exists and belongs to current RM
      const primaryClient = await this.clientRepository.findClientById(
        id,
        user.id
      );
      if (!primaryClient) {
        throw new NotFoundError("Client not found");
      }

      // 2. Fetch 1-hop relationships where primary client is either source or target
      const relationships =
        await this.familyRepository.find1HopRelationships(id);

      // 3. Filter relationships: strictly keep only those where the related client also belongs to this RM
      const nodes: FamilyNode[] = [
        {
          id: primaryClient.id,
          label: getClientDisplayName(primaryClient),
          type: "PRIMARY",
        },
      ];

      const edges: FamilyEdge[] = [];
      const seenNodeIds = new Set<string>([primaryClient.id]);

      for (const rel of relationships) {
        const isClientPrimary = rel.clientId === id;
        const relative = isClientPrimary ? rel.relatedClient : rel.client;

        // Privacy boundary: discard relationship if relative belongs to another RM
        if (relative.rmId !== user.id) {
          continue;
        }

        // Add related node if not already present
        if (!seenNodeIds.has(relative.id)) {
          seenNodeIds.add(relative.id);
          nodes.push({
            id: relative.id,
            label: getClientDisplayName(relative),
            type: "RELATED",
          });
        }

        // Add 1-hop edge
        edges.push({
          id: rel.id,
          source: rel.clientId,
          target: rel.relatedClientId,
          relationshipType: rel.relationshipType,
        });
      }

      const responsePayload: FamilyGraphResponse = {
        nodes,
        edges,
      };

      res.status(200).json(responsePayload);
    } catch (err) {
      next(err);
    }
  };
}
