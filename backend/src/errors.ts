export class ApiError extends Error {
  constructor(public readonly status: number, public readonly code: string, message: string) {
    super(message);
  }
}

export class DependencyUnavailableError extends ApiError {
  constructor() {
    super(503, "DEPENDENCY_UNAVAILABLE", "A required dependency is unavailable");
  }
}
