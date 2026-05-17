-- Provider-agnostic AI settings schema extension.
--
-- This migration is intentionally idempotent because some deployed databases
-- may have application code that expects these columns before the schema has
-- been migrated or before Supabase's PostgREST schema cache has refreshed.
--
-- Existing Anthropic/OpenAI key columns are preserved. API keys remain
-- server-side settings and must not be selected into browser responses except
-- as masked/configured status.

alter table public.user_settings
  add column if not exists ai_provider text,
  add column if not exists ai_default_provider text,
  add column if not exists ai_default_model text,

  add column if not exists anthropic_model text,
  add column if not exists anthropic_models text,
  add column if not exists openai_model text,
  add column if not exists openai_models text,

  add column if not exists openrouter_key text,
  add column if not exists openrouter_model text,
  add column if not exists openrouter_models text,

  add column if not exists gemini_key text,
  add column if not exists gemini_model text,
  add column if not exists gemini_models text,

  add column if not exists mistral_key text,
  add column if not exists mistral_model text,
  add column if not exists mistral_models text,

  add column if not exists custom_provider_name text,
  add column if not exists custom_api_key text,
  add column if not exists custom_base_url text,
  add column if not exists custom_model text,
  add column if not exists custom_compatibility text,

  -- Compatibility aliases for older or external provider settings code.
  add column if not exists custom_ai_key text,
  add column if not exists custom_ai_base_url text,
  add column if not exists custom_ai_model text;
