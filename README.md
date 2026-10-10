# GH Games — George's Arcade

A free, static games site for George. Plain HTML and JavaScript, no build step, no server.
Hosted free on GitHub Pages at **ghgames.au**.

## What's in here

```
ghgames/
  index.html      the arcade homepage: console-style hero with a game rail, type filters, game tiles with drawn SVG cover art
  home.js         homepage hero, rail and filters; builds itself from the tiles in index.html
  leaderboards.html  all the leaderboards on one page
  site.css        shared look for the homepage and leaderboards page
  favicon.svg     the yellow GH logo
  account.js      player accounts, online saves, avatars/looks, invite links, share sheet, link-a-device — see below
  phatcoin.js     PhatCoin, the one coin for every game, kept in the player's account — see below
  hub.js          homepage PhatCoin hub (wallet, daily bonus, shop teaser, friends) and "Continue playing"
  me.html, me.js  the player's page: PhatCoin shop, friends + gifts, invite link, account settings
  manifest.webmanifest, sw.js, icons/   "Add to Home Screen" app install (network-first, so updates show at once)
  og/             link-preview pictures for iMessage/WhatsApp (one per game + home.png)
  sql/            the database changes, kept for the record
  analytics.js    Google Analytics (set GA_ID inside; Frondi Clicker pages do not load it)
  crazy-dads.html dads vs kids chase: soda knockouts, then the Monica & Didi boss (online via Supabase Realtime)
  bro-got-slammed.html  Pedigreers vs Bro Got Slammed: 4-minute team fights, wins buy damage upgrades (online via Supabase Realtime)
  size-simulator.html  eat-and-grow PvP: upgrades, rebirths, worlds bought with coins, pets, daily rewards, shared 10-minute events (online via Supabase Realtime)
  steal-an-animal.html  buy animals off the road, steal from computer bases and friends' bases (online via Supabase sta_* functions), guards, lock, 8 galaxies of 25 worlds, rebirths
  rugby-kicker.html  aim then power bar: kick a rugby ball as high as you can for Wins, goals pay double, upgrades, 11 stadiums up to the Galaxy Arena
  drop-goal-hero.html  proper rugby kicking: 3D-jointed players, phase play into a drop goal with the defence rushing, touchline conversions off a tee with power/accuracy meters; 2003 World Cup final scenario, Conversion mode and Career, upgrades, 6 stadiums
  iron-command.html  base-building war game (Red Alert style): MCV, power, ore, tanks, soldiers, helicopters, ships (Naval Yard, gunboats, destroyers/subs, cruisers, transports), wide rivers with bridges, sea and island maps, walls, towers, superweapons, fog of war, 14-mission campaign, skirmish, and "Play together" co-op (one device hosts via Supabase Realtime, others join with a 4-letter room code); saves the battle in progress
  runway-stars.html  dress-up fashion show: outfits to a theme, everyone rates each other out of 5 stars, best rating wins, wins buy better clothes (online via Supabase Realtime, computer models fill spots)
  plains-of-abraham.html  Quebec 1759: hold the British line, lie down under sniper fire, hold fire until 40 yards, give the perfect volley, reload drill, advance and charge; command each battalion, line and column formations, speed-up, full battle replay; upgrades, stars, leaderboard
  seven-years-war.html  the whole war in North America 1755-1760: pick Britain or France, campaign map with armies, recruiting and fleets, then fight each battle (line volleys, forest ambush, siege and breach, entrenchments, beach landings, naval broadsides with wind) or auto-resolve; 8 historic battles; reached from the Plains of Abraham win screen too; v2 graphics: outlined animated soldiers with drummers, colours and mounted officers, lit hilly terrain with trees, fields and 3D forts, weather (fog, rain, spring snow), smoke, sparks, craters and fires, zoom/pan camera with slow-motion perfect volleys, detailed ships with sails and rigging on moving water, a live AI battle behind the title screen; drops to a lighter mode by itself on slow devices
  seven-years-war-classic.html  the first, simpler-graphics version of Seven Years' War kept as its own game (own save key syw-classic-save and leaderboard)
  save-your-rabbit.html  intro where a rich guy steals your rabbit, then a 25-stage jump obby: wins from each stage buy jump multis, walls need more jump each stage, stage 25 gets your rabbit back
  poo-simulator.html  hold to push, let go in the gold zone for a perfect poo: poos earn coins, food buys release power, 11 worlds bought with coins (better food, bigger coin multi), rebirths double food and coin multi, Auto Poo, biggest poo ever and this session
  monster-mayhem.html  be the monster (like You Monster! on Poki): eat zombies to grow, bite and SMASH other monsters, last one standing wins; 100 levels over 10 worlds with a boss every 10th level and a closing purple storm, 8 upgrades, 10 monsters to unlock; Public Arena is one free-for-all room for everyone online (Supabase Realtime, the oldest player runs the computer monsters, each player owns their own health, zombies are the same on every device from a seed); leaderboard is most KOs in one life
  evo-clash.html  swing-and-evolve arena (George's own version of the evolve-as-you-win .io games, own name and art): one hit knocks out, gobble orbs and knock out rivals for XP, 1000 evolutions over 100 ages (Stone Age to Galaxy Age hand-made, then 90 themed ages from Lava Age to Infinity Age; a new form every level), each evolution needs 1.5x the XP of the one before (George, 10/10/2026; was 2x for a few minutes), bigger means longer reach but slower feet, 6 power-ups on the map (Speed, Shield, Double XP, Giant, Magnet, Fury), rebirths (+1x XP multi each and start 2 evolutions higher; needs Evo 20, then +10 each time), Solo vs computer on 3 difficulties or the Public Arena (Supabase Realtime channel evoclash-arena, the oldest player runs the computer fighters, each player owns their own knockouts); save evoclash-save, leaderboard most knockouts in one life
  rail-dash.html  endless train-track runner (like Subway Surfers, no ads): swipe or arrow keys to change track, jump red barriers, roll under yellow signs, run up ramps onto train roofs, dodge moving trains; stumble twice and Bolt the guard bot catches you; power-ups (magnet, shield, rocket, double coins) with coin upgrades, score multi, 6 runners, 5 worlds, 3 rolling missions; leaderboard is highest score
  arcade3d.js, arcade3d.css  shared kit for the 20 arcade classics (see below)
  tools/test3d.py headless smoke test for any page
  CNAME           contains "ghgames.au" — tells GitHub Pages the domain
  README.md       this file
```

Open any `index.html` in a browser right now to play — nothing needs to be online to test.

## 3D versions and Classic copies (October 2026)

Every game is now 3D (three.js r128, kept locally in `vendor/three.min.js`, no CDN). The 2D version of each is kept as `<name>-classic.html`, linked from the top of the 3D page; it uses the same save key and `data-game`, so progress is shared and online games still mix 3D and Classic players. Seven Years' War's 2D copy is `seven-years-war-2d.html`, because `seven-years-war-classic.html` was already its own older game. If a device cannot run WebGL, the 3D page shows a link to the Classic.
New games: build them 3D from the start (save-your-rabbit.html is a good pattern: sky dome, studded blocks, blocky characters, follow camera, joystick on iPad).

## Arcade classics (October 2026)

20 original 3D versions of the classic web game hits, all built on the shared kit `arcade3d.js` + `arcade3d.css` (three.js view, sky, shadows, saves, sounds, particles, PhatCoin and leaderboard helpers; the API is documented at the top of `arcade3d.js`; `cube-merge.html` is the template for a new one). Each has its own name, art and characters, never the original game's. All save online, earn PhatCoin and have a leaderboard.

- **Cube Merge** (`cube-merge.html`, save `cubemerge-idle-save`, leaderboard `cube-merge-idle` biggest cube): George's buy-and-merge version (10/10/2026). Start with 30 coins, the shop sells only your biggest cube (starting with a 1 cube for 30), each cube earns its number in coins per second (offline too, up to 8 hours), merge two the same to make the next, and every new cube makes the shop price 2.5 times higher. 21 cubes from 1 to 1048576. A pointing hand shows what to press until the 16 cube. The old slide-2048 game is kept as **Cube Merge Classic** (`cube-merge-classic.html`, save `cubemerge-save`, leaderboard `cube-merge` best score).
- **Slinky Arena** (`slinky-arena.html`, save `slinkyarena-save`, leaderboard best length): Steer a glowing snake round a giant 3D arena, gobble pellets to grow and cut off up to 20 computer snakes. Boost, unlock skins and top the arena.
- **Block Drop** (`block-drop.html`, save `blockdrop-save`, leaderboard best Marathon score): Stack the falling shapes, fill whole rows and blast them away in 3D. Marathon, 40 Lines and Ultra modes, with block skins to unlock.
- **Hop Across** (`hop-across.html`, save `hopacross-save`, leaderboard furthest hop): Hop over busy roads, ride logs across rivers and dodge speedy trains in a blocky 3D world. Collect coins to unlock 8 cute critters.
- **Fruit Slash** (`fruit-slash.html`, save `fruitslash-save`, leaderboard best Classic score): Swipe to slice flying 3D fruit into juicy halves, chain combos and dodge the bombs. Classic, Arcade and Zen modes with blades and backgrounds to unlock.
- **Knight's Table** (`knights-table.html`, save `knightstable-save`, leaderboard highest computer level beaten): 3D chess with carved wooden and marble pieces. Beat the computer on 5 levels or play a friend on one device, and unlock new boards and sets.
- **Blob Feast** (`blob-feast.html`, save `blobfeast-save`, leaderboard best mass): Be a wobbly jelly blob in a giant 3D arena. Gobble dots and smaller blobs, split to pounce, dodge the spiky green viruses and grow to rule the arena.
- **Flap Dash** (`flap-dash.html`, save `flapdash-save`, leaderboard best score): Tap to flap your chunky little flyer through the gaps. Win medals, grab coins for new flyers and unlock five 3D worlds from sunny hills to outer space.
- **Maze Muncher** (`maze-muncher.html`, save `mazemuncher-save`, leaderboard best score): Chomp every dot in glowing 3D mazes while four cheeky monsters give chase. Grab a power berry and turn the tables! 5 mazes, bonus treats and new looks to buy.
- **Balloon Defence** (`balloon-defence.html`, save `balloondefence-save`, leaderboard highest round): Build frogs, robots, cannons and wizards to pop waves of balloons before they float off the map. 6 towers with 2 upgrade paths, 4 maps, 40 rounds and a boss blimp every 10.
- **Five Letters** (`five-letters.html`, save `fiveletters-save`, leaderboard longest win streak): Guess the secret five-letter word in six tries. Green means right spot, yellow means it is in the word. A new Daily word every day, plus unlimited Practice.
- **Pocket Pool** (`pocket-pool.html`, save `pocketpool-save`, leaderboard most wins vs the Hard computer): 3D 8-ball pool with real ball physics. Aim with the guide line, add spin, and beat the computer on 3 levels or a friend on one device. Win coins for new cues and cloths.
- **Star Raiders** (`star-raiders.html`, save `starraiders-save`, leaderboard best score): Slide your ship, blast the marching alien fleets and hide behind crumbly cube shields. Boss waves, a bonus mothership, power-ups and new ships to buy.
- **Turf Grab** (`turf-grab.html`, save `turfgrab-save`, leaderboard biggest share of the map): Leave your patch, draw a loop and dash home to grab all the land inside. Cut through rival trails, never get caught out, and own half the 3D map to win.
- **Sky Bounce** (`sky-bounce.html`, save `skybounce-save`, leaderboard highest bounce): Bounce up and up through the clouds and into space! Springs, rocket packs, whirly caps and grumpy flying puffs. Buy new bouncers and worlds.
- **Patience** (`patience.html`, save `patience-save`, leaderboard fastest win): Classic patience card game on a 3D felt table. Draw 1 or draw 3, drag or tap cards, use hints and undo, and win to unlock new card backs and tables.
- **Brick Smash** (`brick-smash.html`, save `bricksmash-save`, leaderboard best score): Bounce the ball, smash shiny 3D brick walls and catch power-ups like lasers and multi-ball. 32 levels with 3 stars each and paddle skins to collect.
- **Slingshot Siege** (`slingshot-siege.html`, save `slingshotsiege-save`, leaderboard total stars): Pull back the slingshot and fling fluffy critters at wobbly towers of wood, stone and glass to bonk the grumpy green Glumps. 24 levels with 3 stars each.
- **Mine Patrol** (`mine-patrol.html`, save `minepatrol-save`, leaderboard fastest Medium time): Dig up the grassy field without hitting a hidden mine. Use the number clues, plant flags and beat your best time on Easy, Medium and Hard.

Test any page headless with `python3 tools/test3d.py <page>.html --click "#bPlay" --wait 3 --shot out.png` (needs `pip install playwright` and `python3 -m playwright install chromium`); it prints any page errors.

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
3. In `index.html`, copy an existing `<a class="tile">` block to the top of the grid and change the link, the `--glow` colour, `data-tags`, the SVG cover art, the name, the one-line description and the two tags. The hero rail and the filters pick it up automatically. Give the newest game the `<span class="badge new">New</span>` badge and take it off the old one.
4. Add `<script src="account.js" data-game="<name>"></script>` and then `<script src="phatcoin.js" data-game="<name>" data-pill="none"></script>` in `<head>` (before the game's code), and add the game's title and localStorage key(s) to `GAMES` at the top of `account.js`. The game then saves online, earns PhatCoin for play time and leaderboard places, and appears in "Continue playing". Call `PhatCoin.earn("win", 5, "why")` when someone wins.
   Copy the og/link-preview `<meta>` block from another game and make `og/<name>.png` (1200x630).
5. If it has a leaderboard, add a `<div id="lb-...">` and a `Leaderboard.mount(...)` line to `leaderboards.html`.
6. Push to GitHub. Live in under a minute.

## House rules (keep it safe)

- Domain and accounts in **Ed's name only**.
- **No surname, school, suburb, or photos** anywhere on the site. First name and initials only.

## Accounts and online saves

- Username + password only (no email, no real name). The sign-up box suggests a fun name (🎲) and shows the password on request.
- At sign-up every player gets a **secret save code** (12 letters). "Forgot password?" takes the username + save code and sets a new password. A logged-in player can make a new code (needs their password).
- **Log in on another device**: a logged-in player taps it and gets a 6-letter code that works once for 10 minutes. On the other device: Log in → "Got a code from another device?".
- Each game still saves in the browser; logged in, `account.js` copies the save to Supabase every 15 seconds and when the page closes, and pulls it down on any other device. Different progress on two devices asks which to keep.
- Logging out saves everything online, then clears the games off that device.
- Five wrong passwords lock the account for 10 minutes. Ten wrong save codes or link codes from one connection lock those for 15 minutes. At most 5 new accounts per hour from one connection.
- **Frondi Clicker is deliberately left out**: its privacy policy (and the iPhone app) promise no accounts.
- Resetting a password by hand (Supabase SQL editor):
  `update public.accounts set pass_hash = extensions.crypt('NEWPASS', extensions.gen_salt('bf', 8)), failed_logins = 0, locked_until = null where username = 'theirname';`

## PhatCoin (the arcade coin, the heart of the site)

- One coin for all of GH Games, stored in the player's account (`pc_wallets`, every change logged in `pc_log`, all credits go through `pc_credit`).
- Earned (server-capped, so a game can't overpay): **playing any game 2 a minute** (only while someone is touching the screen), win up to 5 (one per 8 s), rebirth 25 (one a minute), daily bonus 20 rising 10 a day in a row to 100 (Perth days), today's top 10 once a day per game (100/50/20, checked automatically after every leaderboard score), **invites** (see below). Most from play in one day: 1000.
- Not logged in: up to 200 sit in a pocket on that device and move into the account on first log-in.
- **Level** = floor(sqrt(PhatCoin earned ever / 25)) + 1. Spending never lowers it.
- **Shop** (`shop_items`, me.html): avatars, frames, name colours and 3 paid site themes (Gold Rush, Galaxy, Jungle; the old 4 themes stay free). Prices live in the `shop_items` table, so change a price or add an item there with no code change (new avatar emoji go in `AVATARS` in account.js; new frames/colours need CSS in account.js).
- In-game shops still work: Steal an Animal's PhatCoin Shop uses `PhatCoin.spend`.
- **Friends**: add by username → they accept → you see their level and what they're playing, a friends leaderboard, and can gift up to 100 PhatCoin a day. Gifts never count towards invite bonuses.
- **Invites**: `ghgames.au/?invite=theirname` (any page). When the new player has earned 100 PhatCoin from actual play, the inviter gets 100 and the new player 50. Max 20 paid invites per player.
- It is not real money and cannot be bought or cashed out.
- Give someone PhatCoin by hand: `update public.pc_wallets w set balance = balance + 100 from public.accounts a where a.id = w.account_id and a.username = 'theirname';`
