import type { AIProviderAdapter } from "@/lib/ai-runtime/provider-interface"
import { normalizeProviderError } from "@/lib/ai-runtime/provider-errors"
import type {
  AIProviderConfig,
  AIProviderMetadata,
  AIRequest,
  AIResponse,
  AIStructuredRequest,
  AIStructuredResponse,
} from "@/lib/ai-runtime/provider-types"

export interface MockProviderOptions {
  id?: string
  text?: string
  structuredJson?: unknown
}

export class MockAIProvider implements AIProviderAdapter {
  readonly config: AIProviderConfig
  private readonly text: string
  private readonly structuredJson: unknown

  constructor(options: MockProviderOptions = {}) {
    this.text = options.text ?? "Mock AI response"
    this.structuredJson = options.structuredJson ?? { ok: true }
    this.config = {
      id: options.id ?? "mock",
      kind: "mock",
      displayName: "Mock Provider",
      defaultModel: "mock-model",
      capabilities: {
        textGeneration: true,
        structuredJson: true,
        nativeJsonMode: true,
        toolCalls: false,
        vision: false,
        streaming: false,
      },
      models: [{ id: "mock-model", label: "Mock Model", supportsStructuredJson: true }],
      keySource: "mock",
    }
  }

  getMetadata(): AIProviderMetadata {
    return {
      id: this.config.id,
      kind: this.config.kind,
      displayName: this.config.displayName,
      capabilities: this.config.capabilities,
      models: this.config.models ?? [],
      configured: true,
      defaultModel: this.config.defaultModel,
      keySource: "mock",
    }
  }

  async generateText(request: AIRequest): Promise<AIResponse> {
    return {
      providerId: this.config.id,
      model: request.model ?? this.config.defaultModel ?? "mock-model",
      text: this.text,
      raw: { messages: request.messages },
    }
  }

  async generateStructuredJson<T>(
    request: AIStructuredRequest<T>
  ): Promise<AIStructuredResponse<T>> {
    const value = this.structuredJson
    const valid = request.json.validate ? request.json.validate(value) : true
    const json = value as T

    return {
      providerId: this.config.id,
      model: request.model ?? this.config.defaultModel ?? "mock-model",
      text: JSON.stringify(value),
      json,
      raw: value,
      validation: {
        schemaName: request.json.schemaName,
        valid,
        repaired: false,
        errors: valid ? [] : [`Mock response failed ${request.json.schemaName} validation.`],
      },
    }
  }

  async validateConnection() {
    return { ok: true, message: "Mock provider is available." }
  }

  normalizeError(error: unknown) {
    return normalizeProviderError(error, this.config.id)
  }
}
