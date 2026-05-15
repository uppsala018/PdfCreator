-- User API key storage.
-- Keys are never returned to the frontend; the API routes read them server-side.
-- RLS ensures every user can only access their own row.

create table user_settings (
  id          uuid        primary key default gen_random_uuid(),
  user_id     uuid        not null references auth.users(id) on delete cascade,
  anthropic_key text,
  openai_key  text,
  updated_at  timestamptz not null default now(),
  constraint  user_settings_user_id_key unique (user_id)
);

create index user_settings_user_id_idx on user_settings (user_id);

alter table user_settings enable row level security;

create policy "Users own their settings"
  on user_settings for all
  using      (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create trigger user_settings_updated_at
  before update on user_settings
  for each row execute function set_updated_at();
