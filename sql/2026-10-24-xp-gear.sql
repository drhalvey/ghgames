-- GH Games: Experience (XP) and accessories (gear), 24/10/2026.
-- XP is earned on the server alongside PhatCoin (gh_pc_earn now also pays XP), so games never pay it.
-- Catalogue rows come from gear.js: node tools/gear-items-sql.js (run it again after adding items).
-- No function DELETEs rows. Internal helpers are closed to browsers; only gh_gear_* and gh_pc_earn are open.

-- ---------- tables ----------
create table if not exists public.gear_items (
  id text primary key, slot text not null, name text not null, rarity text not null,
  price int not null default 0, source text not null default 'shop', level int not null default 0, sort int not null default 0);
create table if not exists public.xp_wallets (
  account_id uuid primary key references public.accounts(id) on delete cascade,
  balance bigint not null default 0, lifetime bigint not null default 0, keys int not null default 0,
  earned_day date, earned_today int not null default 0,
  quest_day date, quests_done int[] not null default '{}', bonus_day date,
  updated_at timestamptz not null default now());
create table if not exists public.xp_log (
  id bigserial primary key, account_id uuid not null references public.accounts(id) on delete cascade,
  amount int not null, reason text not null, game text, item text, created_at timestamptz not null default now());
create index if not exists xp_log_acc_time on public.xp_log(account_id, created_at desc);
create table if not exists public.gear_owned (
  account_id uuid not null references public.accounts(id) on delete cascade, item_id text not null references public.gear_items(id),
  how text not null, got_at timestamptz not null default now(), primary key (account_id, item_id));
alter table public.accounts add column if not exists gear_on jsonb not null default '{}'::jsonb;
alter table public.gear_items enable row level security;
alter table public.xp_wallets enable row level security;
alter table public.xp_log enable row level security;
alter table public.gear_owned enable row level security;

-- ---------- helpers ----------
create or replace function public.xp_level(p_life bigint) returns int language sql immutable as
$$ select floor(sqrt(greatest(p_life, 0) / 15.0))::int + 1 $$;
create or replace function public.xp_level_start(p_level int) returns bigint language sql immutable as
$$ select (15 * (p_level - 1) * (p_level - 1))::bigint $$;

create or replace function public.xp_wallet(p_account uuid) returns public.xp_wallets
language plpgsql security definer set search_path to '' as $$
declare w public.xp_wallets;
begin
  insert into public.xp_wallets(account_id) values (p_account) on conflict do nothing;
  select * into w from public.xp_wallets where account_id = p_account for update;
  return w;
end $$;

-- every XP change goes through here: levels give crate keys and level gear
create or replace function public.xp_credit(p_account uuid, p_amount int, p_reason text, p_game text default null, p_item text default null)
returns bigint language plpgsql security definer set search_path to '' as $$
declare w public.xp_wallets := public.xp_wallet(p_account); l0 int; l1 int; bal bigint;
begin
  l0 := public.xp_level(w.lifetime);
  update public.xp_wallets set balance = balance + p_amount, lifetime = lifetime + greatest(p_amount, 0), updated_at = now()
   where account_id = p_account returning balance, public.xp_level(lifetime) into bal, l1;
  insert into public.xp_log(account_id, amount, reason, game, item) values (p_account, p_amount, p_reason, p_game, p_item);
  if l1 > l0 then
    update public.xp_wallets set keys = keys + (l1 - l0) where account_id = p_account;
    insert into public.gear_owned(account_id, item_id, how)
      select p_account, g.id, 'level' from public.gear_items g where g.source = 'level' and g.level > l0 and g.level <= l1
      on conflict do nothing;
  end if;
  return bal;
end $$;

-- XP for play, wins and rebirths; called from gh_pc_earn
create or replace function public.xp_event(p_account uuid, p_reason text, p_game text)
returns jsonb language plpgsql security definer set search_path to '' as $$
declare w public.xp_wallets := public.xp_wallet(p_account); d date := public.pc_today(); amt int; gap interval; today int; bal bigint;
begin
  amt := case p_reason when 'play' then 1 when 'win' then 1 when 'rebirth' then 3 else 0 end;
  if amt = 0 then return null; end if;
  gap := case p_reason when 'play' then interval '55 seconds' when 'win' then interval '15 seconds' else interval '60 seconds' end;
  if exists (select 1 from public.xp_log where account_id = p_account and reason = p_reason and created_at > now() - gap) then
    return jsonb_build_object('amount', 0, 'balance', w.balance, 'lifetime', w.lifetime, 'level', public.xp_level(w.lifetime)); end if;
  today := case when w.earned_day = d then w.earned_today else 0 end;
  amt := greatest(0, least(amt, 200 - today));
  update public.xp_wallets set earned_day = d, earned_today = today + amt where account_id = p_account;
  bal := public.xp_credit(p_account, amt, p_reason, p_game);   -- a 0 row still counts towards quests
  select * into w from public.xp_wallets where account_id = p_account;
  return jsonb_build_object('amount', amt, 'balance', w.balance, 'lifetime', w.lifetime, 'level', public.xp_level(w.lifetime));
end $$;

-- the same three quests for everyone each Perth day
create or replace function public.xp_quests(p_day date) returns jsonb
language plpgsql immutable set search_path to '' as $$
declare h int := abs(hashtext('ghq' || p_day::text)); games text[] := array['wall-hop','crazy-dads','bro-got-slammed','size-simulator','steal-an-animal','rugby-kicker','drop-goal-hero','runway-stars','save-your-rabbit','poo-simulator','monster-mayhem','rail-dash','blob-feast','slinky-arena','hop-across','sky-bounce','evo-clash','roll-rampage','find-a-million-balls','t-rex-titans','plus-one-height','tower-of-suffering','mega-dropper-tycoon','duel-masters','parry-panic','turf-grab','star-raiders','maze-muncher'];
  pool text[] := array['wins','games','game','rebirth']; a int; b int; q jsonb := '[]'::jsonb; k text; g int; gm text;
begin
  g := (array[10, 15, 20])[1 + h % 3];
  q := q || jsonb_build_object('kind', 'mins', 'goal', g, 'reward', 30, 'text', 'Play any games for ' || g || ' minutes');
  a := 1 + (h / 7) % 4; b := 1 + ((h / 7) % 4 + 1 + (h / 31) % 3) % 4;
  foreach k in array array[pool[a], pool[b]] loop
    if k = 'wins' then g := (array[3, 5, 8])[1 + (h / 11) % 3]; q := q || jsonb_build_object('kind', k, 'goal', g, 'reward', 40, 'text', 'Win ' || g || ' times in any game');
    elsif k = 'games' then g := (array[2, 3, 4])[1 + (h / 13) % 3]; q := q || jsonb_build_object('kind', k, 'goal', g, 'reward', 40, 'text', 'Play ' || g || ' different games');
    elsif k = 'game' then gm := games[1 + (h / 17) % array_length(games, 1)]; q := q || jsonb_build_object('kind', k, 'goal', 5, 'game', gm, 'reward', 50, 'text', 'Play ' || gm || ' for 5 minutes');
    else q := q || jsonb_build_object('kind', k, 'goal', 1, 'reward', 40, 'text', 'Rebirth once in any game'); end if;
  end loop;
  return q;
end $$;

create or replace function public.xp_quest_progress(p_account uuid, p_day date, p_q jsonb) returns int
language sql stable security definer set search_path to '' as $$
  select least((p_q->>'goal')::int, coalesce(case p_q->>'kind'
    when 'mins' then (select count(*) from public.xp_log l where l.account_id = p_account and l.reason = 'play' and (l.created_at at time zone 'Australia/Perth')::date = p_day)
    when 'wins' then (select count(*) from public.xp_log l where l.account_id = p_account and l.reason = 'win' and (l.created_at at time zone 'Australia/Perth')::date = p_day)
    when 'games' then (select count(distinct l.game) from public.xp_log l where l.account_id = p_account and l.reason = 'play' and (l.created_at at time zone 'Australia/Perth')::date = p_day)
    when 'game' then (select count(*) from public.xp_log l where l.account_id = p_account and l.reason = 'play' and l.game = p_q->>'game' and (l.created_at at time zone 'Australia/Perth')::date = p_day)
    when 'rebirth' then (select count(*) from public.xp_log l where l.account_id = p_account and l.reason = 'rebirth' and (l.created_at at time zone 'Australia/Perth')::date = p_day)
  end, 0)::int) $$;

-- ---------- what the browser calls ----------
create or replace function public.gh_gear_state(p_token text) returns jsonb
language plpgsql security definer set search_path to '' as $$
declare a uuid := public.gh_account_for(p_token); w public.xp_wallets := public.xp_wallet(a); d date := public.pc_today();
  qs jsonb := public.xp_quests(d); done int[]; out jsonb := '[]'::jsonb; i int; lv int; allDone boolean := true; p int;
begin
  done := case when w.quest_day = d then w.quests_done else '{}' end;
  for i in 0 .. jsonb_array_length(qs) - 1 loop
    p := public.xp_quest_progress(a, d, qs->i);
    if not (i = any(done)) then allDone := false; end if;
    out := out || ((qs->i) || jsonb_build_object('idx', i, 'progress', p, 'claimed', i = any(done)));
  end loop;
  lv := public.xp_level(w.lifetime);
  return jsonb_build_object(
    'balance', w.balance, 'lifetime', w.lifetime, 'level', lv,
    'level_start', public.xp_level_start(lv), 'next_level', public.xp_level_start(lv + 1),
    'keys', w.keys,
    'earned_today', case when w.earned_day = d then w.earned_today else 0 end, 'cap', 200,
    'owned', coalesce((select jsonb_agg(item_id order by got_at) from public.gear_owned where account_id = a), '[]'::jsonb),
    'on', (select gear_on from public.accounts where id = a),
    'quests', out,
    'bonus_claimed', w.bonus_day = d,
    'bonus_ready', allDone and w.bonus_day is distinct from d);
end $$;

create or replace function public.gh_gear_buy(p_token text, p_item text) returns jsonb
language plpgsql security definer set search_path to '' as $$
declare a uuid := public.gh_account_for(p_token); w public.xp_wallets := public.xp_wallet(a); it public.gear_items;
begin
  select * into it from public.gear_items where id = p_item;
  if it.id is null or it.source <> 'shop' then return jsonb_build_object('error', 'not_for_sale'); end if;
  if exists (select 1 from public.gear_owned where account_id = a and item_id = p_item) then return public.gh_gear_state(p_token) || jsonb_build_object('already', true); end if;
  if w.balance < it.price then return jsonb_build_object('error', 'not_enough', 'balance', w.balance); end if;
  insert into public.gear_owned(account_id, item_id, how) values (a, p_item, 'shop');
  perform public.xp_credit(a, -it.price, 'buy', null, p_item);
  return public.gh_gear_state(p_token) || jsonb_build_object('item', p_item);
end $$;

create or replace function public.gh_gear_crate(p_token text, p_crate text, p_key boolean default false) returns jsonb
language plpgsql security definer set search_path to '' as $$
declare a uuid := public.gh_account_for(p_token); w public.xp_wallets := public.xp_wallet(a); price int; r float := random() * 100;
  rar text; it public.gear_items; dupe boolean; refund int := 0;
begin
  price := case p_crate when 'starter' then 100 when 'epic' then 600 when 'mythic' then 2500 else null end;
  if price is null then return jsonb_build_object('error', 'no_crate'); end if;
  if p_key then
    if p_crate <> 'starter' then return jsonb_build_object('error', 'key_starter_only'); end if;
    if w.keys < 1 then return jsonb_build_object('error', 'no_keys'); end if;
  elsif w.balance < price then return jsonb_build_object('error', 'not_enough', 'balance', w.balance); end if;
  rar := case p_crate
    when 'starter' then case when r < 60 then 'common' when r < 90 then 'uncommon' when r < 99 then 'rare' else 'epic' end
    when 'epic' then case when r < 25 then 'uncommon' when r < 70 then 'rare' when r < 95 then 'epic' else 'legendary' end
    else case when r < 45 then 'epic' when r < 80 then 'legendary' when r < 95 then 'mythic' else 'secret' end end;
  select * into it from public.gear_items where rarity = rar and source in ('shop', 'crate') order by random() limit 1;
  if p_key then update public.xp_wallets set keys = keys - 1 where account_id = a;
    insert into public.xp_log(account_id, amount, reason, item) values (a, 0, 'key', p_crate);
  else perform public.xp_credit(a, -price, 'crate', null, p_crate); end if;
  dupe := exists (select 1 from public.gear_owned where account_id = a and item_id = it.id);
  if dupe then
    refund := (case when it.rarity = 'secret' then 5000 else it.price end) / 2;
    perform public.xp_credit(a, refund, 'dupe', null, it.id);
  else insert into public.gear_owned(account_id, item_id, how) values (a, it.id, 'crate:' || p_crate); end if;
  return public.gh_gear_state(p_token) || jsonb_build_object('item', it.id, 'dupe', dupe, 'refund', refund);
end $$;

create or replace function public.gh_gear_equip(p_token text, p_slot text, p_item text) returns jsonb
language plpgsql security definer set search_path to '' as $$
declare a uuid := public.gh_account_for(p_token); it public.gear_items;
begin
  if p_slot not in ('hat', 'face', 'back', 'aura', 'trail', 'body') then return jsonb_build_object('error', 'bad_slot'); end if;
  if p_item is null then
    update public.accounts set gear_on = gear_on - p_slot where id = a;
  else
    select * into it from public.gear_items where id = p_item;
    if it.id is null or it.slot <> p_slot then return jsonb_build_object('error', 'bad_item'); end if;
    if not exists (select 1 from public.gear_owned where account_id = a and item_id = p_item) then return jsonb_build_object('error', 'not_owned'); end if;
    update public.accounts set gear_on = gear_on || jsonb_build_object(p_slot, p_item) where id = a;
  end if;
  return jsonb_build_object('ok', true, 'on', (select gear_on from public.accounts where id = a));
end $$;

create or replace function public.gh_gear_quest(p_token text, p_idx int) returns jsonb
language plpgsql security definer set search_path to '' as $$
declare a uuid := public.gh_account_for(p_token); w public.xp_wallets := public.xp_wallet(a); d date := public.pc_today(); q jsonb; done int[];
begin
  q := public.xp_quests(d) -> p_idx;
  if q is null then return jsonb_build_object('error', 'no_quest'); end if;
  done := case when w.quest_day = d then w.quests_done else '{}' end;
  if p_idx = any(done) then return jsonb_build_object('error', 'already'); end if;
  if public.xp_quest_progress(a, d, q) < (q->>'goal')::int then return jsonb_build_object('error', 'not_done'); end if;
  update public.xp_wallets set quest_day = d, quests_done = array_append(done, p_idx) where account_id = a;
  perform public.xp_credit(a, (q->>'reward')::int, 'quest', q->>'game', q->>'kind');
  return public.gh_gear_state(p_token) || jsonb_build_object('reward', (q->>'reward')::int);
end $$;

create or replace function public.gh_gear_bonus(p_token text) returns jsonb
language plpgsql security definer set search_path to '' as $$
declare a uuid := public.gh_account_for(p_token); w public.xp_wallets := public.xp_wallet(a); d date := public.pc_today();
begin
  if w.bonus_day = d then return jsonb_build_object('error', 'already'); end if;
  if w.quest_day is distinct from d or coalesce(array_length(w.quests_done, 1), 0) < jsonb_array_length(public.xp_quests(d)) then return jsonb_build_object('error', 'not_done'); end if;
  update public.xp_wallets set bonus_day = d, keys = keys + 1 where account_id = a;
  insert into public.xp_log(account_id, amount, reason) values (a, 0, 'bonus_key');
  return public.gh_gear_state(p_token);
end $$;

-- ---------- PhatCoin earning now also pays XP ----------
alter function public.gh_pc_earn(text, text, text, integer) rename to pc_earn_core;
create or replace function public.gh_pc_earn(p_token text, p_game text, p_reason text, p_amount integer)
returns jsonb language plpgsql security definer set search_path to '' as $$
declare r jsonb; x jsonb;
begin
  r := public.pc_earn_core(p_token, p_game, p_reason, p_amount);
  x := public.xp_event(public.gh_account_for(p_token), p_reason, p_game);
  return case when x is null then r else r || jsonb_build_object('xp', x) end;
end $$;

-- ---------- who can call what ----------
revoke all on function public.xp_wallet(uuid), public.xp_credit(uuid, int, text, text, text), public.xp_event(uuid, text, text),
  public.xp_quest_progress(uuid, date, jsonb), public.pc_earn_core(text, text, text, integer) from public, anon, authenticated;
grant execute on function public.gh_gear_state(text), public.gh_gear_buy(text, text), public.gh_gear_crate(text, text, boolean),
  public.gh_gear_equip(text, text, text), public.gh_gear_quest(text, int), public.gh_gear_bonus(text),
  public.gh_pc_earn(text, text, text, integer) to anon, authenticated;
