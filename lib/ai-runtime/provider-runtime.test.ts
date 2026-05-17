import { describe, expect, it } from "vitest"
import { AIProviderError, normalizeProviderError } from "@/lib/ai-runtime/provider-errors"
import { createProviderRegistry } from "@/lib/ai-runtime/provider-registry"
import { MockAIProvider } from "@/lib/ai-runtime/providers/mock-provider"
import {
  OpenAICompatibleProvider,
  createOpenAICompatibleConfig,
} from "@/lib/ai-runtime/providers/openai-compatible"

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
        apiKeyEnvVar: "LOCAL_AI_KEY",
      })
    )

    await expect(provider.validateConnection()).resolves.toEqual({
      ok: true,
      message: "OpenAI-compatible provider config is valid. Live calls are disabled.",
    })
    expect(provider.getMetadata()).toMatchObject({
      id: "local-compatible",
      kind: "openai_compatible",
      configured: false,
    })
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
