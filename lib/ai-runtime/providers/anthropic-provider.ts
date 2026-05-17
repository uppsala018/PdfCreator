import type { AIProviderAdapter } from "@/lib/ai-runtime/provider-interface"
import {
  assertServerSideProviderConfig,
  isProviderConfigured,
  resolveProviderApiKey,
  resolveProviderKeySource,
} from "@/lib/ai-runtime/provider-config"
import { AIProviderError, normalizeProviderError } from "@/lib/ai-runtime/provider-errors"
import type {
  AIProviderConfig,
  AIProviderMetadata,
  AIRequest,
  AIResponse,
  AIStructuredRequest,
  AIStructuredResponse,
} from "@/lib/ai-runtime/provider-types"

export function createAnthropicConfig(options: {
  id?: string
  displayName?: string
  apiKey?: string
  apiKeyEnvVar?: string
  defaultModel: string
}): AIProviderConfig {
  return {
    id: options.id ?? "anthropic",
    kind: "anthropic",
    displayName: options.displayName ?? "Anthropic",
    apiKey: options.apiKey,
    apiKeyEnvVar: options.apiKeyEnvVar,
    defaultModel: options.defaultModel,
    compatibilityMode: "anthropic-compatible",
    capabilities: {
      textGeneration: true,
      structuredJson: true,
      nativeJsonMode: false,
      toolCalls: false,
      vision: false,
      streaming: false,
    },
    models: [{ id: options.defaultModel, label: options.defaultModel, supportsStructuredJson: true }],
  }
}

export class AnthropicProvider implements AIProviderAdapter {
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
      defaultModel: this.config.defaultModel,
      keySource: resolveProviderKeySource(this.config),
      compatibilityMode: this.config.compatibilityMode,
    }
  }

  async generateText(request: AIRequest): Promise<AIResponse> {
    const json = await this.createMessage(request)
    const text = extractAnthropicText(json)
    if (!text) {
      throw new AIProviderError("INVALID_JSON", "Anthropic returned no text content.", {
        providerId: this.config.id,
      })
    }
    return {
      providerId: this.config.id,
      model: request.model ?? this.config.defaultModel ?? "unknown",
      text: text.trim(),
      raw: json,
      usage: normalizeUsage(json),
    }
  }

  async generateStructuredJson<T>(
    request: AIStructuredRequest<T>
  ): Promise<AIStructuredResponse<T>> {
    const response = await this.generateText({
      ...request,
      messages: [
        {
          role: "system",
          content: `Return only valid JSON for schema ${request.json.schemaName}.`,
        },
        ...request.messages,
      ],
    })
    const parsed = parseJsonFromText(response.text, this.config.id)
    const valid = request.json.validate ? request.json.validate(parsed) : true
    return {
      ...response,
      json: parsed as T,
      validation: {
        schemaName: request.json.schemaName,
        valid,
        repaired: false,
        errors: valid ? [] : [`Provider response failed ${request.json.schemaName} validation.`],
      },
    }
  }

  async validateConnection() {
    const missing: string[] = []
    if (!resolveProviderApiKey(this.config)) missing.push("apiKey")
    if (!this.config.defaultModel) missing.push("defaultModel")
    return missing.length
      ? { ok: false, message: `Missing Anthropic provider config: ${missing.join(", ")}.` }
      : { ok: true, message: "Anthropic provider config is valid." }
  }

  normalizeError(error: unknown) {
    return normalizeProviderError(error, this.config.id)
  }

  private async createMessage(request: AIRequest): Promise<unknown> {
    const validation = await this.validateConnection()
    if (!validation.ok) {
      throw new AIProviderError("CONFIGURATION_ERROR", validation.message ?? "Invalid provider config.", {
        providerId: this.config.id,
      })
    }

    const system = request.messages
      .filter((message) => message.role === "system")
      .map((message) => message.content)
      .join("\n\n")
    const messages = request.messages
      .filter((message) => message.role !== "system")
      .map((message) => ({ role: message.role === "assistant" ? "assistant" : "user", content: message.content }))
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 60_000)

    try {
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
          "x-api-key": resolveProviderApiKey(this.config) ?? "",
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: request.model ?? this.config.defaultModel,
          max_tokens: request.maxOutputTokens ?? 2048,
          temperature: request.temperature ?? 0.7,
          system: system || undefined,
          messages,
        }),
      })
      const text = await response.text()
      let json: unknown
      try {
        json = text ? JSON.parse(text) : {}
      } catch (error) {
        throw new AIProviderError("INVALID_JSON", "Anthropic returned malformed JSON.", {
          providerId: this.config.id,
          status: response.status,
          cause: error,
        })
      }
      if (!response.ok) {
        throw normalizeProviderError(
          { status: response.status, message: extractProviderErrorMessage(json) ?? response.statusText },
          this.config.id
        )
      }
      return json
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        throw new AIProviderError("PROVIDER_UNAVAILABLE", "Anthropic request timed out.", {
          providerId: this.config.id,
          retryable: true,
          cause: error,
        })
      }
      throw normalizeProviderError(error, this.config.id)
    } finally {
      clearTimeout(timeout)
    }
  }
}

function extractAnthropicText(value: unknown): string | null {
  const content = (value as { content?: Array<{ type?: string; text?: unknown }> }).content
  const text = content?.find((block) => block.type === "text")?.text
  return typeof text === "string" ? text : null
}

function normalizeUsage(value: unknown) {
  const usage = (value as { usage?: { input_tokens?: number; output_tokens?: number } }).usage
  if (!usage) return undefined
  return {
    inputTokens: usage.input_tokens,
    outputTokens: usage.output_tokens,
    totalTokens:
      typeof usage.input_tokens === "number" && typeof usage.output_tokens === "number"
        ? usage.input_tokens + usage.output_tokens
        : undefined,
  }
}

function parseJsonFromText(text: string, providerId: string): unknown {
  const trimmed = text.trim()
  const candidates = [
    trimmed,
    trimmed.match(/```(?:json)?\s*([\s\S]*?)```/)?.[1],
    trimmed.match(/\{[\s\S]*\}/)?.[0],
  ].filter((candidate): candidate is string => Boolean(candidate))
  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate)
    } catch {
      continue
    }
  }
  throw new AIProviderError("INVALID_JSON", "Anthropic response was not valid JSON.", {
    providerId,
  })
}

function extractProviderErrorMessage(value: unknown): string | null {
  const error = (value as { error?: { message?: unknown } })?.error
  return typeof error?.message === "string" ? error.message : null
}
