import { ApiError } from "@fieldpulse/api-client";

export function ErrorText({ error }: { error: unknown }) {
  if (!error) return null;
  const message =
    error instanceof ApiError
      ? [error.message, ...error.issues.map((i) => `${i.path}: ${i.message}`)].join(" — ")
      : error instanceof Error
        ? error.message
        : "Something went wrong";
  return <p className="error">{message}</p>;
}
