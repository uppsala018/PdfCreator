import type { AIProviderConfig } from "@/lib/ai-runtime/provider-types"

export interface ServerSecretSource {
  get(name: string): string | undefined
}

export const processEnvSecretSource: ServerSecretSource = {
  get(name: string) {
    return process.env[name]
  },
}

export function resolveProviderApiKey(
  config: AIProviderConfig,
  secrets: ServerSecretSource = processEnvSecretSource
) {
  if (config.apiKey) return config.apiKey
  if (!config.apiKeyEnvVar) return undefined
  return secrets.get(config.apiKeyEnvVar)
}

export function resolveProviderKeySource(
  config: AIProviderConfig,
  secrets: ServerSecretSource = processEnvSecretSource
): "user" | "env" | "mock" | "none" {
  if (config.kind === "mock") return "mock"
  if (config.apiKey) return "user"
  if (config.apiKeyEnvVar && secrets.get(config.apiKeyEnvVar)) return "env"
  return "none"
}

export function isProviderConfigured(
  config: AIProviderConfig,
  secrets: ServerSecretSource = processEnvSecretSource
) {
  return Boolean(resolveProviderApiKey(config, secrets)) || config.kind === "mock"
}

export function publicProviderConfig(config: AIProviderConfig) {
  return {
    id: config.id,
    kind: config.kind,
    displayName: config.displayName,
    baseUrl: config.baseUrl,
    defaultModel: config.defaultModel,
    fallbackModel: config.fallbackModel,
    fallbackModels: config.fallbackModels,
    fallbackProviderId: config.fallbackProviderId,
    models: config.models ?? [],
    capabilities: config.capabilities,
    configured: isProviderConfigured(config),
    keySource: resolveProviderKeySource(config),
    compatibilityMode: config.compatibilityMode,
  }
}

export function assertServerSideProviderConfig(config: AIProviderConfig) {
  if (typeof window !== "undefined" && (config.apiKey || config.apiKeyEnvVar)) {
    throw new Error("AI provider secrets must only be resolved server-side.")
  }
}
