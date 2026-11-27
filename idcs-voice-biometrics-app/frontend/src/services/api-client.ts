import type { ApplicationProblem } from "../types/application-contracts";

export class ApiError extends Error {
  readonly status: number;
  readonly problem?: ApplicationProblem;
  readonly retryAfterSeconds?: number;

  constructor(
    status: number,
    problem?: ApplicationProblem,
    retryAfterSeconds?: number
  ) {
    super("The request could not be completed.");
    this.name = "ApiError";
    this.status = status;
    this.problem = problem;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

export interface ApiResponse<T> {
  readonly value: T;
  readonly csrfToken?: string;
}

export class ApiClient {
  private readonly onAuthenticationRequired?: () => void;

  constructor(onAuthenticationRequired?: () => void) {
    this.onAuthenticationRequired = onAuthenticationRequired;
  }

  async request<T>(path: string, init: RequestInit = {}): Promise<ApiResponse<T>> {
    if (!path.startsWith("/api/v1/") || path.startsWith("//")) {
      throw new TypeError("Only same-origin application API paths are allowed");
    }
    const response = await fetch(path, {
      ...init,
      credentials: "same-origin",
      cache: "no-store",
      redirect: "error",
      headers: {
        Accept: "application/json, application/problem+json",
        ...init.headers
      }
    });
    if (!response.ok) {
      if (response.status === 401 && path !== "/api/v1/auth/login") {
        this.onAuthenticationRequired?.();
      }
      let problem: ApplicationProblem | undefined;
      if (response.headers.get("content-type")?.includes("application/problem+json")) {
        try {
          problem = (await response.json()) as ApplicationProblem;
        } catch {
          problem = undefined;
        }
      }
      const retryHeader = Number.parseInt(response.headers.get("Retry-After") ?? "", 10);
      throw new ApiError(
        response.status,
        problem,
        Number.isFinite(retryHeader) ? retryHeader : problem?.retryAfterSeconds
      );
    }
    const csrfToken = response.headers.get("X-CSRF-Token") ?? undefined;
    if (response.status === 204) {
      return { value: undefined as T, csrfToken };
    }
    return { value: (await response.json()) as T, csrfToken };
  }
}
