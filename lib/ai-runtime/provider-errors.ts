export type AIProviderErrorCode =
  | "CONFIGURATION_ERROR"
  | "AUTHENTICATION_ERROR"
  | "RATE_LIMITED"
  | "CONNECTION_ERROR"
  | "INVALID_REQUEST"
  | "INVALID_JSON"
  | "VALIDATION_ERROR"
  | "UNSUPPORTED_OPERATION"
  | "PROVIDER_UNAVAILABLE"
  | "UNKNOWN_PROVIDER_ERROR"

export interface AIProviderErrorDetails {
  providerId?: string
  status?: number
  retryable?: boolean
  cause?: unknown
}

export class AIProviderError extends Error {
  readonly code: AIProviderErrorCode
  readonly providerId?: string
  readonly status?: number
  readonly retryable: boolean
  readonly cause?: unknown

  constructor(code: AIProviderErrorCode, message: string, details: AIProviderErrorDetails = {}) {
    super(message)
    this.name = "AIProviderError"
    this.code = code
    this.providerId = details.providerId
    this.status = details.status
    this.retryable = details.retryable ?? false
    this.cause = details.cause
  }
}

export function normalizeProviderError(error: unknown, providerId?: string): AIProviderError {
  if (error instanceof AIProviderError) return error

  if (typeof error === "object" && error !== null) {
    const maybeStatus = "status" in error ? Number((error as { status?: unknown }).status) : undefined
    const message =
      "message" in error && typeof (error as { message?: unknown }).message === "string"
        ? (error as { message: string }).message
        : "AI provider request failed."

    if (maybeStatus === 401 || maybeStatus === 403) {
      return new AIProviderError("AUTHENTICATION_ERROR", message, {
        providerId,
        status: maybeStatus,
        cause: error,
      })
    }

    if (maybeStatus === 429) {
      return new AIProviderError("RATE_LIMITED", message, {
        providerId,
        status: maybeStatus,
        retryable: true,
        cause: error,
      })
    }

    if (maybeStatus && maybeStatus >= 500) {
      return new AIProviderError("PROVIDER_UNAVAILABLE", message, {
        providerId,
        status: maybeStatus,
        retryable: true,
        cause: error,
      })
    }

    return new AIProviderError("UNKNOWN_PROVIDER_ERROR", message, {
      providerId,
      status: maybeStatus,
      cause: error,
    })
  }

  return new AIProviderError(
    "UNKNOWN_PROVIDER_ERROR",
    typeof error === "string" ? error : "AI provider request failed.",
    { providerId, cause: error }
  )
}
