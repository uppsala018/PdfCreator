import type {
  AIProviderConfig,
  AIProviderMetadata,
  AIRequest,
  AIResponse,
  AIStructuredRequest,
  AIStructuredResponse,
} from "@/lib/ai-runtime/provider-types"
import type { AIProviderError } from "@/lib/ai-runtime/provider-errors"

export interface AIProviderAdapter {
  readonly config: AIProviderConfig
  getMetadata(): AIProviderMetadata
  generateText(request: AIRequest): Promise<AIResponse>
  generateStructuredJson<T>(request: AIStructuredRequest<T>): Promise<AIStructuredResponse<T>>
  validateConnection(): Promise<{ ok: boolean; message?: string }>
  normalizeError(error: unknown): AIProviderError
}
