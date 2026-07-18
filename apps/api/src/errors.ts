import type { ErrorRequestHandler, NextFunction, Request, RequestHandler, Response } from "express";
import type { ErrorCode, ErrorResponse } from "@fieldpulse/contracts";
import { ZodError } from "zod";

const STATUS: Record<ErrorCode, number> = {
  bad_request: 400,
  unauthorized: 401,
  forbidden: 403,
  not_found: 404,
  conflict: 409,
  invalid_transition: 422,
  internal: 500,
};

export class HttpError extends Error {
  constructor(
    readonly code: ErrorCode,
    message: string,
    readonly issues?: { path: string; message: string }[],
  ) {
    super(message);
  }
  get status() {
    return STATUS[this.code];
  }
}

export const notFound = (what: string) => new HttpError("not_found", `${what} not found`);

/** Express 4 does not catch rejected promises; route async handlers through this. */
export function asyncHandler<Req extends Request = Request>(
  fn: (req: Req, res: Response, next: NextFunction) => Promise<unknown>,
): RequestHandler {
  return (req, res, next) => {
    fn(req as Req, res, next).catch(next);
  };
}

export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  let body: ErrorResponse;
  let status: number;

  if (err instanceof HttpError) {
    status = err.status;
    body = { error: { code: err.code, message: err.message, issues: err.issues } };
  } else if (err instanceof ZodError) {
    status = 400;
    body = {
      error: {
        code: "bad_request",
        message: "Validation failed",
        issues: err.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
      },
    };
  } else if (err?.type === "entity.parse.failed") {
    status = 400;
    body = { error: { code: "bad_request", message: "Malformed JSON body" } };
  } else {
    req.log?.error({ err }, "unhandled error");
    status = 500;
    body = { error: { code: "internal", message: "Something went wrong" } };
  }
  res.status(status).json(body);
};
