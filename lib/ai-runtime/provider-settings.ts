import type { AICompatibilityMode } from "@/lib/ai-runtime/provider-types"
import type { TablesInsert } from "@/lib/supabase/database.types"
import {
  publicProviderStatus,
  type ActiveProviderStatus,
  type UserAISettings,
} from "@/lib/ai-runtime/provider-resolution"

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
    ai_provider: stringValue(row.ai_provider) ?? stringValue(row.ai_default_provider),
    anthropic_key: stringValue(row.anthropic_key),
    anthropic_model: stringValue(row.anthropic_model) ?? stringValue(row.ai_default_model),
    openai_key: stringValue(row.openai_key),
    openai_model: stringValue(row.openai_model) ?? stringValue(row.ai_default_model),
    openrouter_key: stringValue(row.openrouter_key) ?? stringValue(row.openrouter_api_key),
    openrouter_model: stringValue(row.openrouter_model) ?? stringValue(row.ai_default_model),
    gemini_key: stringValue(row.gemini_key) ?? stringValue(row.gemini_api_key),
    gemini_model: stringValue(row.gemini_model) ?? stringValue(row.ai_default_model),
    mistral_key: stringValue(row.mistral_key) ?? stringValue(row.mistral_api_key),
    mistral_model: stringValue(row.mistral_model) ?? stringValue(row.ai_default_model),
    custom_provider_name: stringValue(row.custom_provider_name),
    custom_api_key: stringValue(row.custom_api_key) ?? stringValue(row.custom_ai_key),
    custom_base_url: stringValue(row.custom_base_url) ?? stringValue(row.custom_ai_base_url),
    custom_model: stringValue(row.custom_model) ?? stringValue(row.custom_ai_model),
    custom_compatibility: compatibilityValue(row.custom_compatibility),
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
    assignString(patch, data, field)
  }

  return patch
}

function maskKey(key: string | null | undefined): string | null {
  if (!key || key.length < 8) return null
  return `${key.slice(0, 7)}••••${key.slice(-4)}`
}

function assignString(
  patch: UserAISettingsPatch,
  data: Record<string, unknown>,
  key: keyof UserAISettingsPatch
) {
  if (key !== "user_id" && typeof data[key] === "string") {
    patch[key] = data[key].trim() || null
  }
}

function stringValue(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null
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
