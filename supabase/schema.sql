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

-- ---------------------------------------------------------------------------
-- site_settings — singleton row for global UI configuration (typography etc).
-- We pin the primary key to a known UUID so both client and server can upsert
-- the same row without needing to fetch-then-write.
-- ---------------------------------------------------------------------------
create table if not exists public.site_settings (
  id                 uuid primary key default '00000000-0000-0000-0000-000000000001',

  -- Typography role → font family string (CSS font-family fragment).
  font_body          text not null default '"DM Sans", ui-sans-serif, system-ui, sans-serif',
  font_display       text not null default '"DM Sans", ui-sans-serif, system-ui, sans-serif',
  font_brand         text not null default '"Sacramento", ui-serif, cursive',

  -- Typography role → CSS font-weight numeric (100–900).
  font_body_weight     integer not null default 400,
  font_display_weight  integer not null default 500,
  font_brand_weight    integer not null default 400,

  -- Typography role → CSS letter-spacing value (em units).
  font_body_tracking     text not null default '0em',
  font_display_tracking  text not null default '-0.01em',
  font_brand_tracking    text not null default '0.005em',

  updated_at         timestamptz not null default now()
);

alter table public.site_settings enable row level security;

drop policy if exists "public read site_settings"  on public.site_settings;
drop policy if exists "anon write site_settings"   on public.site_settings;

create policy "public read site_settings"
  on public.site_settings for select using (true);

-- Anon write — tighten later when Supabase Auth is added.
create policy "anon write site_settings"
  on public.site_settings for all using (true) with check (true);

-- Seed the singleton row if it doesn't already exist.
insert into public.site_settings (id)
  values ('00000000-0000-0000-0000-000000000001')
  on conflict (id) do nothing;

-- =============================================================================
-- Done. Verify in the Table Editor: you should see `topics`, `projects`, and
-- `site_settings` tables. `site_settings` will have exactly one seeded row;
-- the other two start empty and get populated on first editor save.
-- =============================================================================
