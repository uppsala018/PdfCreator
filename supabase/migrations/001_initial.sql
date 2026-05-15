-- Users are handled by Supabase Auth

-- ─── Tables ────────────────────────────────────────────────────────────────

create table projects (
  id         uuid        primary key default gen_random_uuid(),
  user_id    uuid        not null references auth.users(id) on delete cascade,
  title      text        not null,
  subtitle   text,
  author     text,
  website    text,
  theme      text        not null default 'dark-cinematic'
               check (theme in ('dark-cinematic', 'clean-minimal')),
  template   text        not null default 'ebook-prompt-collection',
  content    jsonb       not null default '{"chapters": []}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table exports (
  id         uuid        primary key default gen_random_uuid(),
  project_id uuid        not null references projects(id) on delete cascade,
  user_id    uuid        not null references auth.users(id) on delete cascade,
  file_path  text,
  created_at timestamptz not null default now()
);

-- ─── Indexes (critical for RLS performance) ────────────────────────────────

create index projects_user_id_idx on projects (user_id);
create index exports_user_id_idx  on exports  (user_id);
create index exports_project_id_idx on exports (project_id);

-- ─── updated_at trigger ────────────────────────────────────────────────────

create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger projects_updated_at
  before update on projects
  for each row execute function set_updated_at();

-- ─── Row-Level Security ────────────────────────────────────────────────────

alter table projects enable row level security;
alter table exports  enable row level security;

-- Projects: owner has full access; WITH CHECK prevents inserting rows
-- with a user_id that doesn't match the authenticated user.
create policy "Users own their projects"
  on projects for all
  using      (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Exports: same pattern.
create policy "Users own their exports"
  on exports for all
  using      (auth.uid() = user_id)
  with check (auth.uid() = user_id);
