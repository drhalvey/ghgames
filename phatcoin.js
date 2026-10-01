/* GH Games — PhatCoin, the one coin for the whole arcade
   ------------------------------------------------------------------
   PhatCoin lives in the player's GH Games account (Supabase gh_pc_*
   functions), so it is the same number in every game and on every device.
   The server decides how much each thing can pay, so a game can't hand
   out a million by mistake:
     win          up to 5   (at most one every 8 seconds)
     rebirth      up to 25  (at most one a minute)
     daily bonus  20, 30, 40 ... up to 100 for days in a row (Perth time)
     leaderboard  100 for 1st today, 50 for top 3, 20 for top 10 (once a day per game)
     most earned from play in one day: 1000 (daily bonus and leaderboard on top)
   Players who aren't logged in collect up to 200 in their pocket on this
   device; it goes into their account the first time they log in.

   How a game uses it (after account.js):
     <script src="phatcoin.js" data-game="steal-an-animal"></script>
     PhatCoin.earn("win", 5, "stealing a Golden Fox")
     PhatCoin.earn("rebirth", 25)
     PhatCoin.spend(50, "coin-boost").then(ok => { if (ok) ...give the thing... })
     PhatCoin.leaderboard(nickname, "desc")      // checks today's top 10, pays once a day
     PhatCoin.balance(), PhatCoin.onChange(fn), PhatCoin.open()
   Optional: data-pill="none" to hide the floating coin (the game shows its own), data-pos="top-right" (default) | "top-left" | "bottom-right" | "bottom-left" */
(function () {
  "use strict";
  var SB_URL = "https://bpqaeqswtgtbqrczjcrx.supabase.co";
  var SB_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJwcWFlcXN3dGd0YnFyY3pqY3J4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEzMzUzOTIsImV4cCI6MjA5NjkxMTM5Mn0.hsEZJ_C4NvySPMb59G9EPPfdJRSNBODbnuo9ij_zxrI";
  var POCKET = "phatcoin_guest", POCKET_MAX = 200;
  var me = document.currentScript;
  var GAME = (me && me.dataset.game) || "arcade";
  var POS = (me && me.dataset.pos) || "top-right";
  var NOPILL = me && me.dataset.pill === "none"; // the game shows PhatCoin in its own HUD

  function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  function token() { return lsGet("ghacct_token"); }
  function pocket() { var n = parseInt(lsGet(POCKET), 10); return isNaN(n) ? 0 : Math.max(0, Math.min(POCKET_MAX, n)); }

  function rpc(fn, args) {
    return fetch(SB_URL + "/rest/v1/rpc/" + fn, {
      method: "POST",
      headers: { apikey: SB_KEY, Authorization: "Bearer " + SB_KEY, "Content-Type": "application/json" },
      body: JSON.stringify(args)
    }).then(function (r) {
      return r.text().then(function (t) {
        var b = null; try { b = t ? JSON.parse(t) : null; } catch (e) {}
        if (!r.ok) throw new Error((b && b.message) || "network");
        return b;
      });
    });
  }

  // ---------- state ----------
  var bal = null, info = null, who = null, listeners = [], lastWin = 0;
  function shown() { return token() ? (bal == null ? 0 : bal) : pocket(); }
  function changed() {
    paint();
    listeners.forEach(function (f) { try { f(shown()); } catch (e) {} });
  }
  function setBal(b) { if (typeof b === "number") { bal = b; changed(); } }

  function refresh() {
    if (!token()) { bal = null; info = null; changed(); return Promise.resolve(); }
    return rpc("gh_pc_get", { p_token: token() }).then(function (r) { info = r; setBal(r.balance); }, function () {});
  }

  // when someone logs in, put their pocket coins into the account
  function deposit() {
    var p = pocket();
    if (!token() || p <= 0) return Promise.resolve();
    return rpc("gh_pc_earn", { p_token: token(), p_game: GAME, p_reason: "guest", p_amount: p }).then(function (r) {
      lsSet(POCKET, "0");
      if (r && r.amount > 0) toast("+" + r.amount + " PhatCoin from your pocket");
      setBal(r && r.balance);
    }, function () {});
  }

  function watchLogin() {
    var t = token() || "";
    if (t === who) return;
    who = t;
    deposit().then(refresh);
  }

  // ---------- public API ----------
  function earn(reason, amount, why) {
    amount = Math.max(0, Math.floor(amount || 0));
    if (!amount) return Promise.resolve(0);
    if (reason === "win") { var now = Date.now(); if (now - lastWin < 8000) return Promise.resolve(0); lastWin = now; }
    if (!token()) {
      var p = pocket(), add = Math.min(amount, POCKET_MAX - p);
      if (add <= 0) { return Promise.resolve(0); }
      lsSet(POCKET, String(p + add));
      toast("+" + add + " PhatCoin" + (why ? " for " + why : ""), p + add >= POCKET_MAX ? "Your pocket is full. Log in to keep earning!" : "Log in to keep it forever");
      changed();
      return Promise.resolve(add);
    }
    return rpc("gh_pc_earn", { p_token: token(), p_game: GAME, p_reason: reason, p_amount: amount }).then(function (r) {
      setBal(r && r.balance);
      if (r && r.amount > 0) toast("+" + r.amount + " PhatCoin" + (why ? " for " + why : ""));
      else if (r && r.error === "daily_max") toast("PhatCoin daily max reached", "Come back tomorrow for more");
      return (r && r.amount) || 0;
    }, function () { return 0; });
  }

  function spend(amount, item) {
    if (!token()) { open("Log in to spend PhatCoin. It keeps your coins safe in your account."); return Promise.resolve(false); }
    return rpc("gh_pc_spend", { p_token: token(), p_game: GAME, p_item: item || "", p_amount: amount }).then(function (r) {
      setBal(r && r.balance);
      if (r && r.ok) return true;
      toast("Not enough PhatCoin", "You need " + amount);
      return false;
    }, function () { toast("Can't reach the internet", "Try again soon"); return false; });
  }

  function leaderboard(nick, dir) {
    if (!token() || !nick) return Promise.resolve(0);
    return rpc("gh_pc_leaderboard", { p_token: token(), p_game: GAME, p_nick: nick, p_dir: dir || "desc" }).then(function (r) {
      setBal(r && r.balance);
      if (r && r.amount > 0) toast("+" + r.amount + " PhatCoin", "You're #" + r.rank + " on today's leaderboard!");
      return (r && r.amount) || 0;
    }, function () { return 0; });
  }

  function claimDaily() {
    return rpc("gh_pc_daily", { p_token: token() }).then(function (r) {
      setBal(r && r.balance);
      if (r && r.amount) toast("+" + r.amount + " PhatCoin daily bonus", "Day " + r.streak + " in a row!");
      return refresh();
    });
  }

  // ---------- UI ----------
  var COIN = '<svg viewBox="0 0 32 32" width="18" height="18" aria-hidden="true"><circle cx="16" cy="16" r="15" fill="#f5b400"/><circle cx="16" cy="16" r="11.5" fill="#ffd54a" stroke="#c98a00" stroke-width="1.5"/><text x="16" y="21.5" text-anchor="middle" font-family="Arial Black,Arial,sans-serif" font-weight="900" font-size="15" fill="#8a5a00">P</text></svg>';
  var CSS = ""
    + ".pc-pill{position:fixed;z-index:2147483000;display:flex;align-items:center;gap:6px;font:800 14px/1 system-ui,-apple-system,'Segoe UI',sans-serif;color:#2b1d00;"
    + "background:linear-gradient(#ffe27a,#ffc21a);border:2px solid #c98a00;border-radius:999px;padding:5px 11px 5px 6px;cursor:pointer;box-shadow:0 3px 0 #8a5a00;"
    + "-webkit-tap-highlight-color:transparent;user-select:none;-webkit-user-select:none}"
    + ".pc-pill.top-right{right:max(10px,env(safe-area-inset-right));top:max(10px,env(safe-area-inset-top))}"
    + ".pc-pill.top-left{left:max(10px,env(safe-area-inset-left));top:max(10px,env(safe-area-inset-top))}"
    + ".pc-pill.bottom-right{right:max(10px,env(safe-area-inset-right));bottom:max(10px,env(safe-area-inset-bottom))}"
    + ".pc-pill.bottom-left{left:max(10px,env(safe-area-inset-left));bottom:max(10px,env(safe-area-inset-bottom))}"
    + ".pc-pill i{width:8px;height:8px;border-radius:50%;background:#ff3b5c;display:none}.pc-pill i.on{display:block}"
    + ".pc-toast{position:fixed;z-index:2147483500;left:50%;top:max(56px,calc(env(safe-area-inset-top) + 56px));transform:translateX(-50%);display:flex;align-items:center;gap:8px;"
    + "background:#2b1d00;color:#ffe27a;border:2px solid #ffc21a;border-radius:14px;padding:8px 14px;font:800 15px/1.2 system-ui,-apple-system,sans-serif;"
    + "box-shadow:0 8px 24px rgba(0,0,0,.4);animation:pcIn .25s ease-out;pointer-events:none;max-width:92vw}"
    + ".pc-toast small{display:block;color:#fff3c4;font-weight:600;font-size:12.5px}"
    + "@keyframes pcIn{from{opacity:0;transform:translate(-50%,-10px)}to{opacity:1;transform:translate(-50%,0)}}"
    + ".pc-bg{position:fixed;inset:0;z-index:2147483600;background:rgba(0,0,0,.6);display:flex;align-items:center;justify-content:center;padding:16px}"
    + ".pc-box{width:100%;max-width:380px;max-height:calc(100vh - 32px);overflow:auto;background:#1d1606;color:#fff8e0;border:2px solid #c98a00;border-radius:18px;padding:20px;"
    + "font:500 15px/1.45 system-ui,-apple-system,'Segoe UI',sans-serif;text-align:left}"
    + ".pc-box h2{display:flex;align-items:center;gap:8px;font:900 26px/1.1 'Lilita One',system-ui,sans-serif;margin:0 0 4px;color:#ffd54a}"
    + ".pc-big{font:900 40px/1 system-ui,sans-serif;color:#ffd54a;margin:6px 0 12px;display:flex;align-items:center;gap:8px}"
    + ".pc-box p{margin:0 0 10px;color:#e6d6a8;font-size:14px}"
    + ".pc-box ul{margin:0 0 12px;padding-left:18px;color:#e6d6a8;font-size:14px}"
    + ".pc-btn{font:800 15px/1 system-ui,sans-serif;color:#2b1d00;background:#ffc21a;border:0;border-radius:999px;padding:12px 16px;cursor:pointer;box-shadow:0 3px 0 #8a5a00;flex:1}"
    + ".pc-btn.ghost{background:#3a2d0c;color:#fff8e0;box-shadow:none;border:1px solid #6b5418}"
    + ".pc-btn[disabled]{opacity:.5;cursor:default}"
    + ".pc-row{display:flex;gap:8px;margin-top:12px;flex-wrap:wrap}"
    + ".pc-note{color:#ffd54a;font-weight:700;font-size:14px;margin:0 0 10px}";

  var pill = null, toastEl = null, toastT = 0;
  function injectCSS() {
    if (document.getElementById("pc-css")) return;
    var s = document.createElement("style"); s.id = "pc-css"; s.textContent = CSS;
    (document.head || document.documentElement).appendChild(s);
  }
  function fmt(n) { return Number(n || 0).toLocaleString(); }
  function esc(t) { var d = document.createElement("div"); d.textContent = t == null ? "" : String(t); return d.innerHTML; }

  function paint() {
    if (!pill) return;
    pill.innerHTML = COIN + "<span>" + fmt(shown()) + "</span><i class=\"" + (token() && info && info.daily_ready ? "on" : "") + "\"></i>";
    pill.title = "PhatCoin" + (token() ? "" : " (in your pocket on this device)");
  }

  function toast(text, sub) {
    if (!document.body) return;
    if (toastEl) toastEl.remove();
    toastEl = document.createElement("div"); toastEl.className = "pc-toast";
    toastEl.innerHTML = COIN + "<div>" + esc(text) + (sub ? "<small>" + esc(sub) + "</small>" : "") + "</div>";
    document.body.appendChild(toastEl);
    clearTimeout(toastT);
    toastT = setTimeout(function () { if (toastEl) { toastEl.remove(); toastEl = null; } }, 2600);
  }

  var bg = null;
  function close() { if (bg) { bg.remove(); bg = null; } }
  function open(note) {
    close();
    injectCSS();
    var logged = !!token();
    bg = document.createElement("div"); bg.className = "pc-bg";
    ["pointerdown", "mousedown", "touchstart", "keydown", "click"].forEach(function (ev) {
      bg.addEventListener(ev, function (e) { e.stopPropagation(); if (ev === "pointerdown" && e.target === bg) close(); }, false);
    });
    var daily = logged && info ? (info.daily_ready
      ? '<button class="pc-btn" id="pcDaily">Get daily bonus: +' + info.next_daily + "</button>"
      : '<button class="pc-btn" disabled>Daily bonus collected' + (info.streak ? " (" + info.streak + " day" + (info.streak > 1 ? "s" : "") + " in a row)" : "") + "</button>") : "";
    bg.innerHTML = '<div class="pc-box" role="dialog" aria-modal="true">'
      + "<h2>" + COIN.replace(/18/g, "28") + "PhatCoin</h2>"
      + '<div class="pc-big">' + fmt(shown()) + "</div>"
      + (note ? '<p class="pc-note">' + esc(note) + "</p>" : "")
      + (logged ? "<p>The same PhatCoin in every GH Games game, on any device.</p>"
                : "<p>These are in your pocket on this device (up to " + POCKET_MAX + "). Log in to keep them forever, spend them, and get a daily bonus.</p>")
      + "<ul><li>Win: up to 5</li><li>Rebirth: 25</li><li>Daily bonus: 20, then 10 more each day in a row, up to 100</li>"
      + "<li>Today's leaderboard: 100 for 1st, 50 for top 3, 20 for top 10</li></ul>"
      + '<div class="pc-row">' + daily + "</div>"
      + '<div class="pc-row">' + (logged ? "" : '<button class="pc-btn" id="pcLogin">Log in</button>')
      + '<button class="pc-btn ghost" id="pcClose">Close</button></div></div>';
    document.body.appendChild(bg);
    bg.querySelector("#pcClose").onclick = close;
    var lg = bg.querySelector("#pcLogin");
    if (lg) lg.onclick = function () { close(); if (window.GHAccount) window.GHAccount.open(); };
    var dl = bg.querySelector("#pcDaily");
    if (dl) dl.onclick = function () { dl.disabled = true; claimDaily().then(function () { open(); }, function () { dl.disabled = false; }); };
    if (logged && !info) refresh().then(function () { if (bg) open(note); });
  }

  function mount() {
    injectCSS();
    if (NOPILL) { watchLogin(); setInterval(watchLogin, 3000); setInterval(function () { if (token() && !document.hidden) refresh(); }, 60000); return; }
    pill = document.createElement("div");
    pill.className = "pc-pill " + POS;
    pill.setAttribute("role", "button");
    ["pointerdown", "mousedown", "touchstart"].forEach(function (ev) { pill.addEventListener(ev, function (e) { e.stopPropagation(); }, false); });
    pill.addEventListener("click", function (e) { e.stopPropagation(); e.preventDefault(); open(); });
    document.body.appendChild(pill);
    paint();
    watchLogin();
    setInterval(watchLogin, 3000);
    setInterval(function () { if (token() && !document.hidden) refresh(); }, 60000);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mount); else mount();

  window.PhatCoin = {
    earn: earn, spend: spend, leaderboard: leaderboard, open: open, refresh: refresh,
    balance: shown, loggedIn: function () { return !!token(); },
    onChange: function (f) { listeners.push(f); }
  };
})();
