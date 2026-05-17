-- Keep user_settings one-row-per-user and make provider settings resilient to
-- older OpenRouter field names. API code writes the canonical openrouter_key
-- column and reads aliases only for compatibility.

alter table public.user_settings
  add column if not exists openrouter_api_key text,
  add column if not exists gemini_api_key text,
  add column if not exists mistral_api_key text;

update public.user_settings
set
  openrouter_key = coalesce(nullif(openrouter_key, ''), nullif(openrouter_api_key, '')),
  gemini_key = coalesce(nullif(gemini_key, ''), nullif(gemini_api_key, '')),
  mistral_key = coalesce(nullif(mistral_key, ''), nullif(mistral_api_key, ''));

with ranked as (
  select
    id,
    row_number() over (
      partition by user_id
      order by updated_at desc nulls last, id desc
    ) as row_number
  from public.user_settings
)
delete from public.user_settings settings
using ranked
where settings.id = ranked.id
  and ranked.row_number > 1;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'user_settings_user_id_key'
      and conrelid = 'public.user_settings'::regclass
  ) then
    alter table public.user_settings
      add constraint user_settings_user_id_key unique (user_id);
  end if;
end $$;

alter table public.user_settings enable row level security;

drop policy if exists "Users own their settings" on public.user_settings;

create policy "Users own their settings"
  on public.user_settings for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
