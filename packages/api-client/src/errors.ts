import type { ErrorCode } from "@fieldpulse/contracts";

/** Error returned by the API with a structured body. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: ErrorCode,
    message: string,
    readonly issues: { path: string; message: string }[] = [],
  ) {
    super(message);
    this.name = "ApiError";
  }

  /** 5xx and 429 are worth retrying; 4xx means the request itself is wrong. */
  get retryable(): boolean {
    return this.status >= 500 || this.status === 429;
  }
}

/** The request never got a response (offline, DNS, timeout). Always retryable. */
export class NetworkError extends Error {
  readonly retryable = true;
  constructor(message: string, readonly cause?: unknown) {
    super(message);
    this.name = "NetworkError";
  }
}

/** The server answered but the body did not match the shared contract. */
export class ContractError extends Error {
  readonly retryable = false;
  constructor(
    readonly route: string,
    readonly issues: { path: string; message: string }[],
  ) {
    super(`Response for ${route} violated the API contract`);
    this.name = "ContractError";
  }
}

export function isRetryable(err: unknown): boolean {
  if (err instanceof ApiError) return err.retryable;
  if (err instanceof NetworkError) return true;
  return false;
}
