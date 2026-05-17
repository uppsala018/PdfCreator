import { describe, expect, it } from "vitest"
import { AIProviderError, normalizeProviderError } from "@/lib/ai-runtime/provider-errors"
import { createProviderRegistry } from "@/lib/ai-runtime/provider-registry"
import { MockAIProvider } from "@/lib/ai-runtime/providers/mock-provider"
import {
  OpenAICompatibleProvider,
  createOpenAICompatibleConfig,
} from "@/lib/ai-runtime/providers/openai-compatible"
import {
  publicProviderStatus,
  resolveAIProvider,
  type UserAISettings,
} from "@/lib/ai-runtime/provider-resolution"

function secrets(values: Record<string, string | undefined>) {
  return {
    get(name: string) {
      return values[name]
    },
  }
}

describe("AI provider runtime", () => {
  it("registers and resolves providers", () => {
    const mock = new MockAIProvider({ id: "mock-test" })
    const registry = createProviderRegistry([mock])

    expect(registry.has("mock-test")).toBe(true)
    expect(registry.resolve("mock-test")).toBe(mock)
    expect(registry.metadata("mock-test")).toMatchObject({
      id: "mock-test",
      kind: "mock",
      configured: true,
    })
  })

  it("throws a normalized error for missing providers", () => {
    const registry = createProviderRegistry()

    expect(() => registry.resolve("missing")).toThrow(AIProviderError)
    expect(() => registry.resolve("missing")).toThrow('AI provider "missing" is not registered.')
  })

  it("returns deterministic mock text responses", async () => {
    const provider = new MockAIProvider({ text: "deterministic response" })

    await expect(
      provider.generateText({
        messages: [{ role: "user", content: "Create an ebook outline." }],
      })
    ).resolves.toMatchObject({
      providerId: "mock",
      model: "mock-model",
      text: "deterministic response",
    })
  })

  it("returns deterministic mock structured JSON responses", async () => {
    const provider = new MockAIProvider({
      structuredJson: { title: "Mock Ebook", chapters: 3 },
    })

    const response = await provider.generateStructuredJson<{
      title: string
      chapters: number
    }>({
      messages: [{ role: "user", content: "Create JSON." }],
      json: {
        schemaName: "MockSchema",
        validate(value): value is { title: string; chapters: number } {
          return (
            typeof value === "object" &&
            value !== null &&
            typeof (value as { title?: unknown }).title === "string" &&
            typeof (value as { chapters?: unknown }).chapters === "number"
          )
        },
      },
    })

    expect(response.json).toEqual({ title: "Mock Ebook", chapters: 3 })
    expect(response.validation).toEqual({
      schemaName: "MockSchema",
      valid: true,
      repaired: false,
      errors: [],
    })
  })

  it("validates OpenAI-compatible provider configuration without live calls", async () => {
    const provider = new OpenAICompatibleProvider(
      createOpenAICompatibleConfig({
        id: "local-compatible",
        displayName: "Local Compatible",
        baseUrl: "http://localhost:11434/v1",
        defaultModel: "local-model",
        apiKey: "local-key",
      })
    )

    await expect(provider.validateConnection()).resolves.toEqual({
      ok: true,
      message: "OpenAI-compatible provider config is valid.",
    })
    expect(provider.getMetadata()).toMatchObject({
      id: "local-compatible",
      kind: "openai_compatible",
      configured: true,
    })
  })

  it("resolves env configured providers before mock", () => {
    const resolved = resolveAIProvider({
      secrets: secrets({
        AI_PROVIDER: "openrouter",
        OPENROUTER_API_KEY: "env-openrouter",
        OPENROUTER_MODEL: "anthropic/claude-3.5-sonnet",
      }),
    })

    expect(resolved.status).toMatchObject({
      activeProvider: "openrouter",
      activeModel: "anthropic/claude-3.5-sonnet",
      keySource: "env",
    })
  })

  it("resolves user settings provider before env providers", () => {
    const userSettings: UserAISettings = {
      ai_provider: "mistral",
      mistral_key: "user-mistral",
      mistral_model: "mistral-large-latest",
    }
    const resolved = resolveAIProvider({
      userSettings,
      secrets: secrets({ OPENAI_API_KEY: "env-openai", OPENAI_MODEL: "gpt-4o" }),
    })

    expect(resolved.status).toMatchObject({
      activeProvider: "mistral",
      activeModel: "mistral-large-latest",
      keySource: "user",
    })
  })

  it("falls back to env when selected user settings are missing a key", () => {
    const resolved = resolveAIProvider({
      userSettings: { ai_provider: "anthropic", anthropic_model: "claude-missing-key" },
      secrets: secrets({ OPENAI_API_KEY: "env-openai", OPENAI_MODEL: "gpt-4o-mini" }),
    })

    expect(resolved.status).toMatchObject({
      activeProvider: "openai",
      activeModel: "gpt-4o-mini",
      keySource: "env",
    })
  })

  it("falls back to mock when no provider is configured", () => {
    const resolved = resolveAIProvider({ secrets: secrets({}) })

    expect(resolved.status).toMatchObject({
      activeProvider: "mock",
      activeModel: "mock-model",
      keySource: "mock",
    })
  })

  it("validates custom provider config", async () => {
    const missingBaseUrl = resolveAIProvider({
      userSettings: {
        ai_provider: "custom",
        custom_api_key: "custom-key",
        custom_model: "custom-model",
        custom_compatibility: "openai-compatible",
      },
      secrets: secrets({}),
    })

    expect(missingBaseUrl.status.activeProvider).toBe("mock")

    const configured = resolveAIProvider({
      userSettings: {
        ai_provider: "custom",
        custom_api_key: "custom-key",
        custom_base_url: "http://localhost:11434/v1",
        custom_model: "custom-model",
        custom_compatibility: "openai-compatible",
      },
      secrets: secrets({}),
    })

    await expect(configured.provider.validateConnection()).resolves.toMatchObject({ ok: true })
    expect(configured.status).toMatchObject({
      activeProvider: "custom",
      activeModel: "custom-model",
      keySource: "user",
    })
  })

  it("does not return secrets in public provider status", () => {
    const status = publicProviderStatus(
      { ai_provider: "openai", openai_key: "user-secret", openai_model: "gpt-4o" },
      secrets({ ANTHROPIC_API_KEY: "env-secret" })
    )

    expect(JSON.stringify(status)).not.toContain("user-secret")
    expect(JSON.stringify(status)).not.toContain("env-secret")
    expect(
      status.configuredProviders.every((provider) => !("apiKey" in provider) && !("apiKeyEnvVar" in provider))
    ).toBe(true)
  })

  it("normalizes provider errors by status", () => {
    expect(normalizeProviderError({ status: 401, message: "Bad key" }, "provider-a")).toMatchObject({
      code: "AUTHENTICATION_ERROR",
      providerId: "provider-a",
      retryable: false,
    })

    expect(normalizeProviderError({ status: 429, message: "Slow down" }, "provider-a")).toMatchObject({
      code: "RATE_LIMITED",
      providerId: "provider-a",
      retryable: true,
    })

    expect(normalizeProviderError({ status: 503, message: "Unavailable" }, "provider-a")).toMatchObject({
      code: "PROVIDER_UNAVAILABLE",
      providerId: "provider-a",
      retryable: true,
    })
  })
})
