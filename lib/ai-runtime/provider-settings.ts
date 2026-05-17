import type { AICompatibilityMode } from "@/lib/ai-runtime/provider-types"
import type { TablesInsert } from "@/lib/supabase/database.types"
import {
  publicProviderStatus,
  type ActiveProviderStatus,
  type UserAISettings,
} from "@/lib/ai-runtime/provider-resolution"

const CANONICAL_PROVIDER_FIELDS = {
  ai_provider: ["ai_provider", "ai_default_provider"],
  anthropic_key: ["anthropic_key"],
  anthropic_model: ["anthropic_model", "ai_default_model"],
  openai_key: ["openai_key"],
  openai_model: ["openai_model", "ai_default_model"],
  openrouter_key: ["openrouter_key", "openrouter_api_key"],
  openrouter_model: ["openrouter_model", "ai_default_model"],
  gemini_key: ["gemini_key", "gemini_api_key"],
  gemini_model: ["gemini_model", "ai_default_model"],
  mistral_key: ["mistral_key", "mistral_api_key"],
  mistral_model: ["mistral_model", "ai_default_model"],
  custom_provider_name: ["custom_provider_name"],
  custom_api_key: ["custom_api_key", "custom_ai_key"],
  custom_base_url: ["custom_base_url", "custom_ai_base_url"],
  custom_model: ["custom_model", "custom_ai_model"],
  custom_compatibility: ["custom_compatibility"],
} as const

export const USER_AI_SETTINGS_COLUMNS = [
  "ai_provider",
  "anthropic_key",
  "anthropic_model",
  "openai_key",
  "openai_model",
  "openrouter_key",
  "openrouter_model",
  "gemini_key",
  "gemini_model",
  "mistral_key",
  "mistral_model",
  "custom_provider_name",
  "custom_api_key",
  "custom_base_url",
  "custom_model",
  "custom_compatibility",
].join(", ")

export interface PublicAISettingsState {
  ai_provider: string | null
  anthropic_configured: boolean
  openai_configured: boolean
  openrouter_configured: boolean
  gemini_configured: boolean
  mistral_configured: boolean
  custom_configured: boolean
  anthropic_masked: string | null
  openai_masked: string | null
  openrouter_masked: string | null
  gemini_masked: string | null
  mistral_masked: string | null
  custom_masked: string | null
  anthropic_model: string
  openai_model: string
  openrouter_model: string
  gemini_model: string
  mistral_model: string
  custom_provider_name: string
  custom_base_url: string
  custom_model: string
  custom_compatibility: AICompatibilityMode
  providerStatus: ActiveProviderStatus
}

export type UserAISettingsPatch = Pick<
  TablesInsert<"user_settings">,
  | "user_id"
  | "ai_provider"
  | "anthropic_key"
  | "anthropic_model"
  | "openai_key"
  | "openai_model"
  | "openrouter_key"
  | "openrouter_model"
  | "gemini_key"
  | "gemini_model"
  | "mistral_key"
  | "mistral_model"
  | "custom_provider_name"
  | "custom_api_key"
  | "custom_base_url"
  | "custom_model"
  | "custom_compatibility"
>

export function normalizeUserAISettings(value: unknown): UserAISettings {
  const row = typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {}
  return {
    ai_provider: firstString(row, CANONICAL_PROVIDER_FIELDS.ai_provider),
    anthropic_key: firstString(row, CANONICAL_PROVIDER_FIELDS.anthropic_key),
    anthropic_model: firstString(row, CANONICAL_PROVIDER_FIELDS.anthropic_model),
    openai_key: firstString(row, CANONICAL_PROVIDER_FIELDS.openai_key),
    openai_model: firstString(row, CANONICAL_PROVIDER_FIELDS.openai_model),
    openrouter_key: firstString(row, CANONICAL_PROVIDER_FIELDS.openrouter_key),
    openrouter_model: firstString(row, CANONICAL_PROVIDER_FIELDS.openrouter_model),
    gemini_key: firstString(row, CANONICAL_PROVIDER_FIELDS.gemini_key),
    gemini_model: firstString(row, CANONICAL_PROVIDER_FIELDS.gemini_model),
    mistral_key: firstString(row, CANONICAL_PROVIDER_FIELDS.mistral_key),
    mistral_model: firstString(row, CANONICAL_PROVIDER_FIELDS.mistral_model),
    custom_provider_name: firstString(row, CANONICAL_PROVIDER_FIELDS.custom_provider_name),
    custom_api_key: firstString(row, CANONICAL_PROVIDER_FIELDS.custom_api_key),
    custom_base_url: firstString(row, CANONICAL_PROVIDER_FIELDS.custom_base_url),
    custom_model: firstString(row, CANONICAL_PROVIDER_FIELDS.custom_model),
    custom_compatibility: compatibilityValue(firstRaw(row, CANONICAL_PROVIDER_FIELDS.custom_compatibility)),
  }
}

export function publicAISettingsResponse(value: unknown): PublicAISettingsState {
  const settings = normalizeUserAISettings(value)
  return {
    ai_provider: settings.ai_provider ?? null,
    anthropic_configured: Boolean(settings.anthropic_key),
    openai_configured: Boolean(settings.openai_key),
    openrouter_configured: Boolean(settings.openrouter_key),
    gemini_configured: Boolean(settings.gemini_key),
    mistral_configured: Boolean(settings.mistral_key),
    custom_configured: Boolean(settings.custom_api_key),
    anthropic_masked: maskKey(settings.anthropic_key),
    openai_masked: maskKey(settings.openai_key),
    openrouter_masked: maskKey(settings.openrouter_key),
    gemini_masked: maskKey(settings.gemini_key),
    mistral_masked: maskKey(settings.mistral_key),
    custom_masked: maskKey(settings.custom_api_key),
    anthropic_model: settings.anthropic_model ?? "",
    openai_model: settings.openai_model ?? "",
    openrouter_model: settings.openrouter_model ?? "",
    gemini_model: settings.gemini_model ?? "",
    mistral_model: settings.mistral_model ?? "",
    custom_provider_name: settings.custom_provider_name ?? "",
    custom_base_url: settings.custom_base_url ?? "",
    custom_model: settings.custom_model ?? "",
    custom_compatibility: settings.custom_compatibility ?? "openai-compatible",
    providerStatus: publicProviderStatus(settings),
  }
}

export function buildUserAISettingsPatch(userId: string, body: unknown) {
  const data = typeof body === "object" && body !== null ? (body as Record<string, unknown>) : {}
  const patch: UserAISettingsPatch = { user_id: userId }
  const fields: Array<keyof UserAISettingsPatch> = [
    "ai_provider",
    "anthropic_key",
    "anthropic_model",
    "openai_key",
    "openai_model",
    "openrouter_key",
    "openrouter_model",
    "gemini_key",
    "gemini_model",
    "mistral_key",
    "mistral_model",
    "custom_provider_name",
    "custom_api_key",
    "custom_base_url",
    "custom_model",
    "custom_compatibility",
  ]

  for (const field of fields) {
    assignCanonicalString(patch, data, field)
  }

  return patch
}

function maskKey(key: string | null | undefined): string | null {
  if (!key || key.length < 8) return null
  return `${key.slice(0, 7)}••••${key.slice(-4)}`
}

function assignCanonicalString(
  patch: UserAISettingsPatch,
  data: Record<string, unknown>,
  key: keyof UserAISettingsPatch
) {
  if (key === "user_id") return
  const aliases = CANONICAL_PROVIDER_FIELDS[key as keyof typeof CANONICAL_PROVIDER_FIELDS] ?? [key]
  for (const alias of aliases) {
    if (typeof data[alias] === "string") {
      patch[key] = data[alias].trim() || null
      return
    }
  }
}

function stringValue(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null
}

function firstString(row: Record<string, unknown>, keys: readonly string[]) {
  return stringValue(firstRaw(row, keys))
}

function firstRaw(row: Record<string, unknown>, keys: readonly string[]) {
  for (const key of keys) {
    const value = row[key]
    if (typeof value === "string" && value.trim()) return value
  }
  return null
}

function compatibilityValue(value: unknown): AICompatibilityMode | null {
  if (
    value === "openai-compatible" ||
    value === "anthropic-compatible" ||
    value === "raw-custom"
  ) {
    return value
  }
  return null
}
