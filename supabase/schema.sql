-- =============================================================================
-- Amphitheatre Film — Supabase schema for the in-browser content editor.
--
-- Paste this whole file into Supabase → SQL Editor → "New query" and run it.
-- Idempotent: safe to run multiple times (uses `if not exists` / `or replace`).
--
-- Tables:
--   topics    — one row per category shown in the sidebar / grid
--   projects  — one row per piece of work, FK → topics.id
--
-- Each row has a stable UUID primary key so the app can `upsert` by id.
-- RLS is enabled with permissive policies (public read + anon write) because
-- the editor is gated client-side by a password. If you add Supabase Auth
-- later, tighten the write policies to `auth.role() = 'authenticated'`.
-- =============================================================================

-- uuid-ossp is usually already enabled; this is a safety net.
create extension if not exists "uuid-ossp";

-- ---------------------------------------------------------------------------
-- topics
-- ---------------------------------------------------------------------------
create table if not exists public.topics (
  id           uuid primary key default uuid_generate_v4(),
  label        text not null default '',
  order_index  integer not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists topics_order_idx
  on public.topics (order_index);

-- ---------------------------------------------------------------------------
-- projects
-- ---------------------------------------------------------------------------
create table if not exists public.projects (
  id              uuid primary key default uuid_generate_v4(),
  topic_id        uuid references public.topics(id) on delete cascade,
  title           text not null default '',
  subtitle        text default '',
  url             text default '',
  image           text default '',
  image_position  text default '50% 50%',
  order_index     integer not null default 0,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists projects_topic_order_idx
  on public.projects (topic_id, order_index);

create index if not exists projects_order_idx
  on public.projects (order_index);

-- ---------------------------------------------------------------------------
-- Row-Level Security
-- ---------------------------------------------------------------------------
alter table public.topics   enable row level security;
alter table public.projects enable row level security;

-- Public read on both tables.
drop policy if exists "public read topics"   on public.topics;
drop policy if exists "public read projects" on public.projects;

create policy "public read topics"
  on public.topics for select using (true);

create policy "public read projects"
  on public.projects for select using (true);

-- Anon write — tighten later when Supabase Auth is added.
drop policy if exists "anon write topics"   on public.topics;
drop policy if exists "anon write projects" on public.projects;

create policy "anon write topics"
  on public.topics for all using (true) with check (true);

create policy "anon write projects"
  on public.projects for all using (true) with check (true);

-- =============================================================================
-- Done. Verify in the Table Editor: you should see `topics` and `projects`
-- with zero rows. The app will populate them the first time you hit Save in
-- the editor.
-- =============================================================================
