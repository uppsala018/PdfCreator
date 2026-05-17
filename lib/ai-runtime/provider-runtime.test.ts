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
import {
  buildUserAISettingsPatch,
  normalizeUserAISettings,
  publicAISettingsResponse,
} from "@/lib/ai-runtime/provider-settings"

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

  it("reads OpenAI-compatible array message content", async () => {
    const originalFetch = global.fetch
    global.fetch = async () =>
      new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: [{ type: "text", text: "array content" }],
              },
            },
          ],
        }),
        { status: 200 }
      )

    try {
      const provider = new OpenAICompatibleProvider(
        createOpenAICompatibleConfig({
          id: "array-compatible",
          displayName: "Array Compatible",
          baseUrl: "https://example.com/v1",
          defaultModel: "array-model",
          apiKey: "test-key",
        })
      )

      await expect(
        provider.generateText({ messages: [{ role: "user", content: "test" }] })
      ).resolves.toMatchObject({
        text: "array content",
      })
    } finally {
      global.fetch = originalFetch
    }
  })

  it("falls back to a stable OpenRouter model when the selected model returns empty content", async () => {
    const originalFetch = global.fetch
    const requestedModels: string[] = []
    global.fetch = async (_input, init) => {
      const body = JSON.parse(String(init?.body ?? "{}")) as { model?: string }
      requestedModels.push(body.model ?? "")
      if (requestedModels.length === 1) {
        return new Response(
          JSON.stringify({
            choices: [{ finish_reason: "length", message: { content: null } }],
          }),
          { status: 200 }
        )
      }
      return new Response(
        JSON.stringify({
          choices: [{ finish_reason: "stop", message: { content: "{\"ok\":true}" } }],
        }),
        { status: 200 }
      )
    }

    try {
      const provider = new OpenAICompatibleProvider(
        createOpenAICompatibleConfig({
          id: "openrouter",
          kind: "openrouter",
          displayName: "OpenRouter",
          baseUrl: "https://openrouter.ai/api/v1",
          defaultModel: "tencent/hy3-preview",
          fallbackModels: ["openai/gpt-4o-mini"],
          apiKey: "test-key",
        })
      )

      const result = await provider.generateStructuredJson<{ ok: true }>({
        messages: [{ role: "user", content: "Return JSON" }],
        json: {
          schemaName: "Ok",
          validate(value): value is { ok: true } {
            return typeof value === "object" && value !== null && (value as { ok?: unknown }).ok === true
          },
        },
      })

      expect(result.model).toBe("openai/gpt-4o-mini")
      expect(result.json).toEqual({ ok: true })
      expect(requestedModels).toEqual(["tencent/hy3-preview", "openai/gpt-4o-mini"])
    } finally {
      global.fetch = originalFetch
    }
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

  it("builds a canonical OpenRouter settings patch", () => {
    expect(
      buildUserAISettingsPatch("user-1", {
        ai_provider: "openrouter",
        openrouter_key: "  sk-or-user-key  ",
        openrouter_model: "  anthropic/claude-3.5-sonnet  ",
      })
    ).toEqual({
      user_id: "user-1",
      ai_provider: "openrouter",
      openrouter_key: "sk-or-user-key",
      openrouter_model: "anthropic/claude-3.5-sonnet",
    })
  })

  it("maps OpenRouter alias payloads into canonical settings columns", () => {
    expect(
      buildUserAISettingsPatch("user-1", {
        ai_default_provider: "openrouter",
        openrouter_api_key: "  sk-or-alias-key  ",
        openrouter_model: "  openai/gpt-4o-mini  ",
      })
    ).toEqual({
      user_id: "user-1",
      ai_provider: "openrouter",
      openrouter_key: "sk-or-alias-key",
      openrouter_model: "openai/gpt-4o-mini",
    })
  })

  it("loads masked OpenRouter key status without exposing the key", () => {
    const response = publicAISettingsResponse({
      ai_provider: "openrouter",
      openrouter_key: "sk-or-secret1234",
      openrouter_model: "anthropic/claude-3.5-sonnet",
    })

    expect(response).toMatchObject({
      ai_provider: "openrouter",
      openrouter_configured: true,
      openrouter_masked: "sk-or-s••••1234",
      openrouter_model: "anthropic/claude-3.5-sonnet",
      providerStatus: {
        activeProvider: "openrouter",
        activeProviderName: "OpenRouter",
        activeModel: "anthropic/claude-3.5-sonnet",
        keySource: "user",
      },
    })
    expect(JSON.stringify(response)).not.toContain("sk-or-secret1234")
  })

  it("normalizes compatible OpenRouter alias fields", () => {
    expect(
      normalizeUserAISettings({
        ai_default_provider: "openrouter",
        openrouter_api_key: "alias-key",
        openrouter_model: "openai/gpt-4o-mini",
      })
    ).toMatchObject({
      ai_provider: "openrouter",
      openrouter_key: "alias-key",
      openrouter_model: "openai/gpt-4o-mini",
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

  it("resolves OpenRouter with a user key before env fallback", () => {
    const resolved = resolveAIProvider({
      userSettings: {
        ai_provider: "openrouter",
        openrouter_key: "user-openrouter",
        openrouter_model: "openai/gpt-4o-mini",
      },
      secrets: secrets({
        OPENROUTER_API_KEY: "env-openrouter",
        OPENROUTER_MODEL: "anthropic/claude-3.5-sonnet",
      }),
    })

    expect(resolved.status).toMatchObject({
      activeProvider: "openrouter",
      activeModel: "openai/gpt-4o-mini",
      keySource: "user",
      debug: {
        selectedProvider: "openrouter",
        selectedModel: "openai/gpt-4o-mini",
        hasUserOpenRouterKey: true,
        hasEnvOpenRouterKey: true,
        finalResolvedProvider: "openrouter",
        finalResolvedModel: "openai/gpt-4o-mini",
        keySource: "user",
      },
    })
  })

  it("resolves OpenRouter from env when no user key is configured", () => {
    const resolved = resolveAIProvider({
      userSettings: {
        ai_provider: "openrouter",
        openrouter_model: "openai/gpt-4o-mini",
      },
      secrets: secrets({
        OPENROUTER_API_KEY: "env-openrouter",
        OPENROUTER_MODEL: "anthropic/claude-3.5-sonnet",
      }),
    })

    expect(resolved.status).toMatchObject({
      activeProvider: "openrouter",
      activeModel: "openai/gpt-4o-mini",
      keySource: "env",
      debug: {
        hasUserOpenRouterKey: false,
        hasEnvOpenRouterKey: true,
        finalResolvedProvider: "openrouter",
        keySource: "env",
      },
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

  it("does not let stale mock request preference override configured settings", () => {
    const resolved = resolveAIProvider({
      preferredProviderId: "mock",
      userSettings: {
        ai_provider: "openrouter",
        openrouter_key: "user-openrouter",
        openrouter_model: "openai/gpt-4o-mini",
      },
      secrets: secrets({}),
    })

    expect(resolved.status).toMatchObject({
      activeProvider: "openrouter",
      activeModel: "openai/gpt-4o-mini",
      keySource: "user",
    })
  })

  it("uses settings provider when request provider is not specified", () => {
    const resolved = resolveAIProvider({
      preferredProviderId: "",
      userSettings: {
        ai_provider: "openrouter",
        openrouter_key: "user-openrouter",
        openrouter_model: "openai/gpt-4o-mini",
      },
      secrets: secrets({}),
    })

    expect(resolved.status.activeProvider).toBe("openrouter")
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
