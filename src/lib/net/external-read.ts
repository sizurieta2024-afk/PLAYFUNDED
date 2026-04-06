import { logOpsEvent } from "@/lib/ops-events";
import { fetchWithTimeout } from "@/lib/net/fetch-with-timeout";

export type ExternalReadFailureCode =
  | "timeout"
  | "quota_exhausted"
  | "provider_outage"
  | "bad_response"
  | "network_error";

export class ExternalReadError extends Error {
  code: ExternalReadFailureCode;
  provider: string;
  operation: string;
  status: number | null;
  attempts: number;
  durationMs: number;
  retryable: boolean;

  constructor({
    message,
    code,
    provider,
    operation,
    status,
    attempts,
    durationMs,
    retryable,
  }: {
    message: string;
    code: ExternalReadFailureCode;
    provider: string;
    operation: string;
    status?: number | null;
    attempts: number;
    durationMs: number;
    retryable: boolean;
  }) {
    super(message);
    this.name = "ExternalReadError";
    this.code = code;
    this.provider = provider;
    this.operation = operation;
    this.status = status ?? null;
    this.attempts = attempts;
    this.durationMs = durationMs;
    this.retryable = retryable;
  }
}

export function getExternalReadFailureCode(error: unknown): ExternalReadFailureCode | null {
  return error instanceof ExternalReadError ? error.code : null;
}

export function describeExternalReadFailure(
  error: unknown,
  providerLabel: string,
): string {
  const code = getExternalReadFailureCode(error);
  if (code === "quota_exhausted") {
    return `${providerLabel} quota exhausted`;
  }
  if (code === "timeout") {
    return `${providerLabel} timed out`;
  }
  if (code === "provider_outage") {
    return `${providerLabel} unavailable`;
  }
  if (code === "bad_response") {
    return `${providerLabel} returned an invalid response`;
  }
  if (code === "network_error") {
    return `${providerLabel} network error`;
  }
  return `${providerLabel} request failed`;
}

interface ExternalReadValidationError {
  code: Extract<ExternalReadFailureCode, "quota_exhausted" | "bad_response">;
  message: string;
}

interface ExternalJsonOptions<T> {
  provider: string;
  operation: string;
  url: string | URL;
  init?: RequestInit;
  timeoutMs?: number;
  retries?: number;
  baseDelayMs?: number;
  recordOps?: boolean;
  validate?: (payload: T) => ExternalReadValidationError | null;
}

interface ExternalJsonResult<T> {
  data: T;
  attempts: number;
  durationMs: number;
  response: Response;
}

const QUOTA_PATTERNS = [
  "out_of_usage_credits",
  "exceeded_freq_limit",
  "usage quota has been reached",
  "requests are too frequent",
  "rate limit",
  "too many requests",
  "quota",
  "credits",
];

function isQuotaLike(content: string): boolean {
  const lowered = content.toLowerCase();
  return QUOTA_PATTERNS.some((pattern) => lowered.includes(pattern));
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function shouldRetry(code: ExternalReadFailureCode, status: number | null): boolean {
  if (code === "timeout" || code === "network_error" || code === "provider_outage") {
    return true;
  }
  if (status === 408 || status === 425) {
    return true;
  }
  return false;
}

function classifyHttpFailure(
  status: number,
  responseText: string,
): ExternalReadFailureCode {
  if (status === 429 || isQuotaLike(responseText)) {
    return "quota_exhausted";
  }
  if (status >= 500) {
    return "provider_outage";
  }
  return "bad_response";
}

function normalizeThrownError(
  error: unknown,
  provider: string,
  operation: string,
  attempts: number,
  durationMs: number,
): ExternalReadError {
  if (error instanceof ExternalReadError) {
    return error;
  }
  if (error instanceof DOMException && error.name === "AbortError") {
    return new ExternalReadError({
      message: `${provider} ${operation} timed out`,
      code: "timeout",
      provider,
      operation,
      attempts,
      durationMs,
      retryable: true,
    });
  }
  if (error instanceof Error) {
    return new ExternalReadError({
      message: `${provider} ${operation} network error: ${error.message}`,
      code: "network_error",
      provider,
      operation,
      attempts,
      durationMs,
      retryable: true,
    });
  }
  return new ExternalReadError({
    message: `${provider} ${operation} failed`,
    code: "network_error",
    provider,
    operation,
    attempts,
    durationMs,
    retryable: true,
  });
}

function recordProviderResult(params: {
  ok: boolean;
  provider: string;
  operation: string;
  attempts: number;
  durationMs: number;
  status?: number | null;
  code?: ExternalReadFailureCode;
  message?: string;
}): void {
  logOpsEvent({
    type: params.ok ? "provider_read_completed" : "provider_read_failed",
    level: params.ok ? "info" : "warn",
    source: `provider:${params.provider}`,
    subjectType: "provider",
    subjectId: params.provider,
    details: {
      provider: params.provider,
      operation: params.operation,
      attempts: params.attempts,
      durationMs: params.durationMs,
      status: params.status ?? null,
      code: params.code ?? null,
      message: params.message ?? null,
    },
  });
}

export async function fetchExternalJson<T>(
  options: ExternalJsonOptions<T>,
): Promise<ExternalJsonResult<T>> {
  const {
    provider,
    operation,
    url,
    init,
    timeoutMs = 10_000,
    retries = 2,
    baseDelayMs = 250,
    recordOps = false,
    validate,
  } = options;

  const startedAt = Date.now();
  let lastError: ExternalReadError | null = null;

  for (let attempt = 1; attempt <= retries + 1; attempt += 1) {
    try {
      const response = await fetchWithTimeout(url, init, timeoutMs);
      if (!response.ok) {
        const responseText = await response.clone().text();
        const code = classifyHttpFailure(response.status, responseText);
        const durationMs = Date.now() - startedAt;
        const error = new ExternalReadError({
          message: `${provider} ${operation} failed with status ${response.status}`,
          code,
          provider,
          operation,
          status: response.status,
          attempts: attempt,
          durationMs,
          retryable: shouldRetry(code, response.status),
        });
        lastError = error;
        if (attempt <= retries && error.retryable) {
          await sleep(baseDelayMs * 2 ** (attempt - 1));
          continue;
        }
        throw error;
      }

      const data = (await response.json()) as T;
      const validationError = validate?.(data) ?? null;
      if (validationError) {
        const durationMs = Date.now() - startedAt;
        throw new ExternalReadError({
          message: `${provider} ${operation} invalid response: ${validationError.message}`,
          code: validationError.code,
          provider,
          operation,
          status: response.status,
          attempts: attempt,
          durationMs,
          retryable: false,
        });
      }

      const durationMs = Date.now() - startedAt;
      if (recordOps) {
        recordProviderResult({
          ok: true,
          provider,
          operation,
          attempts: attempt,
          durationMs,
          status: response.status,
        });
      }
      return { data, attempts: attempt, durationMs, response };
    } catch (error) {
      const normalizedError = normalizeThrownError(
        error,
        provider,
        operation,
        attempt,
        Date.now() - startedAt,
      );
      lastError = normalizedError;
      if (attempt <= retries && normalizedError.retryable) {
        await sleep(baseDelayMs * 2 ** (attempt - 1));
        continue;
      }
      break;
    }
  }

  if (recordOps && lastError) {
    recordProviderResult({
      ok: false,
      provider,
      operation,
      attempts: lastError.attempts,
      durationMs: lastError.durationMs,
      status: lastError.status,
      code: lastError.code,
      message: lastError.message,
    });
  }
  throw lastError ?? new Error(`${provider} ${operation} failed`);
}
