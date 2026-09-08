import type { PrismaClient, UserRole } from "@prisma/client";
import { isPrismaDependencyError, DependencyUnavailableError } from "../errors.js";

export interface UserRecord {
  id: string;
  email: string;
  passwordHash: string;
  name: string;
  role: UserRole;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserRepository {
  findByEmail(email: string): Promise<UserRecord | null>;
  findById(id: string): Promise<UserRecord | null>;
}

export class PrismaUserRepository implements UserRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findByEmail(email: string): Promise<UserRecord | null> {
    try {
      const user = await this.prisma.user.findUnique({
        where: { email: email.trim().toLowerCase() },
      });
      return user;
    } catch (error) {
      if (isPrismaDependencyError(error)) {
        throw new DependencyUnavailableError();
      }
      throw error;
    }
  }

  async findById(id: string): Promise<UserRecord | null> {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id },
      });
      return user;
    } catch (error) {
      if (isPrismaDependencyError(error)) {
        throw new DependencyUnavailableError();
      }
      throw error;
    }
  }
}

/**
 * In-memory repository for unit testing and fast harness execution
 */
export class InMemoryUserRepository implements UserRepository {
  private users = new Map<string, UserRecord>();

  constructor(initialUsers: UserRecord[] = []) {
    for (const u of initialUsers) {
      this.users.set(u.id, u);
    }
  }

  addUser(user: UserRecord): void {
    this.users.set(user.id, user);
  }

  async findByEmail(email: string): Promise<UserRecord | null> {
    const normalized = email.trim().toLowerCase();
    for (const user of this.users.values()) {
      if (user.email.trim().toLowerCase() === normalized) {
        return user;
      }
    }
    return null;
  }

  async findById(id: string): Promise<UserRecord | null> {
    return this.users.get(id) ?? null;
  }
}
