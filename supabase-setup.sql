-- Run this in Supabase SQL Editor (https://supabase.com/dashboard → SQL Editor)
-- If you already ran the previous version, run only the DROP + recreate policy section below.

-- 1. Create the pins table
create table if not exists public.pins (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz default now() not null,
  lat           double precision not null,
  lng           double precision not null,
  username      text not null,
  location_name text,
  note          text,
  taken_at      timestamptz,
  photo_url     text,
  approved      boolean default false not null
);

-- 2. Enable Row Level Security
alter table public.pins enable row level security;

-- 3. Anyone can read approved pins
drop policy if exists "Read approved pins" on public.pins;
create policy "Read approved pins"
  on public.pins for select
  using (approved = true);

-- 4. Anyone can insert a new (unapproved) pin
drop policy if exists "Insert pending pin" on public.pins;
create policy "Insert pending pin"
  on public.pins for insert
  with check (approved = false);

-- 5. Only authenticated users (admins) can update/delete
drop policy if exists "Admin can update pins" on public.pins;
create policy "Admin can update pins"
  on public.pins for update
  using (auth.role() = 'authenticated');

drop policy if exists "Admin can delete pins" on public.pins;
create policy "Admin can delete pins"
  on public.pins for delete
  using (auth.role() = 'authenticated');

-- Also allow authenticated admins to read ALL pins (including pending)
drop policy if exists "Admin reads all pins" on public.pins;
create policy "Admin reads all pins"
  on public.pins for select
  using (auth.role() = 'authenticated');

-- 6. Create storage bucket for photos
insert into storage.buckets (id, name, public)
values ('photos', 'photos', true)
on conflict do nothing;

-- 7. Storage policies
drop policy if exists "Anyone can upload photos" on storage.objects;
create policy "Anyone can upload photos"
  on storage.objects for insert
  with check (bucket_id = 'photos');

drop policy if exists "Photos are publicly readable" on storage.objects;
create policy "Photos are publicly readable"
  on storage.objects for select
  using (bucket_id = 'photos');

-- Only authenticated admins can delete photos
drop policy if exists "Admin can delete photos" on storage.objects;
create policy "Admin can delete photos"
  on storage.objects for delete
  using (bucket_id = 'photos' and auth.role() = 'authenticated');

-- ── Migration: mobile pins ─────────────────────────────────────────────────────
-- Run this block if you already created the table with the previous script
alter table public.pins
  add column if not exists is_mobile   boolean default false not null,
  add column if not exists mobile_type text;
