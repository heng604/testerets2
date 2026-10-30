-- ════════════════════════════════════════════════════════
--  Masatoshi store — Supabase (Postgres) schema
--  Run this ONCE in: Supabase Dashboard → SQL Editor → New query → Run
--  Safe to re-run (uses IF NOT EXISTS / CREATE OR REPLACE).
-- ════════════════════════════════════════════════════════

create extension if not exists pgcrypto;

-- ── users ───────────────────────────────────────────────
create table if not exists public.users (
  id          uuid primary key default gen_random_uuid(),
  google_id   text,
  username    text not null default '',
  avatar      text,
  email       text not null unique,
  points      numeric not null default 0 check (points >= 0),
  role        text not null default 'user' check (role in ('user','admin')),
  login_count integer not null default 0,
  last_login  timestamptz,
  created_at  timestamptz not null default now()
);

-- ── products (called "mods" in the old Mongo model) ─────
create table if not exists public.mods (
  id               uuid primary key default gen_random_uuid(),
  title            text not null,
  price_in_points  numeric not null default 0,
  discount_code    text not null default '',
  discount_percent numeric not null default 0,
  owner_name       text not null default 'Masatoshi',
  description      text not null,
  images           text[] not null default '{}',
  screenshots      text[] not null default '{}',
  details          jsonb  not null default '[]'::jsonb,
  download_url     text not null,
  version          text not null default '',
  -- Shop label: none | limited_edition | new_arrival | out_of_stock
  label            text not null default 'none'
                   check (label in ('none','limited_edition','new_arrival','out_of_stock')),
  uploaded_at      timestamptz not null default now(),
  last_updated_at  timestamptz not null default to_timestamp(0)
);
-- if the table already existed without the label column:
alter table public.mods add column if not exists label text not null default 'none';

-- ── purchases ───────────────────────────────────────────
create table if not exists public.purchases (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid references public.users(id) on delete set null,
  user_email         text not null,
  mod_id             uuid references public.mods(id) on delete set null,
  points_spent       numeric not null,
  purchased_at       timestamptz not null default now(),
  notified_update_at timestamptz not null default now(),
  downloaded         boolean not null default false
);
create index if not exists purchases_email_idx on public.purchases(user_email);

-- ── deposits (manual slip + Bakong KHQR) ────────────────
create table if not exists public.deposits (
  id               uuid primary key default gen_random_uuid(),
  deposit_id       text not null unique,
  user_email       text not null,
  method           text not null,
  amount           numeric not null,
  slip_url         text,
  status           text not null default 'pending'
                   check (status in ('pending','approved','rejected','expired')),
  timestamp        timestamptz not null default now(),
  source           text not null default 'manual' check (source in ('manual','bakong')),
  currency         text not null default 'KHR' check (currency in ('KHR','USD')),
  points           numeric,
  point_rate_used  numeric,
  khqr_string      text,
  md5              text,
  expires_at       timestamptz,
  check_error_count integer not null default 0
);
create index if not exists deposits_md5_idx    on public.deposits(md5);
create index if not exists deposits_status_idx on public.deposits(status, source);
create index if not exists deposits_email_idx  on public.deposits(user_email);

-- ── reports ─────────────────────────────────────────────
create table if not exists public.reports (
  id          uuid primary key default gen_random_uuid(),
  report_id   text not null unique,
  user_email  text not null,
  username    text not null default '',
  subject     text not null,
  category    text not null default 'other'
              check (category in ('bug','payment','product','account','other')),
  message     text not null,
  status      text not null default 'open'
              check (status in ('open','in-review','resolved','closed')),
  admin_note  text not null default '',
  timestamp   timestamptz not null default now(),
  resolved_at timestamptz
);

-- ── banned emails ───────────────────────────────────────
create table if not exists public.banned_emails (
  id              uuid primary key default gen_random_uuid(),
  email           text not null unique,
  reason          text not null default 'Deleted by admin',
  banned_at       timestamptz not null default now(),
  attempt_count   integer not null default 0,
  last_attempt_at timestamptz,
  locked_until    timestamptz
);

-- ── settings (single row, key = 'global') ───────────────
create table if not exists public.settings (
  id                   uuid primary key default gen_random_uuid(),
  key                  text not null unique default 'global',
  site_name            text not null default 'Masatoshi',
  telegram_url         text not null default 'https://t.me/xCloudStudio',
  discord_url          text not null default 'https://discord.gg/',
  point_rate           numeric not null default 100,
  bakong_account_id    text not null default '',
  bakong_token         text not null default '',
  bakong_base_url      text not null default 'https://api-bakong.nbc.gov.kh',
  bakong_merchant_name text not null default '',
  bakong_merchant_city text not null default 'Phnom Penh',
  usd_exchange_rate    numeric not null default 4100,
  banner_images        text[] not null default '{}',
  updated_at           timestamptz not null default now()
);
insert into public.settings (key) values ('global') on conflict (key) do nothing;

-- ── Bakong tester history (admin dashboard "Test Bakong") ─
create table if not exists public.bakong_tests (
  id            uuid primary key default gen_random_uuid(),
  kind          text not null default 'qr' check (kind in ('qr','ping')),
  amount        numeric,
  currency      text,
  md5           text,
  khqr_string   text,
  status        text not null default 'pending'
                check (status in ('pending','paid','expired','error','ok')),
  http_status   integer,
  message       text,
  raw_response  jsonb,
  created_by    text,
  created_at    timestamptz not null default now(),
  expires_at    timestamptz
);

-- ── Atomic points adjustment (no race conditions) ───────
-- Returns the updated user row, or NO ROWS if the user is missing or the
-- balance would go below 0.
create or replace function public.adjust_points(p_email text, p_delta numeric)
returns setof public.users
language sql
security definer
set search_path = public
as $$
  update public.users
     set points = points + p_delta
   where email = p_email
     and points + p_delta >= 0
  returning *;
$$;

-- ── Security: lock every table down. ────────────────────
-- The Vercel API talks to Supabase with the SERVICE ROLE key (bypasses RLS).
-- With RLS on and NO policies, the public anon key can read/write nothing.
alter table public.users          enable row level security;
alter table public.mods           enable row level security;
alter table public.purchases      enable row level security;
alter table public.deposits       enable row level security;
alter table public.reports        enable row level security;
alter table public.banned_emails  enable row level security;
alter table public.settings       enable row level security;
alter table public.bakong_tests   enable row level security;

revoke all on function public.adjust_points(text, numeric) from public, anon, authenticated;

-- ── Storage bucket for banner / product images ──────────
insert into storage.buckets (id, name, public)
values ('store-images', 'store-images', true)
on conflict (id) do nothing;
-- Public READ is automatic for public buckets. Uploads only happen server-side
-- (service role), so no insert policy is needed.
