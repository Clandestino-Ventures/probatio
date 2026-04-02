/**
 * PROBATIO — Modal.com API Client
 *
 * HTTP client for calling Modal.com serverless GPU endpoints.
 * Handles authentication, typed requests/responses, retries with
 * exponential backoff, and structured error handling.
 *
 * All audio processing (normalization, stem separation, feature extraction,
 * embedding generation, similarity search) runs on Modal GPU infrastructure.
 */

// ────────────────────────────────────────────────────────────────────────────
// Configuration
// ────────────────────────────────────────────────────────────────────────────

interface ModalClientConfig {
  /** Base URL for the Modal deployment. */
  baseUrl: string;
  /** Auth token for Modal API. */
  authToken: string;
  /** Maximum number of retry attempts on transient failures. */
  maxRetries: number;
  /** Base delay in milliseconds for exponential backoff. */
  baseDelayMs: number;
  /** Request timeout in milliseconds. */
  timeoutMs: number;
}

function getConfig(): ModalClientConfig {
  // Modal.com endpoint URL — set when functions are deployed
  // Falls back to MODAL_ENDPOINT_URL for backward compatibility
  const baseUrl =
    process.env.MODAL_BASE_URL || process.env.MODAL_ENDPOINT_URL;
  if (!baseUrl) {
    throw new Error(
      "Missing MODAL_BASE_URL (or MODAL_ENDPOINT_URL) environment variable."
    );
  }

  // Modal.com uses token-based auth for web endpoints
  // Construct from MODAL_TOKEN_ID + MODAL_TOKEN_SECRET, or use MODAL_AUTH_TOKEN directly
  const authToken =
    process.env.MODAL_AUTH_TOKEN ||
    (process.env.MODAL_TOKEN_ID && process.env.MODAL_TOKEN_SECRET
      ? `${process.env.MODAL_TOKEN_ID}:${process.env.MODAL_TOKEN_SECRET}`
      : "");

  if (!authToken) {
    throw new Error(
      "Missing Modal auth credentials. Set MODAL_AUTH_TOKEN or MODAL_TOKEN_ID + MODAL_TOKEN_SECRET."
    );
  }

  return {
    baseUrl: baseUrl.replace(/\/$/, ""), // strip trailing slash
    authToken,
    maxRetries: 3,
    baseDelayMs: 1000,
    timeoutMs: 300_000, // 5 minutes
  };
}

// ────────────────────────────────────────────────────────────────────────────
// Error Types
// ────────────────────────────────────────────────────────────────────────────

/** Error returned when a Modal endpoint call fails. */
export class ModalApiError extends Error {
  readonly statusCode: number;
  readonly endpoint: string;
  readonly responseBody: string | null;
  readonly isRetryable: boolean;

  constructor(params: {
    message: string;
    statusCode: number;
    endpoint: string;
    responseBody: string | null;
    isRetryable: boolean;
  }) {
    super(params.message);
    this.name = "ModalApiError";
    this.statusCode = params.statusCode;
    this.endpoint = params.endpoint;
    this.responseBody = params.responseBody;
    this.isRetryable = params.isRetryable;
  }
}

// ────────────────────────────────────────────────────────────────────────────
// Retry Logic
// ────────────────────────────────────────────────────────────────────────────

/** HTTP status codes that are safe to retry. */
const RETRYABLE_STATUS_CODES = new Set([408, 429, 500, 502, 503, 504]);

function isRetryableStatus(statusCode: number): boolean {
  return RETRYABLE_STATUS_CODES.has(statusCode);
}

function computeBackoffMs(attempt: number, baseDelayMs: number): number {
  // Exponential backoff with jitter: baseDelay * 2^attempt + random jitter
  const exponentialDelay = baseDelayMs * Math.pow(2, attempt);
  const jitter = Math.random() * baseDelayMs;
  return exponentialDelay + jitter;
}

async function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ────────────────────────────────────────────────────────────────────────────
// Client Function
// ────────────────────────────────────────────────────────────────────────────

/**
 * Call a Modal.com endpoint with typed request and response.
 *
 * @typeParam TRequest   The request body type.
 * @typeParam TResponse  The expected response body type.
 *
 * @param endpointPath  Path to the Modal endpoint (e.g. "/normalize").
 * @param payload       The request body to send as JSON.
 * @param options       Optional overrides for timeout and retries.
 * @returns The parsed response body typed as `TResponse`.
 *
 * @throws {ModalApiError} If the endpoint returns a non-2xx status after
 *         all retries are exhausted.
 * @throws {Error} If the request times out or a network error occurs.
 */
export async function callModalEndpoint<TRequest, TResponse>(
  endpointPath: string,
  payload: TRequest,
  options?: {
    timeoutMs?: number;
    maxRetries?: number;
  },
): Promise<TResponse> {
  const config = getConfig();
  const maxRetries = options?.maxRetries ?? config.maxRetries;
  const timeoutMs = options?.timeoutMs ?? config.timeoutMs;
  const url = `${config.baseUrl}${endpointPath}`;

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${config.authToken}`,
          "X-Probatio-Request-Id": crypto.randomUUID(),
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        const data = (await response.json()) as TResponse;
        return data;
      }

      // Non-2xx response.
      const responseBody = await response.text().catch(() => null);
      const retryable = isRetryableStatus(response.status);

      const error = new ModalApiError({
        message: `Modal endpoint ${endpointPath} returned ${response.status}: ${responseBody ?? "No response body"}`,
        statusCode: response.status,
        endpoint: endpointPath,
        responseBody,
        isRetryable: retryable,
      });

      if (!retryable) {
        // Non-retryable error — throw immediately.
        throw error;
      }

      lastError = error;
    } catch (err) {
      if (err instanceof ModalApiError && !err.isRetryable) {
        throw err;
      }

      // Network error, timeout, or retryable status code.
      lastError =
        err instanceof Error
          ? err
          : new Error(`Unknown error calling Modal endpoint: ${String(err)}`);
    }

    // Wait before retrying (skip delay on the last attempt).
    if (attempt < maxRetries) {
      const backoffMs = computeBackoffMs(attempt, config.baseDelayMs);
      await delay(backoffMs);
    }
  }

  throw lastError ?? new Error(`Modal endpoint ${endpointPath} failed after ${maxRetries} retries`);
}
