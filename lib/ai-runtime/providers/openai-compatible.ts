import type { AIProviderAdapter } from "@/lib/ai-runtime/provider-interface"
import {
  assertServerSideProviderConfig,
  isProviderConfigured,
  resolveProviderApiKey,
  resolveProviderKeySource,
} from "@/lib/ai-runtime/provider-config"
import { AIProviderError, normalizeProviderError } from "@/lib/ai-runtime/provider-errors"
import type {
  AIRequest,
  AIProviderConfig,
  AIProviderMetadata,
  AIResponse,
  AIStructuredRequest,
  AIStructuredResponse,
} from "@/lib/ai-runtime/provider-types"

export interface OpenAICompatibleProviderOptions {
  id: string
  displayName: string
  baseUrl: string
  apiKeyEnvVar?: string
  apiKey?: string
  defaultModel: string
  fallbackModel?: string
  fallbackModels?: string[]
  kind?: AIProviderConfig["kind"]
  headers?: Record<string, string>
}

export function createOpenAICompatibleConfig(
  options: OpenAICompatibleProviderOptions
): AIProviderConfig {
  return {
    id: options.id,
    kind: options.kind ?? "openai_compatible",
    displayName: options.displayName,
    baseUrl: options.baseUrl,
    apiKey: options.apiKey,
    apiKeyEnvVar: options.apiKeyEnvVar,
    defaultModel: options.defaultModel,
    fallbackModel: options.fallbackModel,
    fallbackModels: options.fallbackModels,
    compatibilityMode: "openai-compatible",
    headers: options.headers,
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
      ...uniqueModels([options.fallbackModel, ...(options.fallbackModels ?? [])])
        .filter((model) => model !== options.defaultModel)
        .map((model) => ({
          id: model,
          label: model,
          supportsStructuredJson: true,
        })),
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
      defaultModel: this.config.defaultModel,
      keySource: resolveProviderKeySource(this.config),
      compatibilityMode: this.config.compatibilityMode,
    }
  }

  async generateText(request: AIRequest): Promise<AIResponse> {
    let text: string | null = null
    let raw: unknown = null
    let model = request.model ?? this.config.defaultModel ?? "unknown"
    let lastError: unknown = null

    try {
      raw = await this.createChatCompletion(request)
      text = extractOpenAIText(raw)
    } catch (error) {
      lastError = error
    }

    const fallbackModels =
      this.config.kind === "openrouter"
        ? uniqueModels([this.config.fallbackModel, ...(this.config.fallbackModels ?? [])])
        : []
    if (!text && fallbackModels.length > 0) {
      for (const fallbackModel of fallbackModels) {
        if (!fallbackModel || fallbackModel === model) continue
        try {
          const fallbackJson = await this.createChatCompletion(request, fallbackModel)
          const fallbackText = extractOpenAIText(fallbackJson)
          if (fallbackText) {
            text = fallbackText
            raw = fallbackJson
            model = fallbackModel
            break
          }
        } catch (error) {
          lastError = error
        }
      }
    }

    if (!text) {
      if (lastError) throw normalizeProviderError(lastError, this.config.id)
      throw new AIProviderError("INVALID_JSON", "Provider response did not include message content.", {
        providerId: this.config.id,
      })
    }

    return {
      providerId: this.config.id,
      model,
      text: text.trim(),
      raw,
      usage: normalizeUsage(raw),
    }
  }

  async generateStructuredJson<T>(
    request: AIStructuredRequest<T>
  ): Promise<AIStructuredResponse<T>> {
    const response = await this.generateText({
      ...request,
      messages: [
        ...request.messages,
        {
          role: "system",
          content: `Return only valid JSON for schema ${request.json.schemaName}.`,
        },
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
    if (!this.config.baseUrl) missing.push("baseUrl")
    if (!this.config.defaultModel) missing.push("defaultModel")
    if (!resolveProviderApiKey(this.config)) missing.push("apiKey")

    if (missing.length > 0) {
      return {
        ok: false,
        message: `Missing OpenAI-compatible provider config: ${missing.join(", ")}.`,
      }
    }

    return {
      ok: true,
      message: "OpenAI-compatible provider config is valid.",
    }
  }

  normalizeError(error: unknown) {
    return normalizeProviderError(error, this.config.id)
  }

  private async createChatCompletion(request: AIRequest, modelOverride?: string): Promise<unknown> {
    const validation = await this.validateConnection()
    if (!validation.ok) {
      throw new AIProviderError("CONFIGURATION_ERROR", validation.message ?? "Invalid provider config.", {
        providerId: this.config.id,
      })
    }

    const key = resolveProviderApiKey(this.config)
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 60_000)

    try {
      const response = await fetch(`${this.config.baseUrl?.replace(/\/$/, "")}/chat/completions`, {
        method: "POST",
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${key}`,
          ...(this.config.headers ?? {}),
        },
        body: JSON.stringify({
          model: modelOverride ?? request.model ?? this.config.defaultModel,
          messages: request.messages,
          temperature: request.temperature ?? 0.7,
          max_tokens: request.maxOutputTokens ?? 2048,
          ...(this.config.kind === "openrouter"
            ? {
                include_reasoning: false,
                reasoning: { exclude: true },
              }
            : {}),
          ...(isStructuredJsonRequest(request) && this.config.kind !== "openrouter"
            ? {
                response_format: { type: "json_object" },
              }
            : {}),
        }),
      })

      const text = await response.text()
      let json: unknown
      try {
        json = text ? JSON.parse(text) : {}
      } catch (error) {
        throw new AIProviderError("INVALID_JSON", "Provider returned malformed JSON.", {
          providerId: this.config.id,
          status: response.status,
          cause: error,
        })
      }

      if (!response.ok) {
        throw normalizeProviderError(
          {
            status: response.status,
            message: extractProviderErrorMessage(json) ?? response.statusText,
          },
          this.config.id
        )
      }

      return json
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        throw new AIProviderError("PROVIDER_UNAVAILABLE", "Provider request timed out.", {
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

function uniqueModels(models: Array<string | undefined>) {
  return Array.from(new Set(models.filter((model): model is string => Boolean(model))))
}

function isStructuredJsonRequest(request: AIRequest): request is AIStructuredRequest<unknown> {
  return "json" in request
}

function extractOpenAIText(value: unknown): string | null {
  const choices = (value as { choices?: Array<{ text?: unknown; message?: { content?: unknown } }> })?.choices
  const choice = choices?.[0]
  const content = choice?.message?.content
  if (typeof content === "string") return content
  if (Array.isArray(content)) {
    const text = content
      .map((part) => {
        if (typeof part === "string") return part
        if (typeof part !== "object" || part === null) return ""
        const item = part as { text?: unknown; content?: unknown }
        if (typeof item.text === "string") return item.text
        if (typeof item.content === "string") return item.content
        return ""
      })
      .join("")
      .trim()
    return text || null
  }
  return typeof choice?.text === "string" ? choice.text : null
}

function normalizeUsage(value: unknown) {
  const usage = (value as { usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number } }).usage
  if (!usage) return undefined
  return {
    inputTokens: usage.prompt_tokens,
    outputTokens: usage.completion_tokens,
    totalTokens: usage.total_tokens,
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

  throw new AIProviderError("INVALID_JSON", "Provider response was not valid JSON.", {
    providerId,
  })
}

function extractProviderErrorMessage(value: unknown): string | null {
  const error = (value as { error?: { message?: unknown } })?.error
  return typeof error?.message === "string" ? error.message : null
}
