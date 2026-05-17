import type { AIProviderAdapter } from "@/lib/ai-runtime/provider-interface"
import { assertServerSideProviderConfig, isProviderConfigured } from "@/lib/ai-runtime/provider-config"
import { AIProviderError, normalizeProviderError } from "@/lib/ai-runtime/provider-errors"
import type {
  AIProviderConfig,
  AIProviderMetadata,
  AIResponse,
  AIStructuredResponse,
} from "@/lib/ai-runtime/provider-types"

export interface OpenAICompatibleProviderOptions {
  id: string
  displayName: string
  baseUrl: string
  apiKeyEnvVar?: string
  apiKey?: string
  defaultModel: string
}

export function createOpenAICompatibleConfig(
  options: OpenAICompatibleProviderOptions
): AIProviderConfig {
  return {
    id: options.id,
    kind: "openai_compatible",
    displayName: options.displayName,
    baseUrl: options.baseUrl,
    apiKey: options.apiKey,
    apiKeyEnvVar: options.apiKeyEnvVar,
    defaultModel: options.defaultModel,
    capabilities: {
      textGeneration: true,
      structuredJson: true,
      nativeJsonMode: false,
      toolCalls: false,
      vision: false,
      streaming: false,
    },
    models: [
      {
        id: options.defaultModel,
        label: options.defaultModel,
        supportsStructuredJson: true,
      },
    ],
  }
}

export class OpenAICompatibleProvider implements AIProviderAdapter {
  readonly config: AIProviderConfig

  constructor(config: AIProviderConfig) {
    assertServerSideProviderConfig(config)
    this.config = config
  }

  getMetadata(): AIProviderMetadata {
    return {
      id: this.config.id,
      kind: this.config.kind,
      displayName: this.config.displayName,
      capabilities: this.config.capabilities,
      models: this.config.models ?? [],
      configured: isProviderConfigured(this.config),
    }
  }

  async generateText(): Promise<AIResponse> {
    throw new AIProviderError(
      "UNSUPPORTED_OPERATION",
      "OpenAI-compatible live generation is not enabled in this runtime foundation yet.",
      { providerId: this.config.id }
    )
  }

  async generateStructuredJson<T>(): Promise<AIStructuredResponse<T>> {
    throw new AIProviderError(
      "UNSUPPORTED_OPERATION",
      "OpenAI-compatible structured generation is not enabled in this runtime foundation yet.",
      { providerId: this.config.id }
    )
  }

  async validateConnection() {
    const missing: string[] = []
    if (!this.config.baseUrl) missing.push("baseUrl")
    if (!this.config.defaultModel) missing.push("defaultModel")

    if (missing.length > 0) {
      return {
        ok: false,
        message: `Missing OpenAI-compatible provider config: ${missing.join(", ")}.`,
      }
    }

    return {
      ok: true,
      message: "OpenAI-compatible provider config is valid. Live calls are disabled.",
    }
  }

  normalizeError(error: unknown) {
    return normalizeProviderError(error, this.config.id)
  }
}
