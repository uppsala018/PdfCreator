export type AIProviderId = string
export type AIModelId = string

export type AIProviderKind =
  | "openai"
  | "anthropic"
  | "openrouter"
  | "gemini"
  | "mistral"
  | "openai_compatible"
  | "mock"
  | "custom"

export interface AIProviderCapabilities {
  textGeneration: boolean
  structuredJson: boolean
  nativeJsonMode: boolean
  toolCalls: boolean
  vision: boolean
  streaming: boolean
}

export interface AIModelConfig {
  id: AIModelId
  label?: string
  contextWindow?: number
  maxOutputTokens?: number
  supportsStructuredJson?: boolean
  recommendedFor?: Array<"planning" | "drafting" | "repair" | "cleanup" | "long_context">
}

export interface AIProviderConfig {
  id: AIProviderId
  kind: AIProviderKind
  displayName: string
  baseUrl?: string
  apiKey?: string
  apiKeyEnvVar?: string
  defaultModel?: string
  fallbackProviderId?: string
  models?: AIModelConfig[]
  capabilities: AIProviderCapabilities
  headers?: Record<string, string>
}

export interface AIMessage {
  role: "system" | "user" | "assistant"
  content: string
}

export interface AIRetryPolicy {
  maxAttempts: number
  backoffMs: number
}

export interface AIFallbackStrategy {
  providerIds: string[]
  retryPolicy?: AIRetryPolicy
}

export interface AIRequest {
  messages: AIMessage[]
  model?: string
  temperature?: number
  maxOutputTokens?: number
  metadata?: Record<string, string | number | boolean | null>
  retryPolicy?: AIRetryPolicy
  fallbackStrategy?: AIFallbackStrategy
}

export interface AIResponse {
  providerId: string
  model: string
  text: string
  raw?: unknown
  usage?: {
    inputTokens?: number
    outputTokens?: number
    totalTokens?: number
  }
}

export interface StructuredJsonValidation<T> {
  schemaName: string
  validate?: (value: unknown) => value is T
}

export interface AIStructuredRequest<T> extends AIRequest {
  json: StructuredJsonValidation<T>
}

export interface AIStructuredResponse<T> extends AIResponse {
  json: T
  validation: {
    schemaName: string
    valid: boolean
    repaired: boolean
    errors: string[]
  }
}

export interface AIProviderMetadata {
  id: string
  kind: AIProviderKind
  displayName: string
  capabilities: AIProviderCapabilities
  models: AIModelConfig[]
  configured: boolean
}
