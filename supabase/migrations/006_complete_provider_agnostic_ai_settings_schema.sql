-- Complete provider-agnostic AI settings schema for public.user_settings.
--
-- Keep this migration in sync with lib/ai-runtime/provider-settings.ts. It is
-- intentionally idempotent so deployed databases that missed an earlier partial
-- provider-settings migration can be repaired without column-by-column failures.

alter table public.user_settings
  add column if not exists ai_provider text,
  add column if not exists ai_default_provider text,
  add column if not exists ai_default_model text,

  add column if not exists anthropic_key text,
  add column if not exists anthropic_model text,
  add column if not exists anthropic_models text,

  add column if not exists openai_key text,
  add column if not exists openai_model text,
  add column if not exists openai_models text,

  add column if not exists openrouter_key text,
  add column if not exists openrouter_api_key text,
  add column if not exists openrouter_model text,
  add column if not exists openrouter_models text,

  add column if not exists gemini_key text,
  add column if not exists gemini_api_key text,
  add column if not exists gemini_model text,
  add column if not exists gemini_models text,

  add column if not exists mistral_key text,
  add column if not exists mistral_api_key text,
  add column if not exists mistral_model text,
  add column if not exists mistral_models text,

  add column if not exists custom_provider_name text,
  add column if not exists custom_api_key text,
  add column if not exists custom_base_url text,
  add column if not exists custom_model text,
  add column if not exists custom_compatibility text,

  add column if not exists custom_ai_key text,
  add column if not exists custom_ai_base_url text,
  add column if not exists custom_ai_model text;

update public.user_settings
set
  ai_provider = coalesce(nullif(ai_provider, ''), nullif(ai_default_provider, '')),
  openrouter_key = coalesce(nullif(openrouter_key, ''), nullif(openrouter_api_key, '')),
  gemini_key = coalesce(nullif(gemini_key, ''), nullif(gemini_api_key, '')),
  mistral_key = coalesce(nullif(mistral_key, ''), nullif(mistral_api_key, '')),
  custom_api_key = coalesce(nullif(custom_api_key, ''), nullif(custom_ai_key, '')),
  custom_base_url = coalesce(nullif(custom_base_url, ''), nullif(custom_ai_base_url, '')),
  custom_model = coalesce(nullif(custom_model, ''), nullif(custom_ai_model, ''));
