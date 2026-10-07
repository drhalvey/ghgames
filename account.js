/* GH Games — player accounts and online saves
   ------------------------------------------------------------------
   Username + password accounts (no email, no real names). Progress is
   still saved in the browser like before; when a player is logged in,
   this script copies each game's save up to the GH Games Supabase
   project and brings it back down on any other device.

   How a game page uses it (put it in <head>, BEFORE the game's own code):
     <script src="account.js" data-game="wall-hop"></script>
   Optional: data-pos="top-left" | "top-right" | "bottom-right" (default bottom-left)
   On the homepage, an element with id="gh-account" gets a Log in button instead.

   To add a new game: add it to GAMES below with the localStorage key(s) it
   saves to. merge:"max" / "min" is for games whose save is just a best score.

   The database only allows calls to the gh_* functions; the tables
   themselves cannot be read or changed from a browser. Passwords are
   stored scrambled (bcrypt). */
(function () {
  "use strict";

  var SB_URL = "https://bpqaeqswtgtbqrczjcrx.supabase.co";
  var SB_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJwcWFlcXN3dGd0YnFyY3pqY3J4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEzMzUzOTIsImV4cCI6MjA5NjkxMTM5Mn0.hsEZJ_C4NvySPMb59G9EPPfdJRSNBODbnuo9ij_zxrI";

  var GAMES = {
    "wall-hop":     { title: "Wall Hop Pets", keys: ["wallhop-pets-v1"] },
    "crazy-dads":   { title: "Crazy Dads",    keys: ["crazydads-save"] },
    "bro-got-slammed": { title: "Bro Got Slammed", keys: ["brogotslammed-save"] },
    "size-simulator": { title: "Size Simulator", keys: ["sizesim-save"] },
    "steal-an-animal": { title: "Steal an Animal", keys: ["stealanimal-save"] },
    "rugby-kicker": { title: "Rugby Kicker", keys: ["rugbykicker-save"] },
    "drop-goal-hero": { title: "Drop Goal Hero", keys: ["dropgoal-save"] },
    "runway-stars": { title: "Runway Stars", keys: ["runwaystars-save"] },
    "plains-of-abraham": { title: "Plains of Abraham", keys: ["plains-save"] },
    "seven-years-war": { title: "Seven Years' War", keys: ["syw-save"] },
    "seven-years-war-classic": { title: "Seven Years' War Classic", keys: ["syw-classic-save"] },
    "save-your-rabbit": { title: "Save Your Rabbit", keys: ["saverabbit-save"] },
    "iron-command": { title: "Iron Command", keys: ["ironcommand-save", "ironcommand-battle"] },
    "poo-simulator": { title: "Poo Simulator", keys: ["poosim-save"] },
    "monster-mayhem": { title: "Monster Mayhem", keys: ["monstermayhem-save"] },
  };

  var TOKEN = "ghacct_token", USER = "ghacct_user", NICK = "ghgames_nick";
  var MARK = "ghacct_sync_", PEND = "ghacct_pending_", WIPE = "ghacct_wipe", BLANK = "ghacct_blank_";
  var justWiped = false;

  var me = document.currentScript;
  var GAME = me && me.dataset.game && GAMES[me.dataset.game] ? me.dataset.game : null;
  var POS = (me && me.dataset.pos) || "bottom-left";

  // ---------- tiny storage helpers (never throw) ----------
  function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  function lsDel(k) { try { localStorage.removeItem(k); } catch (e) {} }
  function jGet(k) { try { return JSON.parse(lsGet(k)); } catch (e) { return null; } }

  function token() { return lsGet(TOKEN); }
  function user() { return lsGet(USER); }

  function readLocal(g) {
    var out = {};
    GAMES[g].keys.forEach(function (k) { var v = lsGet(k); if (v !== null) out[k] = v; });
    return out;
  }
  function writeLocal(g, data) {
    GAMES[g].keys.forEach(function (k) {
      if (data && typeof data[k] === "string") lsSet(k, data[k]); else lsDel(k);
    });
  }
  function sig(data) {
    var o = {}; Object.keys(data || {}).sort().forEach(function (k) { o[k] = data[k]; });
    return JSON.stringify(o);
  }
  function empty(data) { return !data || Object.keys(data).length === 0; }
  function marker(g) { return jGet(MARK + g); }
  function setMarker(g, at, s) { lsSet(MARK + g, JSON.stringify({ at: at, sig: s })); lsDel(BLANK + g); }

  // ---------- runs immediately, before the game's own code ----------
  // A save pulled from the cloud is parked in a "pending" slot and the page
  // reloads; it is written in here, before the game reads its save, so the
  // game's own save-on-exit from the old page cannot overwrite it.
  if (GAME) {
    var wipe = jGet(WIPE) || [];
    if (wipe.indexOf(GAME) >= 0) {
      writeLocal(GAME, {});
      justWiped = true;
      wipe = wipe.filter(function (x) { return x !== GAME; });
      if (wipe.length) lsSet(WIPE, JSON.stringify(wipe)); else lsDel(WIPE);
    }
    var pend = jGet(PEND + GAME);
    if (pend) {
      writeLocal(GAME, pend.data);
      setMarker(GAME, pend.at, sig(pend.data));
      lsDel(PEND + GAME);
    }
  }

  // ---------- server calls ----------
  function rpc(fn, args, keepalive) {
    return fetch(SB_URL + "/rest/v1/rpc/" + fn, {
      method: "POST",
      keepalive: !!keepalive,
      headers: { apikey: SB_KEY, Authorization: "Bearer " + SB_KEY, "Content-Type": "application/json" },
      body: JSON.stringify(args)
    }).then(function (r) {
      return r.text().then(function (t) {
        var body = null; try { body = t ? JSON.parse(t) : null; } catch (e) {}
        if (!r.ok) {
          var code = (body && body.message) || "network";
          if (code === "bad_token") loggedOutByServer();
          throw new Error(code);
        }
        if (body && body.error) throw new Error(body.error);
        return body;
      });
    }, function () { throw new Error("network"); });
  }

  var MSG = {
    bad_name: "Usernames are 3 to 16 letters or numbers (you can use _ too). No spaces.",
    rude_name: "That username is not allowed. Pick a kind one.",
    short_password: "Your password needs at least 6 characters.",
    name_taken: "Someone already has that username. Try adding a number to it.",
    bad_login: "That username or password is not right.",
    locked: "Too many wrong tries. Wait 10 minutes, then try again.",
    too_many: "Too many new accounts made from here today. Try again later.",
    bad_token: "You were logged out. Please log in again.",
    too_big: "This save is too big to put online.",
    locked_out: "Too many wrong tries. Wait 15 minutes, then try again.",
    network: "Can't reach the internet right now. Try again soon."
  };
  function msg(e) { return MSG[e && e.message] || MSG.network; }

  // ---------- syncing ----------
  var reloading = false, busy = false, ready = false, state = "idle";

  function upload(g, data, keepalive) {
    if (!token()) return Promise.resolve();
    return rpc("gh_save", { p_token: token(), p_game: g, p_data: data }, keepalive)
      .then(function (at) { setMarker(g, at, sig(data)); });
  }

  function mergeBest(g, a, b) {
    var out = {}, mode = GAMES[g].merge;
    GAMES[g].keys.forEach(function (k) {
      var x = a[k], y = b[k];
      if (x == null) { if (y != null) out[k] = y; return; }
      if (y == null) { out[k] = x; return; }
      var nx = parseFloat(x), ny = parseFloat(y);
      if (isNaN(nx)) out[k] = y; else if (isNaN(ny)) out[k] = x;
      else out[k] = (mode === "min" ? (ny < nx ? y : x) : (ny > nx ? y : x));
    });
    return out;
  }

  // live = this game is running on this page (so taking the cloud copy needs a reload)
  function useCloud(g, cloud, live) {
    if (live) {
      reloading = true;
      lsSet(PEND + g, JSON.stringify({ data: cloud.data, at: cloud.updated_at }));
      setStatus("loading");
      setTimeout(function () { location.reload(); }, 400);
    } else {
      writeLocal(g, cloud.data);
      setMarker(g, cloud.updated_at, sig(cloud.data));
    }
  }

  function syncGame(g, cloud, live) {
    var local = readLocal(g), ls = sig(local), mk = marker(g);
    // a brand-new-game save written after logging out counts as no progress
    if (!mk && lsGet(BLANK + g) === ls) { local = {}; ls = sig(local); }
    if (!cloud) return empty(local) ? Promise.resolve() : upload(g, local);
    var cs = sig(cloud.data);
    if (cs === ls) { setMarker(g, cloud.updated_at, ls); return Promise.resolve(); }

    if (GAMES[g].merge) {
      var m = mergeBest(g, local, cloud.data), ms = sig(m);
      var p = ms !== cs ? upload(g, m) : Promise.resolve(setMarker(g, cloud.updated_at, ms));
      return p.then(function () {
        if (ms !== ls) useCloud(g, { data: m, updated_at: marker(g).at }, live);
      });
    }

    var cloudChanged = !mk || mk.at !== cloud.updated_at;
    var localChanged = mk ? ls !== mk.sig : !empty(local);
    if (!cloudChanged) return localChanged ? upload(g, local) : Promise.resolve();
    if (!localChanged) { useCloud(g, cloud, live); return Promise.resolve(); }
    return askWhich(g, cloud.updated_at).then(function (pick) {
      if (pick === "cloud") useCloud(g, cloud, live); else return upload(g, local);
    });
  }

  function syncAll(liveGame) {
    if (!token()) return Promise.resolve();
    setStatus("saving");
    return rpc("gh_load", { p_token: token(), p_game: null }).then(function (res) {
      var names = Object.keys(GAMES), chain = Promise.resolve();
      // the game on this page goes last, because taking its cloud copy reloads the page
      names.sort(function (a, b) { return (a === liveGame) - (b === liveGame); });
      names.forEach(function (g) {
        chain = chain.then(function () { return syncGame(g, res.saves[g], g === liveGame); });
      });
      return chain;
    }).then(function () { ready = true; if (!reloading) setStatus("saved"); },
            function (e) { setStatus(token() ? "offline" : "out"); throw e; });
  }

  function syncThisGame() {
    if (!GAME || !token()) return Promise.resolve();
    setStatus("saving");
    return rpc("gh_load", { p_token: token(), p_game: GAME })
      .then(function (res) { return syncGame(GAME, res.saves[GAME], true); })
      .then(function () { ready = true; if (!reloading) setStatus("saved"); },
            function () { setStatus(token() ? "offline" : "out"); });
  }

  function pushIfChanged(keepalive) {
    if (!GAME || !token() || !ready || reloading || busy) return;
    var local = readLocal(GAME), mk = marker(GAME);
    if (mk ? sig(local) === mk.sig : empty(local)) { if (state !== "saved") setStatus("saved"); return; }
    busy = true; setStatus("saving");
    upload(GAME, local, keepalive).then(function () { setStatus("saved"); },
      function () { setStatus(token() ? "offline" : "out"); })
      .then(function () { busy = false; });
  }

  function clearSession() {
    lsDel(TOKEN); lsDel(USER); lsDel(LOOK);
    Object.keys(GAMES).forEach(function (g) { lsDel(MARK + g); lsDel(PEND + g); });
  }
  function loggedOutByServer() { clearSession(); ready = false; setStatus("out"); }

  // ---------- account actions ----------
  function afterLogin(res) {
    lsSet(TOKEN, res.token); lsSet(USER, res.username); lsDel(WIPE); lsSet(KNOWN, "1"); lsDel(LOOK);
    refreshLook();
    Object.keys(GAMES).forEach(function (g) { lsDel(MARK + g); });
    if (!lsGet(NICK) && res.username.length <= 12) lsSet(NICK, res.username);
    return syncAll(GAME);
  }

  function logOut() {
    // put everything safely online first; only then clear this device
    setStatus("saving");
    return rpc("gh_load", { p_token: token(), p_game: null }).then(function (res) {
      var jobs = Object.keys(GAMES).map(function (g) {
        var local = readLocal(g), mk = marker(g), cloud = res.saves[g];
        if (empty(local)) return null;
        if (!cloud && !mk) return upload(g, local);
        if (mk && cloud && mk.at === cloud.updated_at && sig(local) !== mk.sig) return upload(g, local);
        return null;
      });
      return Promise.all(jobs);
    }).then(function () {
      var t = token();
      rpc("gh_logout", { p_token: t }).catch(function () {});
      Object.keys(GAMES).forEach(function (g) { writeLocal(g, {}); });
      clearSession();
      // each game clears itself again the next time it opens, in case it
      // was running and re-saved on the way out
      lsSet(WIPE, JSON.stringify(Object.keys(GAMES)));
      if (GAME) { reloading = true; location.reload(); }
      else setStatus("out");
    });
  }

  // ---------- looks: avatar, name colour, frame (bought with PhatCoin) ----------
  var AVATARS = {
    fox: "🦊", frog: "🐸", panda: "🐼", tiger: "🐯", dog: "🐶", cat: "🐱", rabbit: "🐰", lion: "🦁",
    octopus: "🐙", robot: "🤖", alien: "👽", shark: "🦈", wolf: "🐺", unicorn: "🦄", dino: "🦖",
    ninja: "🥷", dragon: "🐉", six7: "67", goat: "🐐", crown: "👑", gem: "💎"
  };
  var LOOK = "ghacct_look", KNOWN = "ghacct_known", INVITE = "gh_invite", RECENT = "gh_recent";
  function look() { return jGet(LOOK) || { avatar: "fox", color: "white", frame: "none", owned: [], level: 1 }; }
  function setLook(p) {
    if (!p) return;
    var l = look();
    ["avatar", "color", "frame", "owned", "level", "lifetime"].forEach(function (k) { if (p[k] != null) l[k] = p[k]; });
    lsSet(LOOK, JSON.stringify(l));
    lookListeners.forEach(function (f) { try { f(l); } catch (e) {} });
    setStatus(state);
  }
  var lookListeners = [];
  function face(p, size) {
    p = p || look(); size = size || 28;
    var a = AVATARS[p.avatar] || AVATARS.fox, txt = p.avatar === "six7";
    return '<span class="ghl-face ghl-f-' + esc(p.frame || "none") + '" style="--s:' + size + 'px">'
      + '<span class="ghl-in' + (txt ? " ghl-txt" : "") + '">' + a + "</span></span>";
  }
  function nameHtml(p) { p = p || {}; return '<span class="ghl-name ghl-c-' + esc(p.color || "white") + '">' + esc(p.username || user() || "") + "</span>"; }
  function level(lifetime) { return Math.floor(Math.sqrt(Math.max(0, lifetime || 0) / 25)) + 1; }
  function levelStart(n) { return 25 * (n - 1) * (n - 1); }

  function refreshLook() {
    if (!token()) return Promise.resolve(null);
    return rpc("gh_profile", { p_token: token() }).then(function (p) { setLook(p); return p; }, function () { return null; });
  }

  // ---------- friendly names ----------
  var ADJ = ["rocket", "turbo", "mega", "super", "cosmic", "epic", "lucky", "speedy", "golden", "sneaky", "mighty", "pixel", "laser", "thunder", "frosty", "blazing", "jolly", "hyper", "shadow", "storm"];
  var ANI = ["fox", "panda", "tiger", "shark", "otter", "falcon", "gecko", "wombat", "koala", "dingo", "croc", "eagle", "yeti", "dragon", "llama", "moose", "puffin", "rhino", "quokka", "bunny"];
  function pick(a) { return a[Math.floor(Math.random() * a.length)]; }
  function suggestName() {
    for (var i = 0; i < 20; i++) {
      var n = pick(ADJ) + "_" + pick(ANI) + (10 + Math.floor(Math.random() * 90));
      if (n.length <= 16) return n;
    }
    return "player" + Math.floor(Math.random() * 99999);
  }

  // ---------- invite links: ghgames.au/?invite=name ----------
  (function () {
    try {
      var m = /[?&]invite=([a-z0-9_]{3,16})/i.exec(location.search);
      if (m && !lsGet(TOKEN)) lsSet(INVITE, m[1].toLowerCase());
    } catch (e) {}
  })();
  function inviteUrl() { return "https://ghgames.au/?invite=" + encodeURIComponent(user() || ""); }

  // ---------- share (the iPad / phone share sheet, or copy) ----------
  function share(opts) {
    opts = opts || {};
    var data = { title: opts.title || "GH Games", text: opts.text || "Come and play GH Games with me!", url: opts.url || "https://ghgames.au/" };
    if (window.gtag) window.gtag("event", "share", { what: opts.what || "site" });
    if (navigator.share) return navigator.share(data).then(function () { return "shared"; }, function () { return "cancelled"; });
    var t = data.text + " " + data.url;
    return (navigator.clipboard ? navigator.clipboard.writeText(t) : Promise.reject()).then(function () {
      flash("Link copied. Paste it to your friends!"); return "copied";
    }, function () { window.prompt("Copy this link:", data.url); return "shown"; });
  }
  function flash(text) {
    if (!document.body) return;
    var d = document.createElement("div"); d.className = "gha-flash"; d.textContent = text;
    document.body.appendChild(d); setTimeout(function () { d.remove(); }, 2600);
  }

  // ---------- recently played (for "Continue playing" on the homepage) ----------
  if (GAME) {
    var rec = (jGet(RECENT) || []).filter(function (x) { return x && x.g !== GAME; });
    rec.unshift({ g: GAME, at: Date.now() });
    lsSet(RECENT, JSON.stringify(rec.slice(0, 8)));
  }

  // ---------- UI ----------
  var CSS = ""
    + ".gha-pill{position:fixed;z-index:2147483000;display:flex;align-items:center;gap:7px;font:600 13px/1 system-ui,-apple-system,'Segoe UI',sans-serif;"
    + "color:#f2f3f7;background:rgba(14,16,23,.72);border:1px solid rgba(255,255,255,.18);border-radius:999px;padding:5px 11px 5px 5px;cursor:pointer;"
    + "backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);-webkit-tap-highlight-color:transparent;user-select:none;-webkit-user-select:none;max-width:56vw}"
    + ".gha-pill.out{padding:7px 11px}"
    + ".gha-short{display:none}"
    + "@media (max-width:600px){.gha-pill:not(.out) .gha-un{display:none}.gha-long{display:none}.gha-short{display:inline}}"
    + ".gha-pill .gha-un{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}"
    + ".gha-pill.bottom-left{left:max(10px,env(safe-area-inset-left));bottom:max(10px,env(safe-area-inset-bottom))}"
    + ".gha-pill.bottom-right{right:max(10px,env(safe-area-inset-right));bottom:max(10px,env(safe-area-inset-bottom))}"
    + ".gha-pill.top-left{left:max(10px,env(safe-area-inset-left));top:max(10px,env(safe-area-inset-top))}"
    + ".gha-pill.top-right{right:max(10px,env(safe-area-inset-right));top:max(10px,env(safe-area-inset-top))}"
    + ".gha-dot{width:8px;height:8px;border-radius:50%;background:#9aa0b4;flex:none}"
    + ".gha-dot.saved{background:#3ddc84}.gha-dot.saving,.gha-dot.loading{background:#ffcc33}.gha-dot.offline{background:#ff5a5f}"
    + ".gha-coins{display:inline-flex;align-items:center;gap:3px;color:#ffd54a;font-weight:800}"
    + ".gha-coins i{width:13px;height:13px;border-radius:50%;background:radial-gradient(circle at 35% 35%,#ffe680,#f5b400 60%,#c98a00);display:inline-block;box-shadow:inset 0 0 0 1.5px #c98a00}"
    + ".gha-btn{font:600 15px/1 'Rubik',system-ui,sans-serif;color:#0e1017;background:#ffcc33;border:0;border-radius:999px;padding:9px 16px;cursor:pointer;white-space:nowrap;display:inline-flex;align-items:center;gap:7px}"
    + ".gha-btn.ghost{background:#1f2330;color:#f2f3f7;border:1px solid #2a2f3f}"
    + ".gha-btn.me{padding:4px 12px 4px 4px}"
    + ".gha-btn[disabled]{opacity:.55;cursor:default}"
    + ".gha-bg{position:fixed;inset:0;z-index:2147483600;background:rgba(0,0,0,.6);display:flex;align-items:center;justify-content:center;padding:16px}"
    + ".gha-box{width:100%;max-width:390px;max-height:calc(100vh - 32px);overflow:auto;background:#171a24;color:#f2f3f7;border:1px solid #2a2f3f;border-radius:18px;"
    + "padding:20px;font:400 15px/1.45 'Rubik',system-ui,-apple-system,'Segoe UI',sans-serif;box-shadow:0 20px 60px rgba(0,0,0,.5);text-align:left;position:relative}"
    + ".gha-box h2{font:400 26px/1.1 'Lilita One',system-ui,sans-serif;margin:0 0 6px;letter-spacing:.3px;display:flex;align-items:center;gap:10px}"
    + ".gha-box p{margin:0 0 12px;color:#9aa0b4;font-size:14px}"
    + ".gha-box b{color:#f2f3f7}"
    + ".gha-x{position:absolute;top:10px;right:10px;width:34px;height:34px;border-radius:50%;border:0;background:#1f2330;color:#9aa0b4;font-size:18px;cursor:pointer}"
    + ".gha-tabs{display:flex;gap:6px;margin:0 0 14px}"
    + ".gha-tabs button{flex:1;font-family:inherit;font-weight:600;font-size:14px;line-height:1;padding:10px 0;border-radius:10px;border:1px solid #2a2f3f;background:#1f2330;color:#9aa0b4;cursor:pointer}"
    + ".gha-tabs button.on{background:#ffcc33;border-color:#ffcc33;color:#0e1017}"
    + ".gha-box label{display:block;font-size:13px;color:#9aa0b4;margin:10px 0 4px}"
    + ".gha-in{position:relative;display:flex;gap:6px}"
    + ".gha-box input{width:100%;box-sizing:border-box;font-family:inherit;font-weight:500;font-size:17px;line-height:1.2;color:#f2f3f7;background:#0e1017;border:1px solid #2a2f3f;border-radius:10px;padding:11px 12px;outline:none}"
    + ".gha-box input:focus{border-color:#ffcc33}"
    + ".gha-box input.code{font:700 26px/1 ui-monospace,Menlo,monospace;letter-spacing:6px;text-align:center;text-transform:uppercase}"
    + ".gha-sq{flex:none;width:48px;border-radius:10px;border:1px solid #2a2f3f;background:#1f2330;color:#f2f3f7;font-size:20px;cursor:pointer}"
    + ".gha-row{display:flex;gap:8px;margin-top:16px;flex-wrap:wrap}.gha-row .gha-btn{flex:1;padding:12px 10px;justify-content:center}"
    + ".gha-err{color:#ff8a8d;font-size:14px;margin-top:10px;min-height:1em}"
    + ".gha-ok{color:#3ddc84;font-size:14px;margin-top:10px}"
    + ".gha-small{font-size:12.5px;color:#6f7690;margin-top:14px}"
    + ".gha-links{display:flex;flex-wrap:wrap;justify-content:space-between;gap:4px 12px;margin-top:12px}"
    + ".gha-link{background:none;border:0;color:#9aa0b4;text-decoration:underline;font:inherit;font-size:13px;cursor:pointer;padding:6px 0}"
    + ".gha-link.red{color:#ff8a8d}"
    + ".gha-choice{display:flex;align-items:center;gap:12px;width:100%;text-align:left;margin-top:10px;padding:13px 14px;border-radius:12px;border:1px solid #2a2f3f;background:#1f2330;color:#f2f3f7;font:inherit;cursor:pointer;text-decoration:none;box-sizing:border-box}"
    + ".gha-choice small{display:block;color:#9aa0b4;font-size:12.5px;margin-top:2px}"
    + ".gha-choice .ic{font-size:22px;width:28px;text-align:center;flex:none}"
    + ".gha-big{font:800 28px/1.1 ui-monospace,Menlo,monospace;letter-spacing:4px;text-align:center;background:#0e1017;border:2px dashed #ffcc33;color:#ffcc33;border-radius:14px;padding:16px 8px;margin:6px 0 10px;user-select:all;-webkit-user-select:all}"
    + ".gha-invite{background:linear-gradient(135deg,#3a2d0c,#1f2330);border:1px solid #6b5418;border-radius:12px;padding:10px 12px;margin:0 0 12px;font-size:14px;color:#ffe9a6}"
    + ".gha-flash{position:fixed;z-index:2147483647;left:50%;bottom:max(70px,calc(env(safe-area-inset-bottom) + 70px));transform:translateX(-50%);background:#171a24;color:#f2f3f7;border:1px solid #3ddc84;"
    + "border-radius:12px;padding:10px 16px;font:600 14px/1.3 system-ui,sans-serif;box-shadow:0 10px 30px rgba(0,0,0,.5);max-width:90vw;text-align:center}"
    // avatar faces and frames
    + ".ghl-face{--s:28px;position:relative;display:inline-grid;place-items:center;width:var(--s);height:var(--s);border-radius:50%;flex:none;background:#2a2f45;box-sizing:border-box}"
    + ".ghl-in{font-size:calc(var(--s)*.62);line-height:1;font-family:'Apple Color Emoji','Segoe UI Emoji','Noto Color Emoji',sans-serif}"
    + ".ghl-in.ghl-txt{font:900 calc(var(--s)*.42)/1 'Lilita One',system-ui,sans-serif;color:#b8ff3c;letter-spacing:-.5px}"
    + ".ghl-f-bronze{box-shadow:0 0 0 calc(var(--s)*.07) #cd7f32}"
    + ".ghl-f-silver{box-shadow:0 0 0 calc(var(--s)*.07) #d9e0ea,0 0 calc(var(--s)*.2) rgba(217,224,234,.45)}"
    + ".ghl-f-gold{box-shadow:0 0 0 calc(var(--s)*.08) #ffcc33,0 0 calc(var(--s)*.3) rgba(255,204,51,.6)}"
    + ".ghl-f-neon{box-shadow:0 0 0 calc(var(--s)*.07) #37e2d5,0 0 calc(var(--s)*.35) #ff4fd8;animation:ghlNeon 1.6s ease-in-out infinite alternate}"
    + ".ghl-f-flames::before,.ghl-f-diamond::before{content:'';position:absolute;inset:calc(var(--s)*-.1);border-radius:50%;z-index:-1;animation:ghlSpin 2.4s linear infinite}"
    + ".ghl-f-flames::before{background:conic-gradient(#ff4d2e,#ffcc33,#ff7a2f,#ff2e63,#ffcc33,#ff4d2e);filter:blur(1px)}"
    + ".ghl-f-flames{isolation:isolate;box-shadow:0 0 calc(var(--s)*.35) rgba(255,90,40,.7)}"
    + ".ghl-f-diamond::before{background:conic-gradient(#a8f4ff,#ffffff,#c9a8ff,#7cc8ff,#ffffff,#a8f4ff)}"
    + ".ghl-f-diamond{isolation:isolate;box-shadow:0 0 calc(var(--s)*.45) rgba(168,244,255,.75)}"
    + "@keyframes ghlSpin{to{transform:rotate(360deg)}}"
    + "@keyframes ghlNeon{to{box-shadow:0 0 0 calc(var(--s)*.07) #ff4fd8,0 0 calc(var(--s)*.35) #37e2d5}}"
    + ".ghl-name{font-weight:700}"
    + ".ghl-c-white{color:#f2f3f7}.ghl-c-sky{color:#7cc8ff}.ghl-c-lime{color:#b8ff3c}.ghl-c-pink{color:#ff7ac8}.ghl-c-gold{color:#ffcc33}"
    + ".ghl-c-fire,.ghl-c-ice,.ghl-c-rainbow{-webkit-background-clip:text;background-clip:text;color:transparent}"
    + ".ghl-c-fire{background-image:linear-gradient(90deg,#ffe066,#ff7a2f,#ff2e63)}"
    + ".ghl-c-ice{background-image:linear-gradient(90deg,#ffffff,#7cc8ff,#b39bff)}"
    + ".ghl-c-rainbow{background-image:linear-gradient(90deg,#ff5a5f,#ffcc33,#3ddc84,#37a2ff,#b36bff,#ff5a5f);background-size:200% 100%;animation:ghlRain 3s linear infinite}"
    + "@keyframes ghlRain{to{background-position:200% 0}}"
    + "@media (prefers-reduced-motion:reduce){.ghl-f-flames::before,.ghl-f-diamond::before,.ghl-f-neon,.ghl-c-rainbow{animation:none}}";

  function injectCSS() {
    if (document.getElementById("gha-css")) return;
    var s = document.createElement("style"); s.id = "gha-css"; s.textContent = CSS;
    (document.head || document.documentElement).appendChild(s);
  }
  function esc(t) { var d = document.createElement("div"); d.textContent = t == null ? "" : String(t); return d.innerHTML; }
  function when(at) {
    try { return new Date(at).toLocaleString(undefined, { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }); }
    catch (e) { return ""; }
  }
  function coins() { return window.PhatCoin ? window.PhatCoin.balance() : null; }
  function coinHtml() { var c = coins(); if (document.querySelector(".pc-pill")) return ""; return c == null ? "" : '<span class="gha-coins"><i></i>' + Number(c).toLocaleString() + "</span>"; }

  var pill = null, slot = null;
  var LABEL = { out: "Log in to save", saving: "Saving…", loading: "Loading your save…", offline: "Offline" };

  function setStatus(s) {
    state = token() ? s : "out";
    if (pill) {
      var name = user();
      pill.className = "gha-pill " + POS + (state === "out" ? " out" : "");
      pill.innerHTML = state === "out"
        ? '<i class="gha-dot out"></i><span>☁️ ' + esc(LABEL.out) + "</span>" + (coins() ? " " + coinHtml() : "")
        : face(look(), 26) + '<span class="gha-un">' + esc(state === "saved" || state === "idle" ? name : LABEL[state] || name) + "</span>"
          + '<i class="gha-dot ' + state + '"></i>' + coinHtml();
      pill.title = state === "out" ? "Log in to save your progress online" : "Logged in as " + name;
    }
    if (slot) {
      slot.innerHTML = token()
        ? '<button class="gha-btn ghost me" type="button">' + face(look(), 28) + '<span class="gha-un">' + esc(user()) + "</span>" + coinHtml() + "</button>"
        : '<button class="gha-btn" type="button"><span class="gha-long">Play with an account</span><span class="gha-short">Log in</span></button>';
      slot.firstChild.onclick = openAccount;
    }
  }

  var openBox = null;
  function modal(html, noClose) {
    closeModal();
    var bg = document.createElement("div"); bg.className = "gha-bg";
    bg.innerHTML = '<div class="gha-box" role="dialog" aria-modal="true">' + (noClose ? "" : '<button class="gha-x" type="button" aria-label="Close">✕</button>') + html + "</div>";
    // stop taps reaching the game underneath
    ["pointerdown", "mousedown", "touchstart", "keydown", "click"].forEach(function (ev) {
      bg.addEventListener(ev, function (e) { e.stopPropagation(); }, false);
    });
    document.body.appendChild(bg); openBox = bg;
    var x = bg.querySelector(".gha-x"); if (x) x.onclick = closeModal;
    return bg.firstChild;
  }
  function closeModal() { if (openBox) { openBox.remove(); openBox = null; } }

  function openAccount(mode) { if (token()) accountView(); else loginView(typeof mode === "string" ? mode : (lsGet(KNOWN) ? "login" : "new")); }

  function eyeToggle(box) {
    box.querySelectorAll(".eye").forEach(function (b) {
      b.onclick = function () { var i = b.parentNode.querySelector("input"); i.type = i.type === "password" ? "text" : "password"; b.textContent = i.type === "password" ? "👁" : "🙈"; };
    });
  }

  function loginView(mode) {
    var isNew = mode === "new", inv = lsGet(INVITE);
    var box = modal(
      '<h2>' + (isNew ? "Make your account" : "Welcome back") + "</h2>"
      + (isNew && inv ? '<div class="gha-invite">🎁 <b>' + esc(inv) + '</b> invited you. Play for a bit and you both get bonus PhatCoin!</div>' : "")
      + "<p>" + (isNew ? "Takes 10 seconds. Your games and PhatCoin save online, on any device. No email, no real name."
                       : "Log in to get your games and PhatCoin on this device.") + "</p>"
      + '<div class="gha-tabs"><button data-m="new" class="' + (isNew ? "on" : "") + '">New account</button>'
      + '<button data-m="login" class="' + (isNew ? "" : "on") + '">Log in</button></div>'
      + '<label>' + (isNew ? "Your player name" : "Username") + '</label><div class="gha-in"><input class="u" autocomplete="username" autocapitalize="none" autocorrect="off" spellcheck="false" maxlength="16" placeholder="e.g. rocket_fox">'
      + (isNew ? '<button class="gha-sq dice" type="button" title="Pick a name for me" aria-label="Pick a name for me">🎲</button>' : "") + "</div>"
      + '<label>Password</label><div class="gha-in"><input class="p" type="password" autocomplete="' + (isNew ? "new-password" : "current-password") + '" maxlength="72" placeholder="at least 6 characters">'
      + '<button class="gha-sq eye" type="button" aria-label="Show password">👁</button></div>'
      + '<div class="gha-err"></div>'
      + '<div class="gha-row"><button class="gha-btn go" type="button">' + (isNew ? "Make my account" : "Log in") + "</button></div>"
      + '<div class="gha-links">'
      + (isNew ? '<button class="gha-link tolog" type="button">I already have an account</button>'
               : '<button class="gha-link forgot" type="button">Forgot password?</button>')
      + '<button class="gha-link code" type="button">Got a code from another device?</button></div>'
      + (isNew ? '<div class="gha-small">Don\'t use your real name. We only keep your player name, a scrambled copy of your password, your game progress and PhatCoin.</div>' : ""));
    var u = box.querySelector(".u"), p = box.querySelector(".p"), err = box.querySelector(".gha-err"), go = box.querySelector(".go");
    box.querySelectorAll(".gha-tabs button").forEach(function (b) { b.onclick = function () { loginView(b.dataset.m); }; });
    var tl = box.querySelector(".tolog"); if (tl) tl.onclick = function () { loginView("login"); };
    var fg = box.querySelector(".forgot"); if (fg) fg.onclick = function () { recoverView(u.value); };
    box.querySelector(".code").onclick = codeEnterView;
    var dice = box.querySelector(".dice");
    if (dice) { u.value = suggestName(); dice.onclick = function () { u.value = suggestName(); dice.animate && dice.animate([{ transform: "rotate(0)" }, { transform: "rotate(360deg)" }], 350); }; }
    eyeToggle(box);
    u.addEventListener("input", function () { var v = u.value.toLowerCase().replace(/[^a-z0-9_]/g, ""); if (v !== u.value) u.value = v; });
    function submit() {
      err.textContent = "";
      if (u.value.length < 3) { err.textContent = MSG.bad_name; return; }
      if (p.value.length < 6) { err.textContent = MSG.short_password; return; }
      go.disabled = true; go.textContent = "…";
      var call = isNew ? rpc("gh_signup2", { p_username: u.value, p_password: p.value, p_invite: inv || null })
                       : rpc("gh_login", { p_username: u.value, p_password: p.value });
      call.then(function (res) {
          if (window.gtag) window.gtag("event", isNew ? "sign_up" : "login", { invited: !!inv });
          if (isNew) lsDel(INVITE);
          closeModal(); setStatus("saving");
          var done = afterLogin(res).catch(function () {});
          if (isNew && res.recovery) recoveryView(res.recovery, true);
          return done;
        })
        .catch(function (e) { err.textContent = msg(e); go.disabled = false; go.textContent = isNew ? "Make my account" : "Log in"; });
    }
    go.onclick = submit;
    [u, p].forEach(function (i) { i.addEventListener("keydown", function (e) { if (e.key === "Enter") { e.preventDefault(); submit(); } }); });
    setTimeout(function () { (isNew ? p : u).focus(); }, 60);
  }

  function recoveryView(code, fresh) {
    var pretty = code.replace(/(.{4})(?=.)/g, "$1-");
    var box = modal(
      "<h2>🔑 Your secret save code</h2>"
      + "<p>" + (fresh ? "You're in! " : "") + "If you ever forget your password, this code gets you back in. <b>Take a screenshot</b> or ask a grown-up to write it down.</p>"
      + '<div class="gha-big">' + esc(pretty) + "</div>"
      + "<p>Keep it secret. Anyone with your name and this code can get into your account.</p>"
      + '<div class="gha-row"><button class="gha-btn ghost cp" type="button">Copy</button><button class="gha-btn ok" type="button">I\'ve saved it</button></div>', true);
    box.querySelector(".cp").onclick = function () {
      var b = this;
      (navigator.clipboard ? navigator.clipboard.writeText(pretty) : Promise.reject()).then(function () { b.textContent = "Copied ✓"; }, function () { b.textContent = "Select it above"; });
    };
    box.querySelector(".ok").onclick = function () {
      closeModal();
      if (fresh) welcomeView();
    };
  }

  function welcomeView() {
    var box = modal(
      "<h2>" + face(look(), 40) + " Hi " + esc(user()) + "!</h2>"
      + "<p>Every game now saves online and earns you <b>PhatCoin</b>. Spend it on avatars, frames, name colours and themes.</p>"
      + '<a class="gha-choice" href="me.html#shop"><span class="ic">🛍️</span><span><b>Open the shop</b><small>Pick a free avatar or save up for a dragon</small></span></a>'
      + '<button class="gha-choice inv" type="button"><span class="ic">🎁</span><span><b>Invite a friend</b><small>You get 100 PhatCoin when they start playing</small></span></button>'
      + '<div class="gha-row"><button class="gha-btn ok" type="button">Let\'s play</button></div>');
    box.querySelector(".ok").onclick = closeModal;
    box.querySelector(".inv").onclick = function () { share({ what: "invite", text: "Come and play GH Games with me! Use my link and we both get PhatCoin.", url: inviteUrl() }); };
  }

  function recoverView(name) {
    var box = modal(
      "<h2>Forgot password?</h2>"
      + "<p>Type your username and the <b>secret save code</b> you got when you made your account, then pick a new password.</p>"
      + '<label>Username</label><input class="u" autocapitalize="none" autocorrect="off" spellcheck="false" maxlength="16">'
      + '<label>Secret save code</label><input class="c" autocapitalize="characters" autocorrect="off" spellcheck="false" maxlength="20" placeholder="XXXX-XXXX-XXXX">'
      + '<label>New password</label><div class="gha-in"><input class="p" type="password" autocomplete="new-password" maxlength="72" placeholder="at least 6 characters"><button class="gha-sq eye" type="button" aria-label="Show password">👁</button></div>'
      + '<div class="gha-err"></div>'
      + '<div class="gha-row"><button class="gha-btn ghost back" type="button">Back</button><button class="gha-btn go" type="button">Reset</button></div>'
      + '<div class="gha-small">Lost the code too? A grown-up can email ejhalvey@gmail.com to reset it.</div>');
    var u = box.querySelector(".u"), err = box.querySelector(".gha-err");
    u.value = name || "";
    eyeToggle(box);
    box.querySelector(".back").onclick = function () { loginView("login"); };
    box.querySelector(".go").onclick = function () {
      var g = this; g.disabled = true; err.textContent = "";
      rpc("gh_recover", { p_username: u.value, p_code: box.querySelector(".c").value, p_new: box.querySelector(".p").value }).then(function (res) {
        closeModal(); setStatus("saving");
        afterLogin(res).catch(function () {});
        recoveryView(res.recovery, false);
      }, function (e) {
        g.disabled = false;
        err.textContent = e.message === "bad_code" ? "That username and code don't match." : msg(e);
      });
    };
  }

  function codeEnterView() {
    var box = modal(
      "<h2>📲 Log in with a code</h2>"
      + "<p>On the device where you're already logged in, open your account and tap <b>Log in on another device</b>. Type the 6-letter code here.</p>"
      + '<input class="c code" maxlength="6" autocapitalize="characters" autocorrect="off" spellcheck="false" autocomplete="one-time-code" inputmode="text" placeholder="······">'
      + '<div class="gha-err"></div>'
      + '<div class="gha-row"><button class="gha-btn ghost back" type="button">Back</button><button class="gha-btn go" type="button">Log in</button></div>');
    var c = box.querySelector(".c"), err = box.querySelector(".gha-err"), go = box.querySelector(".go");
    box.querySelector(".back").onclick = function () { loginView("login"); };
    function submit() {
      err.textContent = ""; go.disabled = true;
      rpc("gh_link_use", { p_code: c.value }).then(function (res) {
        closeModal(); setStatus("saving"); return afterLogin(res).catch(function () {});
      }, function (e) { go.disabled = false; err.textContent = e.message === "bad_code" ? "That code didn't work. Codes only last 10 minutes." : msg(e); });
    }
    c.addEventListener("input", function () { c.value = c.value.toUpperCase().replace(/[^A-Z0-9]/g, ""); if (c.value.length === 6) submit(); });
    go.onclick = submit;
    setTimeout(function () { c.focus(); }, 60);
  }

  function linkMakeView() {
    var box = modal("<h2>📲 Log in on another device</h2><p>Making a code…</p>");
    rpc("gh_link_make", { p_token: token() }).then(function (r) {
      var left = r.expires_in, t;
      box = modal(
        "<h2>📲 Log in on another device</h2>"
        + "<p>On the other iPad, phone or computer, go to <b>ghgames.au</b>, tap <b>Play with an account</b>, then <b>Got a code from another device?</b> and type:</p>"
        + '<div class="gha-big">' + esc(r.code) + "</div>"
        + '<p class="tm">Works once, for 10 minutes.</p>'
        + '<div class="gha-row"><button class="gha-btn ghost back" type="button">Back</button></div>');
      box.querySelector(".back").onclick = function () { clearInterval(t); accountView(); };
      var tm = box.querySelector(".tm");
      t = setInterval(function () {
        left--; if (!document.body.contains(tm)) { clearInterval(t); return; }
        tm.textContent = left > 0 ? "Works once. Runs out in " + Math.floor(left / 60) + ":" + ("0" + left % 60).slice(-2) + "." : "This code has run out. Go back and make a new one.";
        if (left <= 0) clearInterval(t);
      }, 1000);
    }, function (e) { box.querySelector("p").textContent = msg(e); });
  }

  function accountView(note) {
    var l = look(), pageName = GAME ? GAMES[GAME].title : "GH Games";
    var box = modal(
      "<h2>" + face(l, 44) + "<span>" + nameHtml({ username: user(), color: l.color }) + '<small style="display:block;font:500 13px Rubik,system-ui;color:#9aa0b4;margin-top:4px">Level ' + (l.level || 1) + (coins() != null ? " · " + Number(coins()).toLocaleString() + " PhatCoin" : "") + "</small></span></h2>"
      + "<p>Your progress saves online by itself, so you can carry on from any device.</p>"
      + (note ? '<div class="gha-ok">' + esc(note) + "</div>" : "")
      + '<a class="gha-choice" href="me.html"><span class="ic">🧑‍🚀</span><span><b>My profile, shop and friends</b><small>Spend PhatCoin, add friends, send gifts</small></span></a>'
      + '<button class="gha-choice sh" type="button"><span class="ic">📤</span><span><b>Share ' + esc(pageName) + '</b><small>Send it to a friend. You get 100 PhatCoin when they start playing</small></span></button>'
      + '<button class="gha-choice ln" type="button"><span class="ic">📲</span><span><b>Log in on another device</b><small>Get a 6-letter code. No typing passwords</small></span></button>'
      + '<div class="gha-err"></div>'
      + '<div class="gha-row"><button class="gha-btn ghost out" type="button">Log out</button>'
      + '<button class="gha-btn x" type="button">Done</button></div>'
      + '<div class="gha-links">'
      + '<button class="gha-link pw" type="button">Change password</button>'
      + '<button class="gha-link rc" type="button">New save code</button>'
      + '<button class="gha-link red del" type="button">Delete account</button></div>');
    var err = box.querySelector(".gha-err");
    box.querySelector(".x").onclick = closeModal;
    box.querySelector(".pw").onclick = passwordView;
    box.querySelector(".rc").onclick = newRecoveryView;
    box.querySelector(".del").onclick = deleteView;
    box.querySelector(".ln").onclick = linkMakeView;
    box.querySelector(".sh").onclick = function () {
      var u = GAME ? "https://ghgames.au/" + GAME + ".html?invite=" + encodeURIComponent(user()) : inviteUrl();
      share({ what: GAME || "site", title: pageName, text: "Play " + pageName + " with me on GH Games!", url: u });
    };
    box.querySelector(".out").onclick = function () {
      var b = this; b.disabled = true; b.textContent = "Saving…";
      logOut().then(closeModal, function (e) {
        err.textContent = msg(e) + " You're still logged in so nothing is lost.";
        b.disabled = false; b.textContent = "Log out"; setStatus(token() ? "offline" : "out");
      });
    };
    refreshLook();
  }

  function newRecoveryView() {
    var box = modal(
      "<h2>🔑 New save code</h2>"
      + "<p>Lost your secret save code? Type your password to get a new one. The old code stops working.</p>"
      + '<label>Password</label><div class="gha-in"><input class="p" type="password" autocomplete="current-password" maxlength="72"><button class="gha-sq eye" type="button" aria-label="Show password">👁</button></div>'
      + '<div class="gha-err"></div>'
      + '<div class="gha-row"><button class="gha-btn ghost back" type="button">Back</button><button class="gha-btn go" type="button">Get new code</button></div>');
    eyeToggle(box);
    var err = box.querySelector(".gha-err");
    box.querySelector(".back").onclick = function () { accountView(); };
    box.querySelector(".go").onclick = function () {
      rpc("gh_new_recovery", { p_token: token(), p_password: box.querySelector(".p").value }).then(function (r) { recoveryView(r.recovery, false); },
        function (e) { err.textContent = e.message === "bad_login" ? "That password is not right." : msg(e); });
    };
  }

  function passwordView() {
    var box = modal(
      "<h2>Change password</h2>"
      + '<label>Old password</label><input class="o" type="password" autocomplete="current-password" maxlength="72">'
      + '<label>New password</label><div class="gha-in"><input class="n" type="password" autocomplete="new-password" maxlength="72" placeholder="at least 6 characters"><button class="gha-sq eye" type="button" aria-label="Show password">👁</button></div>'
      + '<div class="gha-err"></div>'
      + '<div class="gha-row"><button class="gha-btn ghost back" type="button">Back</button><button class="gha-btn go" type="button">Change</button></div>');
    eyeToggle(box);
    var err = box.querySelector(".gha-err");
    box.querySelector(".back").onclick = function () { accountView(); };
    box.querySelector(".go").onclick = function () {
      var o = box.querySelector(".o").value, n = box.querySelector(".n").value;
      if (n.length < 6) { err.textContent = MSG.short_password; return; }
      rpc("gh_change_password", { p_token: token(), p_old: o, p_new: n })
        .then(function () { accountView("Password changed."); }, function (e) {
          err.textContent = e.message === "bad_login" ? "Your old password is not right." : msg(e);
        });
    };
  }

  function deleteView() {
    var box = modal(
      "<h2>Delete account?</h2>"
      + "<p>This deletes <b>" + esc(user()) + "</b>, your PhatCoin, everything you bought and everything saved online, for good. Progress on this device stays here.</p>"
      + '<label>Type your password to be sure</label><input class="p" type="password" autocomplete="current-password" maxlength="72">'
      + '<div class="gha-err"></div>'
      + '<div class="gha-row"><button class="gha-btn ghost back" type="button">Keep it</button>'
      + '<button class="gha-btn go" type="button" style="background:#ff5a5f;color:#fff">Delete</button></div>');
    var err = box.querySelector(".gha-err");
    box.querySelector(".back").onclick = function () { accountView(); };
    box.querySelector(".go").onclick = function () {
      rpc("gh_delete_account", { p_token: token(), p_password: box.querySelector(".p").value })
        .then(function () { clearSession(); ready = false; setStatus("out"); closeModal(); },
              function (e) { err.textContent = e.message === "bad_login" ? "That password is not right." : msg(e); });
    };
  }

  function askWhich(g, cloudAt) {
    return new Promise(function (resolve) {
      var box = modal(
        "<h2>Which save?</h2>"
        + "<p><b>" + esc(GAMES[g].title) + "</b> has progress saved online <b>and</b> different progress on this device. Pick the one to keep. The other one gets replaced.</p>"
        + '<button class="gha-choice c" type="button">☁️ Keep my online save<small>saved ' + esc(when(cloudAt)) + "</small></button>"
        + '<button class="gha-choice l" type="button">📱 Keep what\'s on this device<small>and save it online</small></button>', true);
      box.querySelector(".c").onclick = function () { closeModal(); resolve("cloud"); };
      box.querySelector(".l").onclick = function () { closeModal(); resolve("local"); };
    });
  }

  function mountUI() {
    injectCSS();
    slot = document.getElementById("gh-account");
    if (!slot && GAME) {
      pill = document.createElement("div");
      pill.className = "gha-pill " + POS;
      pill.setAttribute("role", "button");
      ["pointerdown", "mousedown", "touchstart"].forEach(function (ev) {
        pill.addEventListener(ev, function (e) { e.stopPropagation(); }, false);
      });
      pill.addEventListener("click", function (e) { e.stopPropagation(); e.preventDefault(); openAccount(); });
      document.body.appendChild(pill);
    }
    setStatus(token() ? "saving" : "out");
    if (GAME && token()) syncThisGame(); else setStatus(token() ? "saved" : "out");
    if (token()) {
      refreshLook();
      if (GAME) rpc("gh_seen", { p_token: token(), p_game: GAME }).catch(function () {});
    }
    // the coin count in the pill follows PhatCoin
    if (window.PhatCoin) window.PhatCoin.onChange(function () { setStatus(state); });
    // the homepage and other pages can open the account box with #account
    if (location.hash === "#account" || /[?&]invite=/.test(location.search) && !token() && !GAME) {
      setTimeout(function () { openAccount(); }, 600);
    }
    // install as an app (ghgames.au only; Frondi Clicker keeps its own)
    if ("serviceWorker" in navigator && /(^|\.)ghgames\.au$/.test(location.hostname)) {
      navigator.serviceWorker.register("/sw.js").catch(function () {});
    }
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mountUI);
  else mountUI();

  // Listeners go on after the game's own ones (added at page load), so the
  // game has already written its latest save when these run.
  window.addEventListener("load", function () {
    if (justWiped) setTimeout(function () { if (!token()) lsSet(BLANK + GAME, sig(readLocal(GAME))); }, 300);
    setInterval(function () { pushIfChanged(false); }, 15000);
    window.addEventListener("pagehide", function () { pushIfChanged(true); });
    document.addEventListener("visibilitychange", function () { if (document.hidden) pushIfChanged(true); });
  });

  window.GHAccount = {
    user: user, token: token, open: openAccount, rpc: rpc, msg: msg,
    sync: function () { return GAME ? syncThisGame() : syncAll(null); },
    look: look, setLook: setLook, refreshLook: refreshLook, onLook: function (f) { lookListeners.push(f); },
    face: face, nameHtml: nameHtml, level: level, levelStart: levelStart, AVATARS: AVATARS,
    share: share, flash: flash, inviteUrl: inviteUrl, recoveryView: recoveryView, linkMakeView: linkMakeView,
    recent: function () { return (jGet(RECENT) || []).filter(function (x) { return x && GAMES[x.g]; }); },
    games: GAMES
  };
})();
