-- FlowWeek Kalender-Synchronisation: Feed-Tokens + Row Level Security.
-- Im Supabase-SQL-Editor desselben Projekts ausführen wie flowweek_kv_rls.sql.
--
-- Jeder Nutzer kann genau einen abonnierbaren Kalender-Feed haben. Gespeichert
-- wird nur der SHA-256-Hash des Tokens: Die Tabelle enthält damit kein
-- verwendbares Geheimnis. Den Klartext-Token kennt nur das Gerät des Nutzers
-- (und seine eigene, RLS-geschützte Zeile in flowweek_kv).

create table if not exists public.flowweek_calendar_feeds (
  user_id uuid primary key references auth.users(id) on delete cascade,
  token_hash text not null unique,
  timezone text not null default 'Europe/Berlin',
  created_at timestamptz not null default now(),
  last_access_at timestamptz,
  constraint flowweek_feed_token_hash_format check (token_hash ~ '^[0-9a-f]{64}$'),
  constraint flowweek_feed_timezone_length check (char_length(timezone) between 1 and 64)
);

alter table public.flowweek_calendar_feeds enable row level security;

drop policy if exists "flowweek_feed_select_own" on public.flowweek_calendar_feeds;
drop policy if exists "flowweek_feed_insert_own" on public.flowweek_calendar_feeds;
drop policy if exists "flowweek_feed_update_own" on public.flowweek_calendar_feeds;
drop policy if exists "flowweek_feed_delete_own" on public.flowweek_calendar_feeds;

-- Nutzer sehen und verwalten ausschließlich ihre eigene Zeile. Der Kalender-Feed
-- selbst läuft über den Service-Role-Key in Vercel und umgeht RLS bewusst –
-- Kalender-Apps können sich nicht per Supabase-Auth anmelden.
create policy "flowweek_feed_select_own"
on public.flowweek_calendar_feeds
for select
to authenticated
using (auth.uid() = user_id);

create policy "flowweek_feed_insert_own"
on public.flowweek_calendar_feeds
for insert
to authenticated
with check (auth.uid() = user_id);

create policy "flowweek_feed_update_own"
on public.flowweek_calendar_feeds
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "flowweek_feed_delete_own"
on public.flowweek_calendar_feeds
for delete
to authenticated
using (auth.uid() = user_id);
