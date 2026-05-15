import type { Metadata } from "next"
import { createClient } from "@/lib/supabase/server"
import SettingsClient from "./SettingsClient"

export const metadata: Metadata = { title: "Settings" }

export default async function SettingsPage() {
  const supabase = createClient()

  const { data: settings } = await supabase
    .from("user_settings")
    .select("anthropic_key, openai_key")
    .maybeSingle()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  return (
    <SettingsClient
      userEmail={user?.email ?? ""}
      initialState={{
        anthropic_configured: Boolean(settings?.anthropic_key),
        openai_configured:    Boolean(settings?.openai_key),
        anthropic_masked:     settings?.anthropic_key
          ? `${settings.anthropic_key.slice(0, 7)}••••${settings.anthropic_key.slice(-4)}`
          : null,
        openai_masked: settings?.openai_key
          ? `${settings.openai_key.slice(0, 7)}••••${settings.openai_key.slice(-4)}`
          : null,
      }}
    />
  )
}
