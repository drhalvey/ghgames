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
    "save-your-rabbit": { title: "Save Your Rabbit", keys: ["saverabbit-save"] },
    "iron-command": { title: "Iron Command", keys: ["ironcommand-save", "ironcommand-battle"] },
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
    lsDel(TOKEN); lsDel(USER);
    Object.keys(GAMES).forEach(function (g) { lsDel(MARK + g); lsDel(PEND + g); });
  }
  function loggedOutByServer() { clearSession(); ready = false; setStatus("out"); }

  // ---------- account actions ----------
  function afterLogin(res) {
    lsSet(TOKEN, res.token); lsSet(USER, res.username); lsDel(WIPE);
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

  // ---------- UI ----------
  var CSS = ""
    + ".gha-pill{position:fixed;z-index:2147483000;display:flex;align-items:center;gap:6px;font:600 13px/1 system-ui,-apple-system,'Segoe UI',sans-serif;"
    + "color:#f2f3f7;background:rgba(14,16,23,.72);border:1px solid rgba(255,255,255,.18);border-radius:999px;padding:7px 11px;cursor:pointer;"
    + "backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);-webkit-tap-highlight-color:transparent;user-select:none;-webkit-user-select:none;max-width:46vw}"
    + ".gha-pill span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}"
    + ".gha-pill.bottom-left{left:max(10px,env(safe-area-inset-left));bottom:max(10px,env(safe-area-inset-bottom))}"
    + ".gha-pill.bottom-right{right:max(10px,env(safe-area-inset-right));bottom:max(10px,env(safe-area-inset-bottom))}"
    + ".gha-pill.top-left{left:max(10px,env(safe-area-inset-left));top:max(10px,env(safe-area-inset-top))}"
    + ".gha-pill.top-right{right:max(10px,env(safe-area-inset-right));top:max(10px,env(safe-area-inset-top))}"
    + ".gha-dot{width:8px;height:8px;border-radius:50%;background:#9aa0b4;flex:none}"
    + ".gha-dot.saved{background:#3ddc84}.gha-dot.saving,.gha-dot.loading{background:#ffcc33}.gha-dot.offline{background:#ff5a5f}"
    + ".gha-btn{font:600 15px/1 'Rubik',system-ui,sans-serif;color:#0e1017;background:#ffcc33;border:0;border-radius:999px;padding:9px 16px;cursor:pointer;white-space:nowrap}"
    + ".gha-btn.ghost{background:#1f2330;color:#f2f3f7;border:1px solid #2a2f3f}"
    + ".gha-bg{position:fixed;inset:0;z-index:2147483600;background:rgba(0,0,0,.6);display:flex;align-items:center;justify-content:center;padding:16px}"
    + ".gha-box{width:100%;max-width:380px;max-height:calc(100vh - 32px);overflow:auto;background:#171a24;color:#f2f3f7;border:1px solid #2a2f3f;border-radius:18px;"
    + "padding:20px;font:400 15px/1.45 'Rubik',system-ui,-apple-system,'Segoe UI',sans-serif;box-shadow:0 20px 60px rgba(0,0,0,.5);text-align:left}"
    + ".gha-box h2{font:400 26px/1.1 'Lilita One',system-ui,sans-serif;margin:0 0 6px;letter-spacing:.3px}"
    + ".gha-box p{margin:0 0 12px;color:#9aa0b4;font-size:14px}"
    + ".gha-box b{color:#f2f3f7}"
    + ".gha-tabs{display:flex;gap:6px;margin:0 0 14px}"
    + ".gha-tabs button{flex:1;font-family:inherit;font-weight:600;font-size:14px;line-height:1;padding:10px 0;border-radius:10px;border:1px solid #2a2f3f;background:#1f2330;color:#9aa0b4;cursor:pointer}"
    + ".gha-tabs button.on{background:#ffcc33;border-color:#ffcc33;color:#0e1017}"
    + ".gha-box label{display:block;font-size:13px;color:#9aa0b4;margin:10px 0 4px}"
    + ".gha-box input{width:100%;box-sizing:border-box;font-family:inherit;font-weight:500;font-size:17px;line-height:1.2;color:#f2f3f7;background:#0e1017;border:1px solid #2a2f3f;border-radius:10px;padding:11px 12px;outline:none}"
    + ".gha-box input:focus{border-color:#ffcc33}"
    + ".gha-row{display:flex;gap:8px;margin-top:16px;flex-wrap:wrap}.gha-row .gha-btn{flex:1;padding:12px 10px}"
    + ".gha-err{color:#ff8a8d;font-size:14px;margin-top:10px;min-height:1em}"
    + ".gha-ok{color:#3ddc84;font-size:14px;margin-top:10px}"
    + ".gha-small{font-size:12.5px;color:#6f7690;margin-top:14px}"
    + ".gha-link{background:none;border:0;color:#9aa0b4;text-decoration:underline;font:inherit;font-size:13px;cursor:pointer;padding:6px 0}"
    + ".gha-link.red{color:#ff8a8d}"
    + ".gha-choice{display:block;width:100%;text-align:left;margin-top:10px;padding:13px 14px;border-radius:12px;border:1px solid #2a2f3f;background:#1f2330;color:#f2f3f7;font:inherit;cursor:pointer}"
    + ".gha-choice small{display:block;color:#9aa0b4;font-size:12.5px;margin-top:2px}";

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

  var pill = null, slot = null;
  var LABEL = { out: "Log in to save", saving: "Saving…", loading: "Loading your save…", offline: "Offline" };

  function setStatus(s) {
    state = token() ? s : "out";
    if (pill) {
      var name = user();
      pill.innerHTML = '<i class="gha-dot ' + state + '"></i><span>☁️ '
        + esc(state === "out" ? LABEL.out : state === "saved" || state === "idle" ? name : LABEL[state] || name) + "</span>";
      pill.title = state === "out" ? "Log in to save your progress online" : "Logged in as " + name;
    }
    if (slot) {
      slot.innerHTML = token()
        ? '<button class="gha-btn ghost" type="button">☁️ ' + esc(user()) + "</button>"
        : '<button class="gha-btn" type="button">Log in</button>';
      slot.firstChild.onclick = openAccount;
    }
  }

  var openBox = null;
  function modal(html) {
    closeModal();
    var bg = document.createElement("div"); bg.className = "gha-bg";
    bg.innerHTML = '<div class="gha-box" role="dialog" aria-modal="true">' + html + "</div>";
    // stop taps reaching the game underneath
    ["pointerdown", "mousedown", "touchstart", "keydown", "click"].forEach(function (ev) {
      bg.addEventListener(ev, function (e) { e.stopPropagation(); }, false);
    });
    document.body.appendChild(bg); openBox = bg;
    return bg.firstChild;
  }
  function closeModal() { if (openBox) { openBox.remove(); openBox = null; } }

  function openAccount() { if (token()) accountView(); else loginView("login"); }

  function loginView(mode) {
    var isNew = mode === "new";
    var box = modal(
      '<h2>' + (isNew ? "Make an account" : "Log in") + "</h2>"
      + "<p>" + (isNew ? "Save your games online so they're there on any device."
                       : "Log in to get your saved games on this device.") + "</p>"
      + '<div class="gha-tabs"><button data-m="login" class="' + (isNew ? "" : "on") + '">Log in</button>'
      + '<button data-m="new" class="' + (isNew ? "on" : "") + '">New account</button></div>'
      + '<label>Username</label><input class="u" autocomplete="username" autocapitalize="none" autocorrect="off" spellcheck="false" maxlength="16" placeholder="e.g. rocket_fox">'
      + '<label>Password</label><input class="p" type="password" autocomplete="' + (isNew ? "new-password" : "current-password") + '" maxlength="72" placeholder="at least 6 characters">'
      + (isNew ? '<label>Password again</label><input class="p2" type="password" autocomplete="new-password" maxlength="72">' : "")
      + '<div class="gha-err"></div>'
      + '<div class="gha-row"><button class="gha-btn ghost x" type="button">Cancel</button>'
      + '<button class="gha-btn go" type="button">' + (isNew ? "Make account" : "Log in") + "</button></div>"
      + (isNew
        ? '<div class="gha-small">Don\'t use your real name. We only keep your username, a scrambled copy of your password, and your game progress. No email needed.</div>'
        : '<div class="gha-small">Forgot your password? A grown-up can email ejhalvey@gmail.com to reset it.</div>'));
    var u = box.querySelector(".u"), p = box.querySelector(".p"), p2 = box.querySelector(".p2"), err = box.querySelector(".gha-err"), go = box.querySelector(".go");
    box.querySelectorAll(".gha-tabs button").forEach(function (b) { b.onclick = function () { loginView(b.dataset.m); }; });
    box.querySelector(".x").onclick = closeModal;
    u.addEventListener("input", function () { var v = u.value.toLowerCase().replace(/[^a-z0-9_]/g, ""); if (v !== u.value) u.value = v; });
    function submit() {
      err.textContent = "";
      if (u.value.length < 3) { err.textContent = MSG.bad_name; return; }
      if (p.value.length < 6) { err.textContent = MSG.short_password; return; }
      if (isNew && p.value !== p2.value) { err.textContent = "The two passwords don't match."; return; }
      go.disabled = true; go.textContent = "…";
      rpc(isNew ? "gh_signup" : "gh_login", { p_username: u.value, p_password: p.value })
        .then(function (res) {
          closeModal(); setStatus("saving");
          return afterLogin(res).catch(function () {});
        })
        .catch(function (e) { err.textContent = msg(e); go.disabled = false; go.textContent = isNew ? "Make account" : "Log in"; });
    }
    go.onclick = submit;
    [u, p, p2].forEach(function (i) { if (i) i.addEventListener("keydown", function (e) { if (e.key === "Enter") { e.preventDefault(); submit(); } }); });
    setTimeout(function () { u.focus(); }, 50);
  }

  function accountView(note) {
    var box = modal(
      "<h2>☁️ " + esc(user()) + "</h2>"
      + "<p>You're logged in. Your progress saves online by itself, so you can carry on from any device.</p>"
      + "<p>Logging out saves everything online, then clears your games off this device so the next player starts fresh.</p>"
      + (note ? '<div class="gha-ok">' + esc(note) + "</div>" : "")
      + '<div class="gha-err"></div>'
      + '<div class="gha-row"><button class="gha-btn ghost out" type="button">Log out</button>'
      + '<button class="gha-btn x" type="button">Done</button></div>'
      + '<div class="gha-row" style="justify-content:space-between;margin-top:10px">'
      + '<button class="gha-link pw" type="button">Change password</button>'
      + '<button class="gha-link red del" type="button">Delete account</button></div>');
    var err = box.querySelector(".gha-err");
    box.querySelector(".x").onclick = closeModal;
    box.querySelector(".pw").onclick = passwordView;
    box.querySelector(".del").onclick = deleteView;
    box.querySelector(".out").onclick = function () {
      var b = this; b.disabled = true; b.textContent = "Saving…";
      logOut().then(closeModal, function (e) {
        err.textContent = msg(e) + " You're still logged in so nothing is lost.";
        b.disabled = false; b.textContent = "Log out"; setStatus(token() ? "offline" : "out");
      });
    };
  }

  function passwordView() {
    var box = modal(
      "<h2>Change password</h2>"
      + '<label>Old password</label><input class="o" type="password" autocomplete="current-password" maxlength="72">'
      + '<label>New password</label><input class="n" type="password" autocomplete="new-password" maxlength="72" placeholder="at least 6 characters">'
      + '<div class="gha-err"></div>'
      + '<div class="gha-row"><button class="gha-btn ghost x" type="button">Back</button><button class="gha-btn go" type="button">Change</button></div>');
    var err = box.querySelector(".gha-err");
    box.querySelector(".x").onclick = function () { accountView(); };
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
      + "<p>This deletes <b>" + esc(user()) + "</b> and everything saved online, for good. Progress on this device stays here.</p>"
      + '<label>Type your password to be sure</label><input class="p" type="password" autocomplete="current-password" maxlength="72">'
      + '<div class="gha-err"></div>'
      + '<div class="gha-row"><button class="gha-btn ghost x" type="button">Keep it</button>'
      + '<button class="gha-btn go" type="button" style="background:#ff5a5f;color:#fff">Delete</button></div>');
    var err = box.querySelector(".gha-err");
    box.querySelector(".x").onclick = function () { accountView(); };
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
        + '<button class="gha-choice l" type="button">📱 Keep what\'s on this device<small>and save it online</small></button>');
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

  window.GHAccount = { user: user, open: openAccount, sync: function () { return GAME ? syncThisGame() : syncAll(null); } };
})();
