create extension if not exists pgcrypto;

create type public.member_role as enum ('owner', 'coach', 'assistant', 'scorekeeper', 'viewer');
create type public.game_status as enum ('draft', 'live', 'completed', 'archived');

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 120),
  country_code text not null default 'IT',
  timezone text not null default 'Europe/Rome',
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.memberships (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.member_role not null,
  created_at timestamptz not null default now(),
  primary key (organization_id, user_id)
);

create table public.teams (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null check (char_length(name) between 2 and 120),
  short_name text,
  primary_color text not null default '#ed643a',
  secondary_color text not null default '#111714',
  logo_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.seasons (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  starts_on date,
  ends_on date,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.players (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  display_name text not null,
  short_name text,
  dominant_hand text check (dominant_hand in ('left', 'right', 'both')),
  photo_path text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.team_players (
  team_id uuid not null references public.teams(id) on delete cascade,
  season_id uuid not null references public.seasons(id) on delete cascade,
  player_id uuid not null references public.players(id) on delete cascade,
  jersey_number smallint not null check (jersey_number between 0 and 99),
  position text,
  active boolean not null default true,
  primary key (team_id, season_id, player_id),
  unique (team_id, season_id, jersey_number)
);

create table public.games (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  team_id uuid not null references public.teams(id) on delete restrict,
  season_id uuid references public.seasons(id) on delete set null,
  opponent_name text not null,
  scheduled_at timestamptz,
  venue_type text check (venue_type in ('home', 'away', 'neutral')),
  competition_name text,
  status public.game_status not null default 'draft',
  tracking_mode text not null default 'pro' check (tracking_mode in ('basic', 'pro')),
  period_count smallint not null default 4,
  period_duration_seconds integer not null default 600,
  overtime_duration_seconds integer not null default 300,
  current_period smallint not null default 1,
  current_clock_seconds integer not null default 600,
  opponent_score integer not null default 0,
  revision bigint not null default 0,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz
);

create table public.game_roster_entries (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games(id) on delete cascade,
  side text not null check (side in ('home', 'away')),
  player_id uuid references public.players(id) on delete set null,
  display_name text not null,
  jersey_number smallint,
  starter boolean not null default false
);

create table public.game_events (
  id uuid primary key,
  game_id uuid not null references public.games(id) on delete cascade,
  device_id uuid not null,
  client_sequence bigint not null,
  server_sequence bigint generated always as identity,
  period smallint not null,
  clock_seconds integer,
  side text not null default 'home' check (side in ('home', 'away', 'neutral')),
  primary_player_id uuid references public.players(id) on delete set null,
  secondary_player_id uuid references public.players(id) on delete set null,
  event_type text not null,
  points smallint not null default 0,
  x numeric(6, 3),
  y numeric(6, 3),
  metadata jsonb not null default '{}'::jsonb,
  status text not null default 'active' check (status in ('active', 'voided', 'conflicted')),
  recorded_by uuid not null references auth.users(id),
  client_created_at timestamptz not null,
  server_received_at timestamptz not null default now(),
  unique (game_id, device_id, client_sequence)
);

create index game_events_game_sequence_idx
  on public.game_events(game_id, server_sequence);

create table public.event_revisions (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.game_events(id) on delete cascade,
  revision_number integer not null,
  patch jsonb not null,
  reason text,
  revised_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  unique (event_id, revision_number)
);

create table public.share_links (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  game_id uuid references public.games(id) on delete cascade,
  token_hash text not null unique,
  scope text not null check (scope in ('score', 'play_by_play', 'box_score')),
  expires_at timestamptz,
  revoked_at timestamptz,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);

create or replace function public.is_org_member(target_org uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.memberships
    where organization_id = target_org and user_id = auth.uid()
  );
$$;

create or replace function public.has_org_role(target_org uuid, allowed public.member_role[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.memberships
    where organization_id = target_org
      and user_id = auth.uid()
      and role = any(allowed)
  );
$$;

alter table public.organizations enable row level security;
alter table public.memberships enable row level security;
alter table public.teams enable row level security;
alter table public.seasons enable row level security;
alter table public.players enable row level security;
alter table public.team_players enable row level security;
alter table public.games enable row level security;
alter table public.game_roster_entries enable row level security;
alter table public.game_events enable row level security;
alter table public.event_revisions enable row level security;
alter table public.share_links enable row level security;

create policy organizations_read on public.organizations
  for select using (public.is_org_member(id));
create policy organizations_create on public.organizations
  for insert with check (created_by = auth.uid());
create policy organizations_manage on public.organizations
  for update using (public.has_org_role(id, array['owner']::public.member_role[]));

create policy memberships_read on public.memberships
  for select using (public.is_org_member(organization_id));
create policy memberships_manage on public.memberships
  for all using (public.has_org_role(organization_id, array['owner', 'coach']::public.member_role[]));

create policy teams_member_access on public.teams
  for all using (public.is_org_member(organization_id))
  with check (public.has_org_role(organization_id, array['owner', 'coach', 'assistant']::public.member_role[]));
create policy seasons_member_access on public.seasons
  for all using (public.is_org_member(organization_id))
  with check (public.has_org_role(organization_id, array['owner', 'coach', 'assistant']::public.member_role[]));
create policy players_member_access on public.players
  for all using (public.is_org_member(organization_id))
  with check (public.has_org_role(organization_id, array['owner', 'coach', 'assistant']::public.member_role[]));
create policy games_member_access on public.games
  for all using (public.is_org_member(organization_id))
  with check (public.has_org_role(organization_id, array['owner', 'coach', 'assistant', 'scorekeeper']::public.member_role[]));
create policy share_links_manage on public.share_links
  for all using (public.is_org_member(organization_id))
  with check (public.has_org_role(organization_id, array['owner', 'coach', 'assistant']::public.member_role[]));

create policy team_players_member_access on public.team_players
  for all using (
    exists (
      select 1 from public.teams
      where teams.id = team_players.team_id
        and public.is_org_member(teams.organization_id)
    )
  );

create policy roster_member_access on public.game_roster_entries
  for all using (
    exists (
      select 1 from public.games
      where games.id = game_roster_entries.game_id
        and public.is_org_member(games.organization_id)
    )
  );

create policy events_member_access on public.game_events
  for all using (
    exists (
      select 1 from public.games
      where games.id = game_events.game_id
        and public.is_org_member(games.organization_id)
    )
  );

create policy revisions_member_access on public.event_revisions
  for all using (
    exists (
      select 1
      from public.game_events
      join public.games on games.id = game_events.game_id
      where game_events.id = event_revisions.event_id
        and public.is_org_member(games.organization_id)
    )
  );
