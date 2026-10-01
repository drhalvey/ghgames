# GH Games — George's Arcade

A free, static games site for George. Plain HTML and JavaScript, no build step, no server.
Hosted free on GitHub Pages at **ghgames.au**.

## What's in here

```
ghgames/
  index.html      the arcade homepage (featured game + game tiles with drawn SVG cover art)
  leaderboards.html  all the leaderboards on one page
  site.css        shared look for the homepage and leaderboards page
  favicon.svg     the yellow GH logo
  account.js      player accounts + online saves (username/password, no email) — see below
  analytics.js    Google Analytics (set GA_ID inside; Frondi Clicker pages do not load it)
  blackhole.html  drag-and-release: fling stars into a black hole
  sparrow.html    flappy-style sparrow, with score + best
  crazy-dads.html dads vs kids chase: soda knockouts, then the Monica & Didi boss (online via Supabase Realtime)
  bro-got-slammed.html  Pedigreers vs Bro Got Slammed: 4-minute team fights, wins buy damage upgrades (online via Supabase Realtime)
  size-simulator.html  eat-and-grow PvP: upgrades, rebirths, worlds bought with coins, pets, daily rewards, shared 10-minute events (online via Supabase Realtime)
  steal-an-animal.html  buy animals off the road, steal from computer bases and friends' bases (online via Supabase sta_* functions), guards, lock, 3 galaxies of 25 worlds, rebirths
  CNAME           contains "ghgames.au" — tells GitHub Pages the domain
  README.md       this file
```

Open any `index.html` in a browser right now to play — nothing needs to be online to test.

## Putting it online (one-time setup — Ed does these)

These three steps need your card, your identity, and your logins, so they're yours, not George's.

**1. Register the domain.**
Go to [VentraIP](https://ventraip.com.au) (Australian registrar) and register **ghgames.au** in your name (~AUD 15/year). Note: `ghgames.com.au` is already taken by someone else, and `.au` direct doesn't need an ABN, so it's the easy one. Under-18s can't legally hold a domain, so it goes in your name.

**2. Create the GitHub repo.**
Make a free [GitHub](https://github.com) account, then a new **public** repository called `ghgames`. Upload the *contents* of this folder (so `index.html` sits at the top of the repo, not inside a `ghgames/` subfolder).

**3. Turn on Pages + point the domain.**
- In the repo: **Settings → Pages →** Source = "Deploy from a branch", Branch = `main`, folder = `/ (root)`. Save.
- The site goes live within a minute at `https://<your-username>.github.io/ghgames/`.
- In **VentraIP DNS settings**, add these records:

  | Type  | Host | Value           |
  |-------|------|-----------------|
  | A     | @    | 185.199.108.153 |
  | A     | @    | 185.199.109.153 |
  | A     | @    | 185.199.110.153 |
  | A     | @    | 185.199.111.153 |
  | CNAME | www  | `<your-username>.github.io` |

- Back in **Settings → Pages**, enter `ghgames.au` as the Custom domain and tick **Enforce HTTPS**.
- DNS can take a few hours. Once it loads cleanly, *then* tell George it's live.

## Adding a new game (the fun loop, forever after)

1. Build a self-contained game file (one file, plain HTML/JS), touch-friendly for iPad, saved as `<name>.html`.
2. Put `<script src="analytics.js" defer></script>` under its `<title>` so visits are counted.
3. In `index.html`, copy an existing `<a class="tile">` block inside the grid and change the link, the SVG cover art, the name, the one-line description and the two tags. Give the newest game the `<span class="badge new">New</span>` badge and take it off the old one.
4. If it saves progress, add `<script src="account.js" data-game="<name>"></script>` in `<head>` (before the game's code) and add the game's localStorage key(s) to `GAMES` at the top of `account.js`. Players who are logged in then get that game saved online too.
5. If it has a leaderboard, add a `<div id="lb-...">` and a `Leaderboard.mount(...)` line to `leaderboards.html`.
6. Push to GitHub. Live in under a minute.

## House rules (keep it safe)

- Domain and accounts in **Ed's name only**.
- **No surname, school, suburb, or photos** anywhere on the site. First name and initials only.

## Accounts and online saves

- Players can make an account with just a **username and password** (no email, no real name). Playing without an account still works exactly as before.
- Each game still saves in the browser. When logged in, `account.js` copies the save to Supabase every 15 seconds and when the page closes, and pulls it down on any other device.
- If a device has different progress from the online save, the player is asked which one to keep. Best-score games (Click Frenzy, Mega Obby) just keep the better score.
- Logging out saves everything online, then clears the games off that device so the next player starts fresh.
- Five wrong passwords lock that account for 10 minutes. At most 5 new accounts per hour from one internet connection.
- Nicknames on leaderboards and in Wall Hop gifts are still free text and are not tied to accounts.
- **Frondi Clicker is deliberately left out**: its privacy policy (and the iPhone app) promise no accounts.
- Resetting a forgotten password (Ed, via the Supabase SQL editor):
  `update public.accounts set pass_hash = extensions.crypt('NEWPASS', extensions.gen_salt('bf', 8)), failed_logins = 0, locked_until = null where username = 'theirname';`
