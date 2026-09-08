import { loginRequestSchema, type LoginRequest, type AuthUserSummary } from "../contracts/api.js";
import { UnauthorizedError } from "../errors.js";
import { verifyPassword, dummyVerifyPassword } from "./password.service.js";
import { signSessionToken } from "./token.service.js";
import type { UserRepository } from "../repositories/user.repository.js";

export interface AuthServiceOptions {
  userRepository: UserRepository;
  jwtSecret: string;
  clock?: () => number;
}

export interface LoginResult {
  user: AuthUserSummary;
  token: string;
}

export class AuthService {
  constructor(private readonly options: AuthServiceOptions) {}

  async login(rawPayload: unknown): Promise<LoginResult> {
    // 1. Strict schema validation
    const parsedPayload: LoginRequest = loginRequestSchema.parse(rawPayload);

    // 2. Query user with normalized email
    const user = await this.options.userRepository.findByEmail(parsedPayload.email);

    if (!user) {
      // Execute dummy compare to mitigate user enumeration timing attacks
      await dummyVerifyPassword();
      throw new UnauthorizedError("Invalid email or password");
    }

    // 3. Verify password
    const isPasswordValid = await verifyPassword(parsedPayload.password, user.passwordHash);
    if (!isPasswordValid) {
      throw new UnauthorizedError("Invalid email or password");
    }

    // 4. Verify user role
    if (user.role !== "RM") {
      throw new UnauthorizedError("Invalid email or password");
    }

    // 5. Sign JWT session token
    const token = signSessionToken(user.id, {
      secret: this.options.jwtSecret,
      clock: this.options.clock,
    });

    return {
      user: {
        id: user.id,
        name: user.name,
        role: "RM",
      },
      token,
    };
  }
}
