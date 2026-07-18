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

-- Forward-compat: add project detail columns for the cinematic side-panel.
alter table public.projects add column if not exists director_note text default '';
alter table public.projects add column if not exists credits       jsonb default '[]'::jsonb;
alter table public.projects add column if not exists release_url   text default '';
alter table public.projects add column if not exists video_aspect_ratio text default '16/9';
alter table public.projects add column if not exists is_favorite boolean default false;

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

  -- Global site configuration (layout / typography / animations) — a single
  -- JSONB blob so new knobs can be added from the client without migrations.
  -- Shape defined in src/lib/siteConfig.js → DEFAULT_SITE_CONFIG.
  site_config            jsonb,

  updated_at         timestamptz not null default now()
);

-- Forward-compat: add `site_config` to existing deployments that pre-date it.
alter table public.site_settings
  add column if not exists site_config jsonb;

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

-- ---------------------------------------------------------------------------
-- assets — library of uploaded media (Cloudinary images + B2 videos) shown
-- in the Editor's "Asset library" section. Uploads insert a row here; the
-- UI lists the most recent rows so the editor can copy URLs at any time.
-- Deleting a row removes only the DB entry (the underlying file stays in
-- Cloudinary / B2) — this keeps existing references on pages safe.
-- ---------------------------------------------------------------------------
create table if not exists public.assets (
  id            uuid primary key default uuid_generate_v4(),
  kind          text not null check (kind in ('image','video')),
  url           text not null,
  filename      text,
  size_bytes    bigint,
  content_type  text,
  width         integer,
  height        integer,
  folder        text,                              -- optional grouping shown in the Asset Picker
  meta          jsonb,
  created_at    timestamptz not null default now()
);

-- Forward-compat for existing deployments that pre-date the folder column.
alter table public.assets
  add column if not exists folder text;

create index if not exists assets_created_idx
  on public.assets (created_at desc);
create index if not exists assets_folder_idx
  on public.assets (folder);

alter table public.assets enable row level security;

drop policy if exists "public read assets"  on public.assets;
drop policy if exists "anon write assets"   on public.assets;

create policy "public read assets"
  on public.assets for select using (true);

-- Anon write — tighten later when you move all writes behind authenticated
-- users. Currently matches the permissiveness of `projects` / `topics`.
create policy "anon write assets"
  on public.assets for all using (true) with check (true);

-- =============================================================================
-- Done. Verify in the Table Editor: you should see `topics`, `projects`,
-- `site_settings`, and `assets` tables. `site_settings` will have exactly one
-- seeded row; the others start empty and get populated on first upload/save.
-- =============================================================================

-- =============================================================================
-- THEATRE ALPHA — Studio Operations, Financials, & Documents
-- =============================================================================

drop table if exists public.doc_expenses cascade;
drop table if exists public.doc_line_items cascade;
drop table if exists public.doc_quotations cascade;
drop table if exists public.alpha_clients cascade;
drop table if exists public.alpha_profiles cascade;

-- ---------------------------------------------------------------------------
-- alpha_profiles (Issuer/Company profiles)
-- ---------------------------------------------------------------------------
create table if not exists public.alpha_profiles (
  id uuid primary key default uuid_generate_v4(),
  company_name text not null,
  tax_id text,
  address text,
  email text,
  phone text,
  logo_url text,
  is_default boolean default false,
  created_at timestamptz not null default now()
);
alter table public.alpha_profiles enable row level security;
drop policy if exists "alpha_profiles access" on public.alpha_profiles;
create policy "alpha_profiles access" on public.alpha_profiles for all using (true) with check (true);

-- ---------------------------------------------------------------------------
-- alpha_clients (CRM)
-- ---------------------------------------------------------------------------
create table if not exists public.alpha_clients (
  id uuid primary key default uuid_generate_v4(),
  company_name text not null,
  tax_id text,
  address text,
  created_at timestamptz not null default now()
);
alter table public.alpha_clients enable row level security;
drop policy if exists "alpha_clients access" on public.alpha_clients;
create policy "alpha_clients access" on public.alpha_clients for all using (true) with check (true);

-- ---------------------------------------------------------------------------
-- doc_quotations (Jobs / Invoices)
-- ---------------------------------------------------------------------------
drop table if exists public.doc_quotations cascade;
create table if not exists public.doc_quotations (
  id uuid primary key default uuid_generate_v4(),
  client_id uuid references public.alpha_clients(id) on delete set null,
  qt_number text not null,
  project_name text,
  status text default 'draft', -- draft, quoted, po_received, invoiced, paid
  start_at timestamptz,
  end_at timestamptz,
  discount_pct numeric default 0,
  vat_pct numeric default 7,
  wht_pct numeric default 0,
  po_number text,
  po_file_url text,
  notes text,
  created_at timestamptz not null default now()
);
alter table public.doc_quotations enable row level security;
drop policy if exists "doc_quotations access" on public.doc_quotations;
create policy "doc_quotations access" on public.doc_quotations for all using (true) with check (true);

-- ---------------------------------------------------------------------------
-- doc_line_items
-- ---------------------------------------------------------------------------
create table if not exists public.doc_line_items (
  id uuid primary key default uuid_generate_v4(),
  quotation_id uuid references public.doc_quotations(id) on delete cascade,
  description text,
  qty numeric,
  unit_price numeric,
  unit_name text,
  created_at timestamptz not null default now()
);
alter table public.doc_line_items enable row level security;
drop policy if exists "doc_line_items access" on public.doc_line_items;
create policy "doc_line_items access" on public.doc_line_items for all using (true) with check (true);

-- ---------------------------------------------------------------------------
-- doc_expenses (Mindmap nodes)
-- ---------------------------------------------------------------------------
create table if not exists public.doc_expenses (
  id uuid primary key default uuid_generate_v4(),
  quotation_id uuid references public.doc_quotations(id) on delete cascade,
  category text,
  description text,
  amount numeric,
  expense_date date,
  is_paid boolean default false,
  x numeric default 0,
  y numeric default 0,
  created_at timestamptz not null default now()
);
alter table public.doc_expenses enable row level security;
drop policy if exists "doc_expenses access" on public.doc_expenses;
create policy "doc_expenses access" on public.doc_expenses for all using (true) with check (true);
