import { readFileSync } from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"
import { USER_AI_SETTINGS_COLUMNS } from "@/lib/ai-runtime/provider-settings"

const PROVIDER_SETTINGS_MIGRATION = "006_complete_provider_agnostic_ai_settings_schema.sql"

const COMPATIBILITY_ALIAS_COLUMNS = [
  "ai_default_provider",
  "ai_default_model",
  "openrouter_api_key",
  "gemini_api_key",
  "mistral_api_key",
  "custom_ai_key",
  "custom_ai_base_url",
  "custom_ai_model",
]

describe("provider settings schema migration", () => {
  it("adds every user_settings column read or normalized by provider settings", () => {
    const migration = readFileSync(
      path.join(process.cwd(), "supabase", "migrations", PROVIDER_SETTINGS_MIGRATION),
      "utf8"
    )
    const selectedColumns = USER_AI_SETTINGS_COLUMNS.split(",").map((column) => column.trim())

    for (const column of [...selectedColumns, ...COMPATIBILITY_ALIAS_COLUMNS]) {
      expect(migration).toContain(`add column if not exists ${column} text`)
    }
  })
})
