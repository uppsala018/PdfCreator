import type { Metadata } from "next"
import { createClient } from "@/lib/supabase/server"
import { publicProviderStatus, type UserAISettings } from "@/lib/ai-runtime/provider-resolution"
import SettingsClient from "./SettingsClient"

export const metadata: Metadata = { title: "Settings" }

export default async function SettingsPage() {
  const supabase = createClient()

  const { data: settings } = await supabase
    .from("user_settings")
    .select([
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
    ].join(", "))
    .maybeSingle()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const aiSettings = settings as UserAISettings | null

  return (
    <SettingsClient
      userEmail={user?.email ?? ""}
      initialState={{
        ai_provider: aiSettings?.ai_provider ?? null,
        anthropic_configured: Boolean(aiSettings?.anthropic_key),
        openai_configured: Boolean(aiSettings?.openai_key),
        openrouter_configured: Boolean(aiSettings?.openrouter_key),
        gemini_configured: Boolean(aiSettings?.gemini_key),
        mistral_configured: Boolean(aiSettings?.mistral_key),
        custom_configured: Boolean(aiSettings?.custom_api_key),
        anthropic_masked: aiSettings?.anthropic_key
          ? `${aiSettings.anthropic_key.slice(0, 7)}••••${aiSettings.anthropic_key.slice(-4)}`
          : null,
        openai_masked: aiSettings?.openai_key
          ? `${aiSettings.openai_key.slice(0, 7)}••••${aiSettings.openai_key.slice(-4)}`
          : null,
        openrouter_masked: aiSettings?.openrouter_key ? `${aiSettings.openrouter_key.slice(0, 7)}••••${aiSettings.openrouter_key.slice(-4)}` : null,
        gemini_masked: aiSettings?.gemini_key ? `${aiSettings.gemini_key.slice(0, 7)}••••${aiSettings.gemini_key.slice(-4)}` : null,
        mistral_masked: aiSettings?.mistral_key ? `${aiSettings.mistral_key.slice(0, 7)}••••${aiSettings.mistral_key.slice(-4)}` : null,
        custom_masked: aiSettings?.custom_api_key ? `${aiSettings.custom_api_key.slice(0, 7)}••••${aiSettings.custom_api_key.slice(-4)}` : null,
        anthropic_model: aiSettings?.anthropic_model ?? "",
        openai_model: aiSettings?.openai_model ?? "",
        openrouter_model: aiSettings?.openrouter_model ?? "",
        gemini_model: aiSettings?.gemini_model ?? "",
        mistral_model: aiSettings?.mistral_model ?? "",
        custom_provider_name: aiSettings?.custom_provider_name ?? "",
        custom_base_url: aiSettings?.custom_base_url ?? "",
        custom_model: aiSettings?.custom_model ?? "",
        custom_compatibility: aiSettings?.custom_compatibility ?? "openai-compatible",
        providerStatus: publicProviderStatus(aiSettings),
      }}
    />
  )
}
