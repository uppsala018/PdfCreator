import type { AIProviderAdapter } from "@/lib/ai-runtime/provider-interface"
import {
  resolveProviderApiKey,
  resolveProviderKeySource,
  type ServerSecretSource,
  processEnvSecretSource,
} from "@/lib/ai-runtime/provider-config"
import { createProviderRegistry } from "@/lib/ai-runtime/provider-registry"
import type { AICompatibilityMode, AIProviderConfig, AIProviderMetadata } from "@/lib/ai-runtime/provider-types"
import { AnthropicProvider, createAnthropicConfig } from "@/lib/ai-runtime/providers/anthropic-provider"
import { MockAIProvider } from "@/lib/ai-runtime/providers/mock-provider"
import {
  OpenAICompatibleProvider,
  createOpenAICompatibleConfig,
} from "@/lib/ai-runtime/providers/openai-compatible"

export type BuiltInAIProviderId =
  | "openai"
  | "anthropic"
  | "openrouter"
  | "gemini"
  | "mistral"
  | "custom"
  | "mock"

export interface UserAISettings {
  ai_provider?: string | null
  anthropic_key?: string | null
  anthropic_model?: string | null
  openai_key?: string | null
  openai_model?: string | null
  openrouter_key?: string | null
  openrouter_model?: string | null
  gemini_key?: string | null
  gemini_model?: string | null
  mistral_key?: string | null
  mistral_model?: string | null
  custom_provider_name?: string | null
  custom_api_key?: string | null
  custom_base_url?: string | null
  custom_model?: string | null
  custom_compatibility?: AICompatibilityMode | null
}

export interface ActiveProviderStatus {
  activeProvider: string
  activeProviderName: string
  activeModel: string
  keySource: "user" | "env" | "mock"
  compatibilityMode?: AICompatibilityMode
  configuredProviders: AIProviderMetadata[]
  debug: ActiveProviderDebug
}

export interface ActiveProviderDebug {
  selectedProvider: string | null
  selectedModel: string | null
  hasUserOpenRouterKey: boolean
  hasEnvOpenRouterKey: boolean
  finalResolvedProvider: string
  finalResolvedModel: string
  keySource: "user" | "env" | "mock"
}

export interface ResolvedAIProvider {
  provider: AIProviderAdapter
  status: ActiveProviderStatus
  registry: ReturnType<typeof createProviderRegistry>
}

const DEFAULT_MODELS: Record<Exclude<BuiltInAIProviderId, "custom" | "mock">, string> = {
  openai: "gpt-4o-mini",
  anthropic: "claude-haiku-4-5-20251001",
  openrouter: "nvidia/nemotron-3-super-120b-a12b:free",
  gemini: "gemini-3.1-flash-lite",
  mistral: "mistral-small-latest",
}

const OPENROUTER_FALLBACK_MODELS = [
  "nvidia/nemotron-3-super-120b-a12b:free",
  "openai/gpt-oss-120b:free",
  "minimax/minimax-m2.5:free",
  "openrouter/free",
  "openai/gpt-4o-mini",
]

const GEMINI_FALLBACK_MODELS = [
  "gemini-3.1-flash-lite",
  "gemini-3-flash-preview",
  "gemini-3.1-pro-preview",
]

const ENV_PROVIDER_ORDER: BuiltInAIProviderId[] = [
  "anthropic",
  "openai",
  "openrouter",
  "gemini",
  "mistral",
  "custom",
]

export function resolveAIProvider(options: {
  userSettings?: UserAISettings | null
  preferredProviderId?: string | null
  model?: string | null
  secrets?: ServerSecretSource
} = {}): ResolvedAIProvider {
  const secrets = options.secrets ?? processEnvSecretSource
  const providers = buildProviders(options.userSettings, secrets)
  const registry = createProviderRegistry(providers)
  const selected = normalizePreferredProviderId(options.preferredProviderId) ?? normalizeProviderId(options.userSettings?.ai_provider)
  const defaultProvider = normalizeProviderId(secrets.get("AI_PROVIDER") || secrets.get("AI_DEFAULT_PROVIDER"))
  const candidates = uniqueIds([
    selected,
    defaultProvider,
    ...ENV_PROVIDER_ORDER,
    "mock",
  ])

  const provider =
    candidates
      .map((id) => (id && registry.has(id) ? registry.resolve(id) : null))
      .find((candidate) => candidate && isUsable(candidate.config, secrets)) ?? registry.resolve("mock")

  const config = provider.config
  const keySource = resolveProviderKeySource(config, secrets)
  const publicKeySource = keySource === "none" ? "mock" : keySource
  const activeModel = options.model || config.defaultModel || "unknown"
  return {
    provider,
    registry,
    status: {
      activeProvider: config.id,
      activeProviderName: config.displayName,
      activeModel,
      keySource: publicKeySource,
      compatibilityMode: config.compatibilityMode,
      configuredProviders: providers.map((candidate) => candidate.getMetadata()),
      debug: {
        selectedProvider: selected,
        selectedModel: selected ? modelForProvider(selected, options.userSettings, secrets) : null,
        hasUserOpenRouterKey: Boolean(clean(options.userSettings?.openrouter_key)),
        hasEnvOpenRouterKey: Boolean(secrets.get("OPENROUTER_API_KEY")),
        finalResolvedProvider: config.id,
        finalResolvedModel: activeModel,
        keySource: publicKeySource,
      },
    },
  }
}

export function buildProviders(
  userSettings: UserAISettings | null | undefined,
  secrets: ServerSecretSource = processEnvSecretSource
): AIProviderAdapter[] {
  return [
    new AnthropicProvider(
      createAnthropicConfig({
        apiKey: clean(userSettings?.anthropic_key),
        apiKeyEnvVar: "ANTHROPIC_API_KEY",
        defaultModel: firstValue(userSettings?.anthropic_model, secrets.get("ANTHROPIC_MODEL"), DEFAULT_MODELS.anthropic),
      })
    ),
    new OpenAICompatibleProvider(
      createOpenAICompatibleConfig({
        id: "openai",
        kind: "openai",
        displayName: "OpenAI",
        baseUrl: "https://api.openai.com/v1",
        apiKey: clean(userSettings?.openai_key),
        apiKeyEnvVar: "OPENAI_API_KEY",
        defaultModel: firstValue(userSettings?.openai_model, secrets.get("OPENAI_MODEL"), DEFAULT_MODELS.openai),
      })
    ),
    new OpenAICompatibleProvider(
      createOpenAICompatibleConfig({
        id: "openrouter",
        kind: "openrouter",
        displayName: "OpenRouter",
        baseUrl: "https://openrouter.ai/api/v1",
        apiKey: clean(userSettings?.openrouter_key),
        apiKeyEnvVar: "OPENROUTER_API_KEY",
        defaultModel: firstValue(userSettings?.openrouter_model, secrets.get("OPENROUTER_MODEL"), DEFAULT_MODELS.openrouter),
        fallbackModel: firstValue(secrets.get("OPENROUTER_FALLBACK_MODEL")),
        fallbackModels: OPENROUTER_FALLBACK_MODELS,
      })
    ),
    new OpenAICompatibleProvider(
      createOpenAICompatibleConfig({
        id: "gemini",
        kind: "gemini",
        displayName: "Google Gemini",
        baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
        apiKey: clean(userSettings?.gemini_key),
        apiKeyEnvVar: "GEMINI_API_KEY",
        defaultModel: firstModelValue(userSettings?.gemini_model, secrets.get("GEMINI_MODEL"), DEFAULT_MODELS.gemini),
        fallbackModels: modelList(userSettings?.gemini_model, secrets.get("GEMINI_MODEL"), GEMINI_FALLBACK_MODELS),
      })
    ),
    new OpenAICompatibleProvider(
      createOpenAICompatibleConfig({
        id: "mistral",
        kind: "mistral",
        displayName: "Mistral",
        baseUrl: "https://api.mistral.ai/v1",
        apiKey: clean(userSettings?.mistral_key),
        apiKeyEnvVar: "MISTRAL_API_KEY",
        defaultModel: firstValue(userSettings?.mistral_model, secrets.get("MISTRAL_MODEL"), DEFAULT_MODELS.mistral),
      })
    ),
    createCustomProvider(userSettings, secrets),
    new MockAIProvider(),
  ].filter((provider): provider is AIProviderAdapter => Boolean(provider))
}

export function publicProviderStatus(
  settings: UserAISettings | null | undefined,
  secrets: ServerSecretSource = processEnvSecretSource
) {
  const resolved = resolveAIProvider({ userSettings: settings, secrets })
  return resolved.status
}

function createCustomProvider(
  userSettings: UserAISettings | null | undefined,
  secrets: ServerSecretSource
): AIProviderAdapter | null {
  const mode = userSettings?.custom_compatibility ?? "openai-compatible"
  const baseUrl = firstValue(userSettings?.custom_base_url, secrets.get("CUSTOM_AI_BASE_URL"))
  const model = firstValue(userSettings?.custom_model, secrets.get("CUSTOM_AI_MODEL"))
  const displayName = firstValue(userSettings?.custom_provider_name, "Other / Custom")
  const apiKey = clean(userSettings?.custom_api_key)

  if (mode !== "openai-compatible") {
    return new OpenAICompatibleProvider({
      id: "custom",
      kind: "custom",
      displayName,
      baseUrl,
      apiKey,
      apiKeyEnvVar: "CUSTOM_AI_API_KEY",
      defaultModel: model,
      compatibilityMode: mode,
      capabilities: {
        textGeneration: false,
        structuredJson: false,
        nativeJsonMode: false,
        toolCalls: false,
        vision: false,
        streaming: false,
      },
      models: model ? [{ id: model, label: model }] : [],
    })
  }

  return new OpenAICompatibleProvider(
    createOpenAICompatibleConfig({
      id: "custom",
      kind: "custom",
      displayName,
      baseUrl,
      apiKey,
      apiKeyEnvVar: "CUSTOM_AI_API_KEY",
      defaultModel: model,
    })
  )
}

function isUsable(config: AIProviderConfig, secrets: ServerSecretSource) {
  if (config.kind === "mock") return true
  if (!config.defaultModel) return false
  if (config.kind === "custom" && !config.baseUrl) return false
  if (config.compatibilityMode === "raw-custom") return false
  if (config.compatibilityMode === "anthropic-compatible" && config.kind === "custom") return false
  return Boolean(resolveProviderApiKey(config, secrets))
}

function clean(value: string | null | undefined) {
  const trimmed = value?.trim()
  return trimmed || undefined
}

function firstValue(...values: Array<string | null | undefined>) {
  for (const value of values) {
    const trimmed = value?.trim()
    if (trimmed) return trimmed
  }
  return ""
}

function firstModelValue(...values: Array<string | null | undefined>) {
  for (const value of values) {
    const first = modelList(value)[0]
    if (first) return first
  }
  return ""
}

function modelList(...values: Array<string | null | undefined | string[]>) {
  return Array.from(new Set(values.flatMap((value) => {
    if (Array.isArray(value)) return value
    return (value ?? "").split(",")
  }).map((value) => value.trim()).filter(Boolean)))
}

function normalizeProviderId(value: string | null | undefined): BuiltInAIProviderId | null {
  const id = value?.trim().toLowerCase()
  if (
    id === "openai" ||
    id === "anthropic" ||
    id === "openrouter" ||
    id === "gemini" ||
    id === "mistral" ||
    id === "custom" ||
    id === "mock"
  ) {
    return id
  }
  return null
}

function normalizePreferredProviderId(value: string | null | undefined): BuiltInAIProviderId | null {
  const providerId = normalizeProviderId(value)
  return providerId === "mock" ? null : providerId
}

function uniqueIds(values: Array<BuiltInAIProviderId | null | undefined>) {
  return Array.from(new Set(values.filter((value): value is BuiltInAIProviderId => Boolean(value))))
}

function modelForProvider(
  providerId: BuiltInAIProviderId,
  userSettings: UserAISettings | null | undefined,
  secrets: ServerSecretSource
) {
  switch (providerId) {
    case "anthropic":
      return firstValue(userSettings?.anthropic_model, secrets.get("ANTHROPIC_MODEL"), DEFAULT_MODELS.anthropic)
    case "openai":
      return firstValue(userSettings?.openai_model, secrets.get("OPENAI_MODEL"), DEFAULT_MODELS.openai)
    case "openrouter":
      return firstValue(userSettings?.openrouter_model, secrets.get("OPENROUTER_MODEL"), DEFAULT_MODELS.openrouter)
    case "gemini":
      return firstModelValue(userSettings?.gemini_model, secrets.get("GEMINI_MODEL"), DEFAULT_MODELS.gemini)
    case "mistral":
      return firstValue(userSettings?.mistral_model, secrets.get("MISTRAL_MODEL"), DEFAULT_MODELS.mistral)
    case "custom":
      return firstValue(userSettings?.custom_model, secrets.get("CUSTOM_AI_MODEL"))
    case "mock":
      return "mock-model"
  }
}
