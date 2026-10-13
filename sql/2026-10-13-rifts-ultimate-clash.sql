-- Rift's Ultimate Clash: Public Arena ghost teams. Applied 13/10/2026 (rifts_ultimate_clash_ghosts).
-- Each round a player's board is saved; arena players fight a random recent board from the same round (+-1).
create table if not exists public.rc_ghosts (
  id bigint generated always as identity primary key,
  name text not null,
  round int not null,
  team jsonb not null,   -- [[unitId, stars, col, row, healthMulti, damageMulti], ...]
  power numeric not null default 1,
  created_at timestamptz not null default now()
);
create index if not exists rc_ghosts_round on public.rc_ghosts(round, id desc);
alter table public.rc_ghosts enable row level security;

create or replace function public.rc_ghost_put(p_name text, p_round int, p_team jsonb, p_power numeric)
returns boolean language plpgsql security definer set search_path = public as $$
declare n text := left(coalesce(nullif(trim(p_name),''),'Player'), 20);
begin
  if p_round < 1 or p_round > 60 then return false; end if;
  if jsonb_typeof(p_team) <> 'array' or jsonb_array_length(p_team) < 1 or jsonb_array_length(p_team) > 32 then return false; end if;
  if length(p_team::text) > 8000 then return false; end if;
  if exists (select 1 from rc_ghosts where name = n and created_at > now() - interval '4 seconds') then return false; end if;
  insert into rc_ghosts(name, round, team, power) values (n, p_round, p_team, least(greatest(coalesce(p_power,1),0), 1e300));
  return true;
end $$;

create or replace function public.rc_ghost_get(p_round int, p_not text)
returns table(name text, team jsonb, power numeric) language sql security definer set search_path = public as $$
  select g.name, g.team, g.power from (
    select * from rc_ghosts where round between greatest(1,p_round-1) and p_round+1
      and name <> coalesce(p_not,'') order by id desc limit 200
  ) g order by random() limit 1;
$$;

revoke all on public.rc_ghosts from anon, authenticated;
grant execute on function public.rc_ghost_put(text,int,jsonb,numeric) to anon, authenticated;
grant execute on function public.rc_ghost_get(int,text) to anon, authenticated;
