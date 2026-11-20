-- 20/11/2026 health check: leaderboard PhatCoin only pays for your own scores.
--
-- Before: gh_pc_leaderboard paid any logged-in player whose typed nickname was in
-- today's top 10, so you could claim someone else's place, or post a made-up score
-- straight into public.scores and claim it.
-- After: logged-in players post scores through gh_score_submit, which stamps the
-- score with their account. The prize is worked out from the scores that account
-- posted today, so another player's nickname or a score posted without logging in
-- earns nothing. Anyone can still post to the public boards without an account.
--
-- Safe in either order with the site update: the new leaderboard.js falls back to
-- the old direct insert if gh_score_submit is not there yet.

alter table public.scores add column if not exists account_id uuid references public.accounts(id) on delete set null;
create index if not exists scores_account_game_time_idx on public.scores (account_id, game, created_at) where account_id is not null;

-- Direct inserts from the browser can no longer claim an account.
drop policy if exists "public insert" on public.scores;
create policy "public insert" on public.scores for insert to public
  with check (char_length(name) between 1 and 12 and score >= 0 and score < 'Infinity'::float8 and score <> 'NaN'::float8
              and public.gh_name_ok(name) and account_id is null);

-- Browsers only ever read and add scores.
revoke update, delete, truncate, references, trigger on public.scores from anon, authenticated;

create or replace function public.gh_score_submit(p_token text, p_game text, p_name text, p_score double precision)
returns jsonb language plpgsql security definer set search_path to '' as $$
declare a uuid := public.gh_account_for(p_token);
begin
  if a is null then return jsonb_build_object('ok', false, 'error', 'login'); end if;
  if p_game is null or char_length(p_game) not between 1 and 40
     or p_name is null or char_length(trim(p_name)) not between 1 and 12 or not public.gh_name_ok(p_name)
     or p_score is null or p_score < 0 or p_score = 'Infinity'::float8 or p_score = 'NaN'::float8 then
    return jsonb_build_object('ok', false, 'error', 'bad');
  end if;
  insert into public.scores(game, name, score, account_id) values (p_game, trim(p_name), p_score, a);
  return jsonb_build_object('ok', true);
end $$;
grant execute on function public.gh_score_submit(text, text, text, double precision) to anon, authenticated;

create or replace function public.gh_pc_leaderboard(p_token text, p_game text, p_nick text, p_dir text default 'desc')
returns jsonb language plpgsql security definer set search_path to '' as $$
declare w public.pc_wallets := public.pc_wallet_for(p_token); d date := public.pc_today();
        since timestamptz := (d::timestamp at time zone 'Australia/Perth');
        nick text := lower(trim(coalesce(p_nick, ''))); rk int; amt int; bal bigint;
begin
  if exists (select 1 from public.pc_log where account_id = w.account_id and reason = 'leaderboard' and game = p_game
             and (created_at at time zone 'Australia/Perth')::date = d) then
    return jsonb_build_object('amount', 0, 'error', 'already', 'balance', w.balance); end if;
  -- The nickname must be one this account posted a score under today.
  if not exists (select 1 from public.scores where account_id = w.account_id and game = p_game
                 and created_at >= since and lower(trim(name)) = nick) then
    return jsonb_build_object('amount', 0, 'error', 'not_yours', 'balance', w.balance); end if;
  -- Rank this account's best score today against everyone's best per name, but only
  -- this account's own scores count towards its place.
  select r into rk from (
    select k, row_number() over (order by case when p_dir = 'asc' then best else -best end) r
      from (select lower(trim(name)) k, case when p_dir = 'asc' then min(score) else max(score) end best
              from public.scores
             where game = p_game and created_at >= since and lower(trim(name)) <> nick
             group by lower(trim(name))
            union all
            select nick, case when p_dir = 'asc' then min(score) else max(score) end
              from public.scores
             where game = p_game and created_at >= since and account_id = w.account_id
               and lower(trim(name)) = nick) t) x
   where x.k = nick;
  if rk is null or rk > 10 then return jsonb_build_object('amount', 0, 'error', 'not_top', 'rank', rk, 'balance', w.balance); end if;
  amt := case when rk = 1 then 100 when rk <= 3 then 50 else 20 end;
  bal := public.pc_credit(w.account_id, amt, 'leaderboard', p_game);
  return jsonb_build_object('amount', amt, 'rank', rk, 'balance', bal);
end $$;
