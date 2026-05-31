-- Run this in Supabase SQL Editor (https://supabase.com/dashboard → SQL Editor)

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
create policy "Read approved pins"
  on public.pins for select
  using (approved = true);

-- 4. Anyone can insert a new (unapproved) pin
create policy "Insert pending pin"
  on public.pins for insert
  with check (approved = false);

-- 5. Service role (admin page uses anon key + password check client-side,
--    but for update/delete we use service role key — see note in README)
--    For simplicity with anon key, allow update/delete from anon too.
--    In production, use a server-side function with service role key.
create policy "Admin can update pins"
  on public.pins for update
  using (true);

create policy "Admin can delete pins"
  on public.pins for delete
  using (true);

-- 6. Create storage bucket for photos
insert into storage.buckets (id, name, public)
values ('photos', 'photos', true)
on conflict do nothing;

-- 7. Storage policies: anyone can upload, anyone can read public photos
create policy "Anyone can upload photos"
  on storage.objects for insert
  with check (bucket_id = 'photos');

create policy "Photos are publicly readable"
  on storage.objects for select
  using (bucket_id = 'photos');

create policy "Admin can delete photos"
  on storage.objects for delete
  using (bucket_id = 'photos');
