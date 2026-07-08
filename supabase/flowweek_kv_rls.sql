-- FlowWeek cloud-sync table and Row Level Security policies.
-- Run this in the Supabase SQL editor for the project used by flowweek.html.

create table if not exists public.flowweek_kv (
  user_id uuid not null references auth.users(id) on delete cascade,
  key text not null,
  value jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, key),
  constraint flowweek_kv_key_length check (char_length(key) between 1 and 120)
);

alter table public.flowweek_kv enable row level security;

drop policy if exists "flowweek_kv_select_own" on public.flowweek_kv;
drop policy if exists "flowweek_kv_insert_own" on public.flowweek_kv;
drop policy if exists "flowweek_kv_update_own" on public.flowweek_kv;
drop policy if exists "flowweek_kv_delete_own" on public.flowweek_kv;

create policy "flowweek_kv_select_own"
on public.flowweek_kv
for select
to authenticated
using (auth.uid() = user_id);

create policy "flowweek_kv_insert_own"
on public.flowweek_kv
for insert
to authenticated
with check (auth.uid() = user_id);

create policy "flowweek_kv_update_own"
on public.flowweek_kv
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "flowweek_kv_delete_own"
on public.flowweek_kv
for delete
to authenticated
using (auth.uid() = user_id);

