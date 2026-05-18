create table if not exists public.ebook_generation_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'planning'
    check (status in ('planning', 'generating', 'ready', 'failed', 'finalized')),
  topic text not null,
  settings jsonb not null default '{}',
  outline jsonb,
  chapters jsonb not null default '[]',
  diagnostics jsonb not null default '[]',
  current_chapter_index integer not null default 0,
  result_project_id uuid references public.projects(id) on delete set null,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists ebook_generation_jobs_user_id_idx
  on public.ebook_generation_jobs(user_id);

create index if not exists ebook_generation_jobs_status_idx
  on public.ebook_generation_jobs(status);

drop trigger if exists ebook_generation_jobs_updated_at on public.ebook_generation_jobs;
create trigger ebook_generation_jobs_updated_at
  before update on public.ebook_generation_jobs
  for each row execute function public.set_updated_at();

alter table public.ebook_generation_jobs enable row level security;

drop policy if exists "Users own their ebook generation jobs" on public.ebook_generation_jobs;
create policy "Users own their ebook generation jobs"
  on public.ebook_generation_jobs for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
