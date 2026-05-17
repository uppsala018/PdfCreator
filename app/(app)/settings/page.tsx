import type { Metadata } from "next"
import { createClient } from "@/lib/supabase/server"
import {
  publicAISettingsResponse,
  USER_AI_SETTINGS_COLUMNS,
} from "@/lib/ai-runtime/provider-settings"
import SettingsClient from "./SettingsClient"

export const metadata: Metadata = { title: "Settings" }

export default async function SettingsPage() {
  const supabase = createClient()

  const { data: settings } = await supabase
    .from("user_settings")
    .select(USER_AI_SETTINGS_COLUMNS)
    .maybeSingle()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  return (
    <SettingsClient
      userEmail={user?.email ?? ""}
      initialState={publicAISettingsResponse(settings)}
    />
  )
}
