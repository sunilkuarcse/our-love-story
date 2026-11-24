-- Our Love Story: private couple setup
-- 1) Create the two users in Supabase Auth first, with public sign-ups disabled.
-- 2) Replace both AUTH_USER_UUID placeholders in the final DO block.
-- 3) Run this entire file in the Supabase SQL Editor.
-- The browser must use only the publishable/anon key. Never use service_role here.

create extension if not exists pgcrypto with schema extensions;

create table if not exists public.couples (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'Our Love Story',
  created_at timestamptz not null default now()
);

create table if not exists public.couple_members (
  user_id uuid primary key references auth.users(id) on delete cascade,
  couple_id uuid not null references public.couples(id) on delete cascade,
  created_at timestamptz not null default now()
);

create or replace function public.limit_couple_to_two_members()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if (select count(*) from public.couple_members where couple_id = new.couple_id and user_id <> new.user_id) >= 2 then
    raise exception 'A private couple can have only two authorized users';
  end if;
  return new;
end;
$$;

drop trigger if exists couple_member_limit on public.couple_members;
create trigger couple_member_limit
before insert or update of couple_id on public.couple_members
for each row execute function public.limit_couple_to_two_members();

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  couple_id uuid not null references public.couples(id) on delete cascade,
  display_name text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.photos (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references public.couples(id) on delete cascade,
  owner_id uuid not null references auth.users(id),
  local_id text,
  content_hash text not null,
  storage_path text not null,
  title text not null default '',
  caption text not null default '',
  photo_date date,
  frame_id text not null default 'polaroid',
  zoom numeric not null default 1 check (zoom between 1 and 3),
  position_x integer not null default 0 check (position_x between -100 and 100),
  position_y integer not null default 0 check (position_y between -100 and 100),
  rotation integer not null default 0 check (rotation between -180 and 180),
  animation_effects jsonb not null default '{}'::jsonb,
  animation_speed numeric not null default 1 check (animation_speed between 0.5 and 2),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (couple_id, content_hash),
  unique (couple_id, local_id)
);

create table if not exists public.timeline_events (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references public.couples(id) on delete cascade,
  owner_id uuid not null references auth.users(id),
  local_id text,
  title text not null,
  event_date date,
  description text not null default '',
  photo_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (couple_id, local_id)
);

create table if not exists public.love_letters (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references public.couples(id) on delete cascade,
  owner_id uuid not null references auth.users(id),
  local_id text,
  title text not null,
  content text not null,
  letter_date date not null default current_date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (couple_id, local_id)
);

create table if not exists public.relationship_settings (
  couple_id uuid primary key references public.couples(id) on delete cascade,
  owner_id uuid not null references auth.users(id),
  relationship_start_date date,
  updated_at timestamptz not null default now()
);

create or replace function public.current_couple_id()
returns uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select couple_id from public.couple_members where user_id = auth.uid() limit 1;
$$;

revoke all on function public.current_couple_id() from public, anon;
grant execute on function public.current_couple_id() to authenticated;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.is_couple_member(target_couple_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select target_couple_id is not null and target_couple_id = public.current_couple_id();
$$;

revoke all on function public.is_couple_member(uuid) from public, anon;
grant execute on function public.is_couple_member(uuid) to authenticated;

-- Keep client role grants explicit. The RLS policies below remain the authority.
grant select on public.couples, public.couple_members to authenticated;
grant select, update on public.profiles to authenticated;
grant select, insert, update, delete on public.photos, public.timeline_events, public.love_letters, public.relationship_settings to authenticated;

alter table public.couples enable row level security;
alter table public.couple_members enable row level security;
alter table public.profiles enable row level security;
alter table public.photos enable row level security;
alter table public.timeline_events enable row level security;
alter table public.love_letters enable row level security;
alter table public.relationship_settings enable row level security;

drop policy if exists couples_read_member on public.couples;
create policy couples_read_member on public.couples for select to authenticated
using (id = public.current_couple_id());

drop policy if exists couple_members_read_self on public.couple_members;
create policy couple_members_read_self on public.couple_members for select to authenticated
using (user_id = auth.uid());

-- Membership rows are provisioned only by the project owner in SQL; no client write policies exist.
drop policy if exists profiles_read_couple on public.profiles;
create policy profiles_read_couple on public.profiles for select to authenticated
using (public.is_couple_member(couple_id));
drop policy if exists profiles_update_self on public.profiles;
create policy profiles_update_self on public.profiles for update to authenticated
using (id = auth.uid() and public.is_couple_member(couple_id))
with check (id = auth.uid() and public.is_couple_member(couple_id));

-- Couple members share the memories and may edit/delete shared content.
-- Inserts must always identify the authenticated member as the creator.
drop policy if exists photos_read_couple on public.photos;
create policy photos_read_couple on public.photos for select to authenticated using (public.is_couple_member(couple_id));
drop policy if exists photos_insert_member on public.photos;
create policy photos_insert_member on public.photos for insert to authenticated with check (public.is_couple_member(couple_id) and owner_id = auth.uid());
drop policy if exists photos_update_couple on public.photos;
create policy photos_update_couple on public.photos for update to authenticated using (public.is_couple_member(couple_id)) with check (public.is_couple_member(couple_id));
drop policy if exists photos_delete_couple on public.photos;
create policy photos_delete_couple on public.photos for delete to authenticated using (public.is_couple_member(couple_id));

drop policy if exists timeline_read_couple on public.timeline_events;
create policy timeline_read_couple on public.timeline_events for select to authenticated using (public.is_couple_member(couple_id));
drop policy if exists timeline_insert_member on public.timeline_events;
create policy timeline_insert_member on public.timeline_events for insert to authenticated with check (public.is_couple_member(couple_id) and owner_id = auth.uid());
drop policy if exists timeline_update_couple on public.timeline_events;
create policy timeline_update_couple on public.timeline_events for update to authenticated using (public.is_couple_member(couple_id)) with check (public.is_couple_member(couple_id));
drop policy if exists timeline_delete_couple on public.timeline_events;
create policy timeline_delete_couple on public.timeline_events for delete to authenticated using (public.is_couple_member(couple_id));

drop policy if exists letters_read_couple on public.love_letters;
create policy letters_read_couple on public.love_letters for select to authenticated using (public.is_couple_member(couple_id));
drop policy if exists letters_insert_member on public.love_letters;
create policy letters_insert_member on public.love_letters for insert to authenticated with check (public.is_couple_member(couple_id) and owner_id = auth.uid());
drop policy if exists letters_update_couple on public.love_letters;
create policy letters_update_couple on public.love_letters for update to authenticated using (public.is_couple_member(couple_id)) with check (public.is_couple_member(couple_id));
drop policy if exists letters_delete_couple on public.love_letters;
create policy letters_delete_couple on public.love_letters for delete to authenticated using (public.is_couple_member(couple_id));

drop policy if exists settings_read_couple on public.relationship_settings;
create policy settings_read_couple on public.relationship_settings for select to authenticated using (public.is_couple_member(couple_id));
drop policy if exists settings_insert_member on public.relationship_settings;
create policy settings_insert_member on public.relationship_settings for insert to authenticated with check (public.is_couple_member(couple_id) and owner_id = auth.uid());
drop policy if exists settings_update_couple on public.relationship_settings;
create policy settings_update_couple on public.relationship_settings for update to authenticated using (public.is_couple_member(couple_id)) with check (public.is_couple_member(couple_id));

drop trigger if exists photos_updated_at on public.photos;
create trigger photos_updated_at before update on public.photos for each row execute function public.set_updated_at();
drop trigger if exists timeline_updated_at on public.timeline_events;
create trigger timeline_updated_at before update on public.timeline_events for each row execute function public.set_updated_at();
drop trigger if exists letters_updated_at on public.love_letters;
create trigger letters_updated_at before update on public.love_letters for each row execute function public.set_updated_at();
drop trigger if exists settings_updated_at on public.relationship_settings;
create trigger settings_updated_at before update on public.relationship_settings for each row execute function public.set_updated_at();

-- Private image bucket: 10 MiB per image; only browser-safe image formats.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('couple-memories', 'couple-memories', false, 10485760, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = false, file_size_limit = 10485760, allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp'];

drop policy if exists couple_storage_read on storage.objects;
create policy couple_storage_read on storage.objects for select to authenticated
using (bucket_id = 'couple-memories' and (storage.foldername(name))[1] = public.current_couple_id()::text);
drop policy if exists couple_storage_insert on storage.objects;
create policy couple_storage_insert on storage.objects for insert to authenticated
with check (bucket_id = 'couple-memories' and (storage.foldername(name))[1] = public.current_couple_id()::text);
drop policy if exists couple_storage_update on storage.objects;
create policy couple_storage_update on storage.objects for update to authenticated
using (bucket_id = 'couple-memories' and (storage.foldername(name))[1] = public.current_couple_id()::text)
with check (bucket_id = 'couple-memories' and (storage.foldername(name))[1] = public.current_couple_id()::text);
drop policy if exists couple_storage_delete on storage.objects;
create policy couple_storage_delete on storage.objects for delete to authenticated
using (bucket_id = 'couple-memories' and (storage.foldername(name))[1] = public.current_couple_id()::text);

-- Realtime is used to refresh shared memories across the two signed-in browsers.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'photos') then
      execute 'alter publication supabase_realtime add table public.photos';
    end if;
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'timeline_events') then
      execute 'alter publication supabase_realtime add table public.timeline_events';
    end if;
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'love_letters') then
      execute 'alter publication supabase_realtime add table public.love_letters';
    end if;
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'relationship_settings') then
      execute 'alter publication supabase_realtime add table public.relationship_settings';
    end if;
  end if;
end;
$$;

-- Create the couple and allowlist exactly two Auth users. Replace the two UUID values.
DO $$
DECLARE
    new_couple_id UUID := gen_random_uuid();

    first_user_id UUID :=
        '9f3be5f4-9726-498c-ac76-030f89c0f80d'::UUID;

    second_user_id UUID :=
        '2cb5e8ec-8376-46ff-96b0-722265f1fd4c'::UUID;

BEGIN

    INSERT INTO public.couples (id, name)
    VALUES (new_couple_id, 'Our Love Story');

    INSERT INTO public.couple_members (user_id, couple_id)
    VALUES
        (first_user_id, new_couple_id),
        (second_user_id, new_couple_id);

    INSERT INTO public.profiles (id, couple_id, display_name)
    VALUES
        (first_user_id, new_couple_id, 'Partner One'),
        (second_user_id, new_couple_id, 'Partner Two');

END;
$$;