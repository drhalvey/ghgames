-- GH Games: arcade hub (profiles, shop, friends, invites, device links,
-- recovery codes, PhatCoin gifts and play-time rewards). Applied 02/10/2026 in parts
-- (arcade_hub_*); this file matches what is live. No function ever DELETEs rows:
-- the Supabase connector asks for a human OK on deletes, so rows are flagged instead.
-- Everything is reached through gh_* functions; tables stay closed to browsers.

-- ---------- columns ----------
alter table public.accounts
  add column if not exists avatar text not null default 'fox',
  add column if not exists name_color text not null default 'white',
  add column if not exists frame text not null default 'none',
  add column if not exists owned text[] not null default '{}',
  add column if not exists referred_by uuid references public.accounts(id) on delete set null,
  add column if not exists ref_paid boolean not null default false,
  add column if not exists recovery_hash text,
  add column if not exists last_game text,
  add column if not exists last_seen timestamptz;

alter table public.pc_wallets add column if not exists lifetime bigint not null default 0;
update public.pc_wallets w set lifetime = coalesce((select sum(amount) from public.pc_log l where l.account_id = w.account_id and l.amount > 0), 0);

-- ---------- tables ----------
create table if not exists public.friends (
  a uuid not null references public.accounts(id) on delete cascade,   -- asked
  b uuid not null references public.accounts(id) on delete cascade,   -- was asked
  accepted boolean not null default false,
  gone boolean not null default false,          -- said no / unfriended (rows are flagged, never deleted)
  created_at timestamptz not null default now(),
  primary key (a, b),
  check (a <> b)
);
create index if not exists friends_b on public.friends(b);

create table if not exists public.link_codes (
  code text primary key,
  account_id uuid not null references public.accounts(id) on delete cascade,
  expires_at timestamptz not null,
  used boolean not null default false
);

create table if not exists public.guess_log (   -- failed recovery / link-code tries, per connection
  id bigint generated always as identity primary key,
  ip text, kind text, created_at timestamptz not null default now()
);

create table if not exists public.shop_items (
  id text not null,
  kind text not null check (kind in ('avatar','color','frame','theme')),
  name text not null,
  price int not null default 0,
  sort int not null default 0,
  primary key (kind, id)
);

alter table public.friends enable row level security;
alter table public.link_codes enable row level security;
alter table public.guess_log enable row level security;
alter table public.shop_items enable row level security;

insert into public.shop_items(id, kind, name, price, sort) values
  -- avatars (free)
  ('fox','avatar','Fox',0,1),('frog','avatar','Frog',0,2),('panda','avatar','Panda',0,3),
  ('tiger','avatar','Tiger',0,4),('dog','avatar','Dog',0,5),('cat','avatar','Cat',0,6),
  -- avatars (PhatCoin)
  ('rabbit','avatar','Rabbit',40,10),('lion','avatar','Lion',60,11),('octopus','avatar','Octopus',80,12),
  ('robot','avatar','Robot',100,13),('alien','avatar','Alien',100,14),('shark','avatar','Shark',150,15),
  ('wolf','avatar','Wolf',150,16),('unicorn','avatar','Unicorn',200,17),('dino','avatar','T-Rex',250,18),
  ('ninja','avatar','Ninja',300,19),('dragon','avatar','Dragon',400,20),('six7','avatar','6 7',67,21),
  ('goat','avatar','The GOAT',600,22),('crown','avatar','King',800,23),('gem','avatar','Diamond',1500,24),
  -- name colours
  ('white','color','White',0,1),('sky','color','Sky',0,2),('lime','color','Lime',80,3),('pink','color','Pink',80,4),
  ('gold','color','Gold',150,5),('fire','color','Fire',300,6),('ice','color','Ice',300,7),('rainbow','color','Rainbow',600,8),
  -- frames
  ('none','frame','No frame',0,1),('bronze','frame','Bronze',60,2),('silver','frame','Silver',150,3),
  ('gold','frame','Gold',350,4),('neon','frame','Neon',500,5),('flames','frame','Flames',800,6),('diamond','frame','Diamond',1500,7),
  -- site themes (the free ones in theme.js stay free)
  ('goldrush','theme','Gold Rush',250,1),('galaxy','theme','Galaxy',250,2),('jungle','theme','Jungle',250,3)
on conflict (kind, id) do update set name = excluded.name, price = excluded.price, sort = excluded.sort;

-- ---------- helpers (not callable from the browser) ----------
create or replace function public.gh_level(p_lifetime bigint) returns int
language sql immutable set search_path to '' as $$ select floor(sqrt(greatest(p_lifetime,0) / 25.0))::int + 1 $$;

create or replace function public.gh_code(n int) returns text
language sql volatile set search_path to '' as $$
  select string_agg(substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 1 + (get_byte(b, i) % 32), 1), '' order by i)
  from (select extensions.gen_random_bytes(n) b) x, generate_series(0, n - 1) i $$;

create or replace function public.gh_too_many_guesses(p_kind text) returns boolean
language sql stable set search_path to '' as $$
  select count(*) >= 10 from public.guess_log where ip = public.gh_client_ip() and kind = p_kind and created_at > now() - interval '15 minutes' $$;

-- every PhatCoin credit goes through here: balance, lifetime, log, invite bonus
create or replace function public.pc_credit(p_account uuid, p_amount int, p_reason text, p_game text default null, p_item text default null)
returns bigint language plpgsql security definer set search_path to '' as $$
declare bal bigint; acc public.accounts;
begin
  update public.pc_wallets set balance = balance + p_amount, lifetime = lifetime + greatest(p_amount, 0), updated_at = now()
   where account_id = p_account returning balance into bal;
  insert into public.pc_log(account_id, amount, reason, game, item) values (p_account, p_amount, p_reason, p_game, p_item);
  -- invite bonus: once the new player has earned 100 PhatCoin by actually playing, both get paid
  if p_reason in ('win','play','rebirth','leaderboard','daily') then
    select * into acc from public.accounts where id = p_account;
    if acc.referred_by is not null and not acc.ref_paid
       and (select coalesce(sum(amount), 0) from public.pc_log where account_id = p_account and reason in ('win','play','rebirth','leaderboard','daily')) >= 100 then
      update public.accounts set ref_paid = true where id = p_account;
      if (select count(*) from public.accounts where referred_by = acc.referred_by and ref_paid) <= 20 then
        insert into public.pc_wallets(account_id) values (acc.referred_by) on conflict do nothing;
        perform public.pc_credit(acc.referred_by, 100, 'invite', null, acc.username);
        update public.pc_wallets set balance = balance + 50, lifetime = lifetime + 50 where account_id = p_account returning balance into bal;
        insert into public.pc_log(account_id, amount, reason) values (p_account, 50, 'welcome');
      end if;
    end if;
  end if;
  return bal;
end $$;

-- ---------- earning (rewritten to use pc_credit; same limits as before plus 'play') ----------
create or replace function public.gh_pc_earn(p_token text, p_game text, p_reason text, p_amount integer)
returns jsonb language plpgsql security definer set search_path to '' as $$
declare w public.pc_wallets := public.pc_wallet_for(p_token); d date := public.pc_today();
  cap int; amt int; today bigint; bal bigint;
begin
  if p_game !~ '^[a-z0-9-]{2,30}$' then raise exception 'bad_game'; end if;
  cap := case p_reason when 'win' then 5 when 'rebirth' then 25 when 'guest' then 200 when 'play' then 3 else 0 end;
  if cap = 0 then raise exception 'bad_reason'; end if;
  amt := greatest(0, least(cap, coalesce(p_amount, 0)));
  if p_reason = 'win' and w.last_win > now() - interval '8 seconds' then
    return jsonb_build_object('amount', 0, 'error', 'too_fast', 'balance', w.balance); end if;
  if p_reason = 'rebirth' and exists (select 1 from public.pc_log where account_id = w.account_id and reason = 'rebirth' and created_at > now() - interval '60 seconds') then
    return jsonb_build_object('amount', 0, 'error', 'too_fast', 'balance', w.balance); end if;
  if p_reason = 'play' and exists (select 1 from public.pc_log where account_id = w.account_id and reason = 'play' and created_at > now() - interval '55 seconds') then
    return jsonb_build_object('amount', 0, 'error', 'too_fast', 'balance', w.balance); end if;
  if p_reason = 'guest' and exists (select 1 from public.pc_log where account_id = w.account_id and reason = 'guest' and created_at > now() - interval '1 day') then
    return jsonb_build_object('amount', 0, 'error', 'already', 'balance', w.balance); end if;
  today := case when w.earned_day = d then w.earned_today else 0 end;
  amt := greatest(0, least(amt, 1000 - today));
  if amt = 0 then return jsonb_build_object('amount', 0, 'error', 'daily_max', 'balance', w.balance); end if;
  update public.pc_wallets set earned_day = d, earned_today = today + amt,
    last_win = case when p_reason = 'win' then now() else last_win end
   where account_id = w.account_id;
  bal := public.pc_credit(w.account_id, amt, p_reason, p_game);
  return jsonb_build_object('amount', amt, 'balance', bal);
end $$;

create or replace function public.gh_pc_daily(p_token text)
returns jsonb language plpgsql security definer set search_path to '' as $$
declare w public.pc_wallets := public.pc_wallet_for(p_token); d date := public.pc_today(); s int; amt int; bal bigint;
begin
  if w.daily_last = d then return jsonb_build_object('error', 'already', 'balance', w.balance); end if;
  s := case when w.daily_last = d - 1 then w.streak + 1 else 1 end;
  amt := least(100, 10 + 10 * s);
  update public.pc_wallets set daily_last = d, streak = s where account_id = w.account_id;
  bal := public.pc_credit(w.account_id, amt, 'daily');
  return jsonb_build_object('amount', amt, 'streak', s, 'balance', bal);
end $$;

create or replace function public.gh_pc_leaderboard(p_token text, p_game text, p_nick text, p_dir text default 'desc')
returns jsonb language plpgsql security definer set search_path to '' as $$
declare w public.pc_wallets := public.pc_wallet_for(p_token); d date := public.pc_today(); rk int; amt int; bal bigint;
begin
  if exists (select 1 from public.pc_log where account_id = w.account_id and reason = 'leaderboard' and game = p_game
             and (created_at at time zone 'Australia/Perth')::date = d) then
    return jsonb_build_object('amount', 0, 'error', 'already', 'balance', w.balance); end if;
  select r into rk from (
    select lower(trim(name)) n, row_number() over (order by case when p_dir = 'asc' then min(score) else -max(score) end) r
      from public.scores
     where game = p_game and created_at >= (d::timestamp at time zone 'Australia/Perth')
     group by lower(trim(name))) x
   where x.n = lower(trim(coalesce(p_nick, '')));
  if rk is null or rk > 10 then return jsonb_build_object('amount', 0, 'error', 'not_top', 'rank', rk, 'balance', w.balance); end if;
  amt := case when rk = 1 then 100 when rk <= 3 then 50 else 20 end;
  bal := public.pc_credit(w.account_id, amt, 'leaderboard', p_game);
  return jsonb_build_object('amount', amt, 'rank', rk, 'balance', bal);
end $$;

create or replace function public.gh_pc_get(p_token text)
returns jsonb language plpgsql security definer set search_path to '' as $$
declare w public.pc_wallets := public.pc_wallet_for(p_token); d date := public.pc_today();
begin
  return jsonb_build_object('balance', w.balance, 'lifetime', w.lifetime, 'level', public.gh_level(w.lifetime),
    'daily_ready', w.daily_last is distinct from d,
    'streak', case when w.daily_last >= d - 1 then w.streak else 0 end,
    'next_daily', least(100, 20 + 10 * (case when w.daily_last = d - 1 then w.streak else 0 end)),
    'earned_today', case when w.earned_day = d then w.earned_today else 0 end);
end $$;

-- ---------- accounts: easier sign-up, recovery codes, link a device ----------
create or replace function public.gh_signup2(p_username text, p_password text, p_invite text default null)
returns jsonb language plpgsql security definer set search_path to '' as $$
declare r json; a uuid; code text := public.gh_code(12); inv uuid;
begin
  r := public.gh_signup(p_username, p_password);
  select id into a from public.accounts where username = r->>'username';
  select id into inv from public.accounts where username = lower(trim(coalesce(p_invite, ''))) and id <> a;
  update public.accounts set recovery_hash = extensions.crypt(code, extensions.gen_salt('bf', 8)), referred_by = inv where id = a;
  insert into public.pc_wallets(account_id) values (a) on conflict do nothing;
  return jsonb_build_object('token', r->>'token', 'username', r->>'username', 'recovery', code, 'invited_by', case when inv is null then null else lower(trim(p_invite)) end);
end $$;

create or replace function public.gh_recover(p_username text, p_code text, p_new text)
returns jsonb language plpgsql security definer set search_path to '' as $$
declare r public.accounts; code text := public.gh_code(12); c text := upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g'));
begin
  if public.gh_too_many_guesses('recover') then return jsonb_build_object('error', 'locked'); end if;
  select * into r from public.accounts where username = lower(trim(coalesce(p_username, '')));
  if r.id is null or r.recovery_hash is null or r.recovery_hash <> extensions.crypt(c, r.recovery_hash) then
    insert into public.guess_log(ip, kind) values (public.gh_client_ip(), 'recover');
    return jsonb_build_object('error', 'bad_code');
  end if;
  if length(coalesce(p_new, '')) < 6 or length(p_new) > 72 then return jsonb_build_object('error', 'short_password'); end if;
  update public.accounts set pass_hash = extensions.crypt(p_new, extensions.gen_salt('bf', 8)),
    recovery_hash = extensions.crypt(code, extensions.gen_salt('bf', 8)), failed_logins = 0, locked_until = null where id = r.id;
  return jsonb_build_object('token', public.gh_new_session(r.id), 'username', r.username, 'recovery', code);
end $$;

create or replace function public.gh_new_recovery(p_token text, p_password text)
returns jsonb language plpgsql security definer set search_path to '' as $$
declare a uuid := public.gh_account_for(p_token); h text; code text := public.gh_code(12);
begin
  select pass_hash into h from public.accounts where id = a;
  if h <> extensions.crypt(coalesce(p_password, ''), h) then return jsonb_build_object('error', 'bad_login'); end if;
  update public.accounts set recovery_hash = extensions.crypt(code, extensions.gen_salt('bf', 8)) where id = a;
  return jsonb_build_object('recovery', code);
end $$;

create or replace function public.gh_link_make(p_token text)
returns jsonb language plpgsql security definer set search_path to '' as $$
declare a uuid := public.gh_account_for(p_token); c text;
begin
  update public.link_codes set used = true where account_id = a and not used;
  loop
    c := public.gh_code(6);
    exit when not exists (select 1 from public.link_codes where code = c);
  end loop;
  insert into public.link_codes(code, account_id, expires_at) values (c, a, now() + interval '10 minutes');
  return jsonb_build_object('code', c, 'expires_in', 600);
end $$;

create or replace function public.gh_link_use(p_code text)
returns jsonb language plpgsql security definer set search_path to '' as $$
declare c text := upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g')); a uuid; u text;
begin
  if public.gh_too_many_guesses('link') then return jsonb_build_object('error', 'locked'); end if;
  update public.link_codes set used = true where code = c and not used and expires_at > now() returning account_id into a;
  if a is null then
    insert into public.guess_log(ip, kind) values (public.gh_client_ip(), 'link');
    return jsonb_build_object('error', 'bad_code');
  end if;
  select username into u from public.accounts where id = a;
  return jsonb_build_object('token', public.gh_new_session(a), 'username', u);
end $$;

-- ---------- profile, look, shop ----------
create or replace function public.gh_shop()
returns jsonb language sql stable security definer set search_path to '' as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', id, 'kind', kind, 'name', name, 'price', price) order by kind, sort), '[]'::jsonb) from public.shop_items $$;

create or replace function public.gh_owns(acc public.accounts, p_kind text, p_id text) returns boolean
language sql stable set search_path to '' as $$
  select exists (select 1 from public.shop_items s where s.kind = p_kind and s.id = p_id
                 and (s.price = 0 or (p_kind || ':' || p_id) = any(acc.owned))) $$;

create or replace function public.gh_seen(p_token text, p_game text)
returns void language plpgsql security definer set search_path to '' as $$
declare a uuid := public.gh_account_for(p_token);
begin
  if p_game !~ '^[a-z0-9-]{2,30}$' then return; end if;
  update public.accounts set last_game = p_game, last_seen = now() where id = a;
end $$;

create or replace function public.gh_person(p_id uuid) returns jsonb
language sql stable set search_path to '' as $$
  select jsonb_build_object('username', a.username, 'avatar', a.avatar, 'color', a.name_color, 'frame', a.frame,
    'level', public.gh_level(coalesce(w.lifetime, 0)), 'lifetime', coalesce(w.lifetime, 0),
    'last_game', a.last_game, 'last_seen', a.last_seen)
  from public.accounts a left join public.pc_wallets w on w.account_id = a.id where a.id = p_id $$;

create or replace function public.gh_profile(p_token text)
returns jsonb language plpgsql security definer set search_path to '' as $$
declare v_me uuid := public.gh_account_for(p_token); acc public.accounts; w public.pc_wallets := public.pc_wallet_for(p_token); d date := public.pc_today();
begin
  select * into acc from public.accounts where id = v_me;
  return public.gh_person(v_me) || jsonb_build_object(
    'owned', to_jsonb(acc.owned),
    'balance', w.balance,
    'daily_ready', w.daily_last is distinct from d,
    'streak', case when w.daily_last >= d - 1 then w.streak else 0 end,
    'next_daily', least(100, 20 + 10 * (case when w.daily_last = d - 1 then w.streak else 0 end)),
    'earned_today', case when w.earned_day = d then w.earned_today else 0 end,
    'joined', acc.created_at,
    'invites_joined', (select count(*) from public.accounts x where x.referred_by = v_me),
    'invites_paid', (select count(*) from public.accounts x where x.referred_by = v_me and x.ref_paid),
    'has_recovery', acc.recovery_hash is not null,
    'gifts_sent_today', coalesce((select -sum(amount) from public.pc_log where account_id = v_me and reason = 'gift' and amount < 0 and (created_at at time zone 'Australia/Perth')::date = d), 0),
    'friends', coalesce((select jsonb_agg(public.gh_person(case when f.a = v_me then f.b else f.a end)) from public.friends f where f.accepted and not f.gone and (f.a = v_me or f.b = v_me)), '[]'::jsonb),
    'requests', coalesce((select jsonb_agg(public.gh_person(f.a)) from public.friends f where not f.accepted and not f.gone and f.b = v_me), '[]'::jsonb),
    'asked', coalesce((select jsonb_agg(x.username) from public.friends f join public.accounts x on x.id = f.b where not f.accepted and not f.gone and f.a = v_me), '[]'::jsonb),
    'gifts_in', coalesce((select jsonb_agg(jsonb_build_object('from', l.item, 'amount', l.amount, 'at', l.created_at) order by l.created_at desc)
                          from (select * from public.pc_log where account_id = v_me and reason = 'gift' and amount > 0 order by created_at desc limit 5) l), '[]'::jsonb));
end $$;

create or replace function public.gh_set_look(p_token text, p_avatar text, p_color text, p_frame text)
returns jsonb language plpgsql security definer set search_path to '' as $$
declare a uuid := public.gh_account_for(p_token); acc public.accounts;
begin
  select * into acc from public.accounts where id = a;
  if p_avatar is not null and not public.gh_owns(acc, 'avatar', p_avatar) then return jsonb_build_object('error', 'not_owned'); end if;
  if p_color is not null and not public.gh_owns(acc, 'color', p_color) then return jsonb_build_object('error', 'not_owned'); end if;
  if p_frame is not null and not public.gh_owns(acc, 'frame', p_frame) then return jsonb_build_object('error', 'not_owned'); end if;
  update public.accounts set avatar = coalesce(p_avatar, avatar), name_color = coalesce(p_color, name_color), frame = coalesce(p_frame, frame) where id = a;
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.gh_buy(p_token text, p_kind text, p_id text)
returns jsonb language plpgsql security definer set search_path to '' as $$
declare a uuid := public.gh_account_for(p_token); w public.pc_wallets := public.pc_wallet_for(p_token); it public.shop_items; k text := p_kind || ':' || p_id; bal bigint;
begin
  select * into it from public.shop_items where kind = p_kind and id = p_id;
  if it.id is null then return jsonb_build_object('error', 'no_item'); end if;
  if it.price = 0 or exists (select 1 from public.accounts where id = a and k = any(owned)) then
    return jsonb_build_object('ok', true, 'balance', w.balance, 'already', true); end if;
  if w.balance < it.price then return jsonb_build_object('error', 'not_enough', 'balance', w.balance); end if;
  update public.accounts set owned = array_append(owned, k) where id = a;
  bal := public.pc_credit(a, -it.price, 'shop', 'arcade', k);
  return jsonb_build_object('ok', true, 'balance', bal);
end $$;

-- ---------- friends ----------
create or replace function public.gh_friend_add(p_token text, p_username text)
returns jsonb language plpgsql security definer set search_path to '' as $$
declare me uuid := public.gh_account_for(p_token); them uuid;
begin
  select id into them from public.accounts where username = lower(trim(coalesce(p_username, '')));
  if them is null then return jsonb_build_object('error', 'no_user'); end if;
  if them = me then return jsonb_build_object('error', 'self'); end if;
  update public.friends f set accepted = true where f.a = them and f.b = me and not f.gone;
  if found then return jsonb_build_object('ok', true, 'status', 'friends'); end if;
  if exists (select 1 from public.friends f where f.a = me and f.b = them and not f.gone) then
    return jsonb_build_object('ok', true, 'status', case when (select f.accepted from public.friends f where f.a = me and f.b = them) then 'friends' else 'asked' end); end if;
  if (select count(*) from public.friends f where f.a = me and not f.accepted and not f.gone) >= 30 then return jsonb_build_object('error', 'too_many'); end if;
  update public.friends f set a = me, b = them, accepted = false, gone = false, created_at = now()
   where f.gone and ((f.a = me and f.b = them) or (f.a = them and f.b = me));
  if not found then insert into public.friends(a, b) values (me, them); end if;
  return jsonb_build_object('ok', true, 'status', 'asked');
end $$;

create or replace function public.gh_friend_answer(p_token text, p_username text, p_yes boolean)
returns jsonb language plpgsql security definer set search_path to '' as $$
declare me uuid := public.gh_account_for(p_token); them uuid;
begin
  select id into them from public.accounts where username = lower(trim(coalesce(p_username, '')));
  if p_yes then update public.friends set accepted = true where a = them and b = me and not gone;
  else update public.friends set gone = true where a = them and b = me; end if;
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.gh_friend_remove(p_token text, p_username text)
returns jsonb language plpgsql security definer set search_path to '' as $$
declare me uuid := public.gh_account_for(p_token); them uuid;
begin
  select id into them from public.accounts where username = lower(trim(coalesce(p_username, '')));
  update public.friends set gone = true, accepted = false where (a = me and b = them) or (a = them and b = me);
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.gh_gift(p_token text, p_username text, p_amount int)
returns jsonb language plpgsql security definer set search_path to '' as $$
declare me uuid := public.gh_account_for(p_token); w public.pc_wallets := public.pc_wallet_for(p_token);
  them uuid; myname text; sent bigint; amt int := coalesce(p_amount, 0); bal bigint;
begin
  select id into them from public.accounts where username = lower(trim(coalesce(p_username, '')));
  if them is null or not exists (select 1 from public.friends where accepted and not gone and ((a = me and b = them) or (a = them and b = me))) then
    return jsonb_build_object('error', 'not_friends'); end if;
  if amt < 1 then return jsonb_build_object('error', 'bad_amount'); end if;
  sent := coalesce((select -sum(amount) from public.pc_log where account_id = me and reason = 'gift' and amount < 0
                    and (created_at at time zone 'Australia/Perth')::date = public.pc_today()), 0);
  if sent + amt > 100 then return jsonb_build_object('error', 'gift_max', 'left', greatest(0, 100 - sent)); end if;
  if w.balance < amt then return jsonb_build_object('error', 'not_enough', 'balance', w.balance); end if;
  select username into myname from public.accounts where id = me;
  bal := public.pc_credit(me, -amt, 'gift', 'arcade', (select username from public.accounts where id = them));
  insert into public.pc_wallets(account_id) values (them) on conflict do nothing;
  perform public.pc_credit(them, amt, 'gift', 'arcade', myname);
  return jsonb_build_object('ok', true, 'balance', bal);
end $$;

-- ---------- who can call what ----------
revoke all on function public.gh_level(bigint), public.gh_code(int), public.gh_too_many_guesses(text),
  public.pc_credit(uuid, int, text, text, text), public.gh_owns(public.accounts, text, text), public.gh_person(uuid)
  from public, anon, authenticated;
revoke all on function public.gh_signup2(text, text, text), public.gh_recover(text, text, text), public.gh_new_recovery(text, text),
  public.gh_link_make(text), public.gh_link_use(text), public.gh_shop(), public.gh_seen(text, text), public.gh_profile(text),
  public.gh_set_look(text, text, text, text), public.gh_buy(text, text, text), public.gh_friend_add(text, text),
  public.gh_friend_answer(text, text, boolean), public.gh_friend_remove(text, text), public.gh_gift(text, text, int)
  from public;
grant execute on function public.gh_signup2(text, text, text), public.gh_recover(text, text, text), public.gh_new_recovery(text, text),
  public.gh_link_make(text), public.gh_link_use(text), public.gh_shop(), public.gh_seen(text, text), public.gh_profile(text),
  public.gh_set_look(text, text, text, text), public.gh_buy(text, text, text), public.gh_friend_add(text, text),
  public.gh_friend_answer(text, text, boolean), public.gh_friend_remove(text, text), public.gh_gift(text, text, int)
  to anon, authenticated;
