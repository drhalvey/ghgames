/* GH Games — shared nickname leaderboard
   Backed by a free Supabase project. The two values below are safe to be
   public: the anon key is designed for browsers, and the database rules only
   allow reading scores and adding new ones (never editing or deleting). */
(function () {
  var CONFIG = {
    url: "https://bpqaeqswtgtbqrczjcrx.supabase.co",
    key: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJwcWFlcXN3dGd0YnFyY3pqY3J4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEzMzUzOTIsImV4cCI6MjA5NjkxMTM5Mn0.hsEZJ_C4NvySPMb59G9EPPfdJRSNBODbnuo9ij_zxrI"
  };

  var TABLE = "scores";
  var NAME_KEY = "ghgames_nick";
  var configured = CONFIG.url.indexOf("YOUR_") === -1 && CONFIG.key.indexOf("YOUR_") === -1;
  // Same rules as the database's gh_name_ok: no rude words (incl. sh1t, f u c k, fuuuck) and no contact details.
  var RUDE = /(fuck|fuk|fck|fuc|shit|cunt|bitch|biatch|niger|niga|fag|slut|whore|dick|penis|vagina|rape|sex|porn|nazi|hitler|wank|tits|retard|kys|kilyourself|paedo|molest|suicide|bastard|twat|prick|boner|nude|naked)/;
  var CONTACT = /(@|https?|www\.|\.com|\.au|\.net|snap|insta|discord|tiktok|whatsapp|kik|telegram)/;
  function nameOk(n) {
    var raw = String(n || "").toLowerCase();
    if (CONTACT.test(raw) || (raw.replace(/[^0-9]/g, "").length >= 6) || /k\W*k\W*k/.test(raw)) return false;
    var map = { "0": "o", "1": "i", "3": "e", "4": "a", "5": "s", "7": "t", "8": "b", "$": "s", "!": "i", "|": "i" };
    var s = raw.replace(/[0134578$!|]/g, function (c) { return map[c]; }).replace(/[^a-z]/g, "").replace(/(.)\1+/g, "$1");
    return !RUDE.test(s);
  }
  // George's special players keep their perks but stay off the public boards (they still see themselves).
  var HIDDEN = { "buckasnuncle": 1, "guide dog": 1, "guidedog": 1 };
  function showOnBoard(n, me) {
    var k = String(n || "").trim().toLowerCase();
    if (me && k === String(me).trim().toLowerCase()) return true;
    return nameOk(n) && !HIDDEN[k];
  }
  var PERIOD_LABEL = { day: "today", week: "this week", month: "this month", all: "all-time" };

  // Live games (Public Arenas, co-op): any rude or contact-detail name from another player shows as "Player".
  var NAME_KEYS = { n: 1, name: 1, nick: 1, nm: 1, player: 1, owner: 1, thief: 1 };
  function scrub(o, d) {
    if (!o || typeof o !== "object" || d > 5) return o;
    for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) {
      var v = o[k];
      if (typeof v === "string") { if (NAME_KEYS[k] && !nameOk(v)) o[k] = "Player"; }
      else if (v && typeof v === "object") scrub(v, (d || 0) + 1);
    }
    return o;
  }
  function wrapSupabase(lib) {
    if (!lib || !lib.createClient || lib.__ghSafe) return lib;
    var make = lib.createClient;
    lib.createClient = function () {
      var client = make.apply(this, arguments);
      try {
        var mk = client.channel;
        client.channel = function () {
          var ch = mk.apply(this, arguments);
          var on = ch.on, ps = ch.presenceState;
          ch.on = function (type, filter, cb) {
            if (typeof cb === "function") { var f = cb; cb = function (p) { try { scrub(p, 0); } catch (e) {} return f.apply(this, arguments); }; }
            return on.call(this, type, filter, cb);
          };
          if (ps) ch.presenceState = function () { var st = ps.apply(this, arguments); try { scrub(st, 0); } catch (e) {} return st; };
          return ch;
        };
      } catch (e) {}
      return client;
    };
    lib.__ghSafe = true;
    return lib;
  }
  (function () {
    if (window.supabase) { wrapSupabase(window.supabase); return; }
    try {
      var held;
      Object.defineProperty(window, "supabase", { configurable: true, enumerable: true,
        get: function () { return held; }, set: function (v) { held = wrapSupabase(v); } });
    } catch (e) {}
  })();
  window.GHName = { ok: nameOk, clean: function (n) { return nameOk(n) ? n : "Player"; }, scrub: scrub };

  function api(path, opts) {
    opts = opts || {};
    return fetch(CONFIG.url + "/rest/v1/" + path, {
      method: opts.method || "GET",
      headers: {
        apikey: CONFIG.key,
        Authorization: "Bearer " + CONFIG.key,
        "Content-Type": "application/json",
        Prefer: "return=minimal"
      },
      body: opts.body || undefined
    }).then(function (r) {
      if (!r.ok) throw new Error("leaderboard api " + r.status);
      return r.status === 204 ? null : r.json();
    });
  }

  function periodStart(p) {
    var d = new Date(); d.setHours(0, 0, 0, 0);
    if (p === "day") return d.toISOString();
    if (p === "week") { var dow = (d.getDay() + 6) % 7; d.setDate(d.getDate() - dow); return d.toISOString(); }
    if (p === "month") { d.setDate(1); return d.toISOString(); }
    return null;
  }

  // K M B T Qa Qi Sx Sp Oc No Dc, then UDc DDc ... NoDc, Vg, UVg ... Tg ...
  var SMALL = ["K","M","B","T","Qa","Qi","Sx","Sp","Oc","No"];
  var NU = ["","U","D","T","Qa","Qi","Sx","Sp","Oc","No"];
  var NT = ["","Dc","Vg","Tg","Qag","Qig","Sxg","Spg","Ocg","Nog"];
  var NH = ["","Ce","Du","Tr","Qd","Qn","Sc","St","Og","Nn"];
  function illion(N) { return N < 10 ? SMALL[N] : NU[N % 10] + NT[Math.floor(N / 10) % 10] + NH[Math.floor(N / 100) % 10]; }
  function fmt(n, unit) {
    if (unit === "sec") return Number(n).toFixed(1) + "s";
    n = Math.round(n);
    if (!isFinite(n)) return "MAX";
    if (n < 1e6) return n.toLocaleString();
    var e = Math.floor(Math.log10(n) / 3 + 1e-9);
    var v = n / Math.pow(10, e * 3);
    return (v >= 100 ? Math.round(v) : v.toFixed(1)) + illion(e - 1);
  }

  function esc(t) { var d = document.createElement("div"); d.textContent = t; return d.innerHTML; }
  function el(sel) { return typeof sel === "string" ? document.getElementById(sel) : sel; }

  var CSS = ""
    + ".lb,.lb-nickbar{font-family:system-ui,sans-serif;color:#eef1f8;box-sizing:border-box}"
    + ".lb-nickbar{max-width:360px;margin:0 auto 16px;background:#1a2030;border:1px solid #2a3650;border-radius:12px;padding:10px 14px;text-align:center;font-size:.95rem}"
    + ".lb-nickbar b{color:#7dd97b}"
    + ".lb-nickbar input{background:#10141f;border:1px solid #2a3650;color:#eef1f8;border-radius:8px;padding:8px 10px;font-family:inherit;width:60%}"
    + ".lb-nickbar button,.lb button{font-family:inherit;cursor:pointer}"
    + ".lb-nickbar .go,.lb .go{background:#5b8cff;border:none;color:#fff;border-radius:8px;padding:8px 12px;margin-left:6px}"
    + ".lb-nickbar .link,.lb .link{background:none;border:none;color:#8d96ad;text-decoration:underline;padding:0 0 0 4px}"
    + ".lb{max-width:360px;margin:16px auto;background:#1a2030;border:1px solid #2a3650;border-radius:14px;padding:14px;text-align:left}"
    + ".lb h3{font-size:1rem;margin:0 0 10px;text-align:center}"
    + ".lb .nick{text-align:center;font-size:.9rem;margin-bottom:10px}"
    + ".lb .nick b{color:#7dd97b}"
    + ".lb .nick input{background:#10141f;border:1px solid #2a3650;color:#eef1f8;border-radius:8px;padding:7px 9px;font-family:inherit;width:55%}"
    + ".lb .tabs{display:flex;gap:4px;margin-bottom:10px}"
    + ".lb .tabs button{flex:1;background:#26304a;border:1px solid #3a4a70;color:#8d96ad;border-radius:7px;padding:6px 0;font-size:.72rem}"
    + ".lb .tabs button.on{background:#5b8cff;border-color:#5b8cff;color:#fff}"
    + ".lb .you{background:#1f3326;border:1px solid #2f6b3f;color:#9be8a0;border-radius:8px;padding:6px 8px;font-size:.82rem;text-align:center;margin-bottom:8px}"
    + ".lb ol{list-style:none;margin:0;padding:0;min-height:120px}"
    + ".lb li{display:flex;justify-content:space-between;align-items:center;padding:6px 4px;border-bottom:1px solid #232c44;font-size:.9rem}"
    + ".lb li .r{color:#8d96ad;width:26px}.lb li .medal{width:26px}"
    + ".lb li .nm{flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}"
    + ".lb li .sc{font-weight:600}"
    + ".lb li.me{color:#7dd97b;font-weight:600}"
    + ".lb .note{color:#5c6680;font-size:.72rem;text-align:center;margin-top:8px}"
    + ".lb li.ai{color:#8d96ad;font-style:italic}"
    + ".lb li.ai .tag{font-style:normal;font-size:.62rem;font-weight:700;background:#3a4a70;color:#cfd6ea;border-radius:4px;padding:1px 4px;margin-left:4px;vertical-align:middle}"
    + ".lb .empty{color:#5c6680;text-align:center;padding:20px 0;font-size:.85rem}";

  function injectCSS() {
    if (document.getElementById("lb-css")) return;
    var s = document.createElement("style"); s.id = "lb-css"; s.textContent = CSS;
    document.head.appendChild(s);
  }

  var boards = [];      // { box, listEl, cfg, period, nickEl }
  var nickbars = [];    // standalone nickname-bar elements
  var submitCfg = null; // cfg used by submit()

  function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  function lsDel(k) { try { localStorage.removeItem(k); } catch (e) {} }
  // No nickname picked yet? Logged-in players use their account name, so their scores still count.
  function getName() {
    var n = lsGet(NAME_KEY);
    if (n) return n;
    var u = String(lsGet("ghacct_user") || "").trim().slice(0, 12);
    return u && nameOk(u) ? u : "";
  }
  function setName(n) {
    n = (n || "").trim().slice(0, 12);
    if (!n) return false;
    if (!nameOk(n)) { alert("Please pick a friendlier name, with no links, numbers or social handles 🙂"); return false; }
    lsSet(NAME_KEY, n);
    flushPending();
    return true;
  }
  // A score earned before a nickname was picked waits here, then goes up as soon as one is saved.
  var PEND_KEY = "ghgames_lb_pending_";
  function keepPending(score) {
    if (!submitCfg) return;
    var k = PEND_KEY + submitCfg.game, old = Number(lsGet(k));
    var better = !lsGet(k) || (submitCfg.dir === "asc" ? score < old : score > old);
    if (better) lsSet(k, String(score));
  }
  function flushPending() {
    if (!submitCfg) return;
    var k = PEND_KEY + submitCfg.game, v = lsGet(k);
    if (v === null || v === "") return;
    lsDel(k);
    Leaderboard.submit(Number(v));
  }

  // ---- nickname widgets (used both in the bar and inside each board) ----
  function paintNick(container, opts) {
    opts = opts || {};
    var name = getName();
    if (name && !container._editing) {
      container.innerHTML = (opts.bar ? "Playing as <b>" : 'You are <b>') + esc(name)
        + '</b> <button class="link chg">change</button>';
      container.querySelector(".chg").onclick = function () { container._editing = true; paintNick(container, opts); };
    } else {
      container.innerHTML = '<input maxlength="12" placeholder="pick a nickname"/><button class="go">save</button>';
      var inp = container.querySelector("input"); inp.value = name;
      function save() {
        if (setName(inp.value)) { container._editing = false; syncAllNick(); refreshAll(); }
      }
      container.querySelector(".go").onclick = save;
      inp.addEventListener("keydown", function (e) { if (e.key === "Enter") { e.preventDefault(); save(); } });
      if (container._editing || opts.autofocus) inp.focus();
    }
  }
  function syncAllNick() {
    nickbars.forEach(function (c) { paintNick(c, { bar: true }); });
    boards.forEach(function (b) { if (b.nickEl) paintNick(b.nickEl, {}); });
  }

  // ---- board rendering ----
  function fetchBoard(cfg, period) {
    if (!configured) return Promise.resolve([]);
    var dir = cfg.dir === "asc" ? "asc" : "desc";
    var q = "?game=eq." + encodeURIComponent(cfg.game) + "&order=score." + dir + "&limit=400";
    var start = periodStart(period);
    if (start) q += "&created_at=gte." + start;
    return api(TABLE + q).then(function (rows) {
      var best = {};
      var me = getName();
      rows.forEach(function (r) {
        if (!showOnBoard(r.name, me)) return;
        var c = best[r.name];
        if (!c || (dir === "desc" ? r.score > c.score : r.score < c.score)) best[r.name] = r;
      });
      return Object.keys(best).map(function (k) { return best[k]; })
        .sort(function (a, b) { return dir === "desc" ? b.score - a.score : a.score - b.score; })
        .slice(0, 10);
    }).catch(function () { return []; });
  }

  function renderBoard(b) {
    var me = getName();
    b.box.querySelectorAll(".tabs button").forEach(function (btn) {
      btn.classList.toggle("on", btn.dataset.p === b.period);
    });
    var youEl = b.box.querySelector(".you");
    if (!configured) { b.listEl.innerHTML = '<div class="empty">Leaderboard not connected yet.</div>'; return; }
    b.listEl.innerHTML = '<div class="empty">Loading…</div>';
    youEl.style.display = "none";
    fetchBoard(b.cfg, b.period).then(function (rows) {
      var bots = rivalsFor(b.cfg, b.period);
      if (!rows.length && !bots.length) { b.listEl.innerHTML = '<div class="empty">No scores yet — be the first!</div>'; return; }
      var medals = ["🥇", "🥈", "🥉"], desc = b.cfg.dir !== "asc";
      // Computer rivals sit among the real scores as targets, but are always marked AI and never take a rank or medal.
      var all = rows.concat(bots).sort(function (x, y) { return desc ? y.score - x.score : x.score - y.score; });
      var rank = 0;
      b.listEl.innerHTML = all.map(function (r) {
        if (r.ai) return '<li class="ai" title="Computer rival, not a real player"><span class="r">🤖</span>'
          + '<span class="nm">' + esc(r.name) + ' <span class="tag">AI</span></span>'
          + '<span class="sc">' + fmt(r.score, b.cfg.unit) + '</span></li>';
        var i = rank++;
        var mine = r.name === me ? " me" : "";
        var rk = i < 3 ? '<span class="medal">' + medals[i] + '</span>' : '<span class="r">' + (i + 1) + '</span>';
        return '<li class="' + mine.trim() + '">' + rk
          + '<span class="nm">' + esc(r.name) + '</span>'
          + '<span class="sc">' + fmt(r.score, b.cfg.unit) + '</span></li>';
      }).join("") + (rows.length ? "" : '<div class="empty" style="padding:10px 0">No real players yet ' + PERIOD_LABEL[b.period] + ', beat the AI!</div>');
      var myIdx = -1, mine = null;
      for (var i = 0; i < rows.length; i++) if (rows[i].name === me) { myIdx = i; mine = rows[i]; break; }
      var msg = "";
      if (myIdx >= 0) msg = (myIdx === 0 ? "🏆 You're #1 " : "🎉 You're #" + (myIdx + 1) + " ") + PERIOD_LABEL[b.period] + "!";
      if (bots.length && (b.nickEl || mine)) {
        var next = null;
        bots.forEach(function (r) { var ahead = mine ? (desc ? r.score > mine.score : r.score < mine.score) : true; if (ahead && (!next || (desc ? r.score < next.score : r.score > next.score))) next = r; });
        if (next) msg += (msg ? " " : "") + "🤖 Next AI to beat: " + next.name + " (" + fmt(next.score, b.cfg.unit) + ")";
        else if (mine) msg += " You beat every AI rival!";
      }
      if (msg) { youEl.style.display = "block"; youEl.textContent = msg; }
    });
  }

  function refreshAll() { boards.forEach(renderBoard); }

  // AI rivals: { name, score, from } where from is the shortest tab they appear on (day, week, month or all).
  // Harder rivals only show on the longer tabs, so Today has easy targets and All-time has tough ones.
  var SPAN = { day: 0, week: 1, month: 2, all: 3 };
  // Games with AI rivals (shown on the game page and on the Leaderboards page).
  var RIVALS = {
    "over-the-top": [
      { name: "Pvt Pixel", score: 600, from: "day" },
      { name: "Cpl Cog", score: 1500, from: "day" },
      { name: "Sgt Sprocket", score: 3000, from: "day" },
      { name: "Lt Circuit", score: 5500, from: "week" },
      { name: "Capt Clank", score: 9000, from: "month" },
      { name: "Maj Gears", score: 14000, from: "all" },
      { name: "Col Chrome", score: 22000, from: "all" }
    ]
  };
  function rivalsFor(cfg, period) {
    if (!cfg.rivals) return [];
    return cfg.rivals.filter(function (r) { return SPAN[r.from || "day"] <= SPAN[period]; })
      .map(function (r) { return { name: r.name, score: r.score, ai: true }; });
  }

  var Leaderboard = {
    getName: getName,
    setName: setName,

    submit: function (score) {
      if (!configured || !submitCfg) return Promise.resolve();
      score = Math.round(Number(score));
      if (isNaN(score) || score < 0) return Promise.resolve();
      var name = getName(); if (!name) { keepPending(score); return Promise.resolve(); }
      if (submitCfg.max != null && score > submitCfg.max) return Promise.resolve();
      if (submitCfg.min != null && score < submitCfg.min) return Promise.resolve();
      var row = { game: submitCfg.game, name: name, score: score };
      function direct() { return api(TABLE, { method: "POST", body: JSON.stringify(row) }); }
      // Logged in: post through gh_score_submit so the score is stamped with the account
      // (only those scores earn leaderboard PhatCoin). Falls back to a plain post.
      var tok = ""; try { tok = localStorage.getItem("ghacct_token") || ""; } catch (e) {}
      var send = tok
        ? api("rpc/gh_score_submit", { method: "POST", body: JSON.stringify({ p_token: tok, p_game: row.game, p_name: name, p_score: score }) })
            .then(null, direct)
        : direct();
      return send.then(function () { refreshAll(); }).catch(function () {});
    },

    // standalone shared nickname bar (used on the hub / homepage)
    mountNick: function (target) {
      injectCSS();
      var c = el(target); if (!c) return;
      c.className = "lb-nickbar";
      nickbars.push(c);
      paintNick(c, { bar: true });
    },

    // opts: { el, game, dir, unit, max, min, title, showNick (default true) }
    mount: function (opts) {
      injectCSS();
      var box = el(opts.el); if (!box) return;
      var cfg = { game: opts.game, dir: opts.dir || "desc", unit: opts.unit || "", max: opts.max, min: opts.min, rivals: opts.rivals || RIVALS[opts.game] || null };
      if (opts.showNick !== false) { // game pages submit; hub boards don't
        submitCfg = cfg; Leaderboard._game = cfg.game; Leaderboard._dir = cfg.dir;
      }
      var dirNote = cfg.dir === "asc" ? "fastest wins" : "highest wins";
      box.className = "lb";
      box.innerHTML =
        '<h3>🏆 ' + esc(opts.title || "Leaderboard") + '</h3>'
        + (opts.showNick !== false ? '<div class="nick"></div>' : '')
        + '<div class="tabs">'
        + '<button data-p="day">Today</button><button data-p="week">Week</button>'
        + '<button data-p="month">Month</button><button data-p="all">All-time</button>'
        + '</div><div class="you" style="display:none"></div><ol></ol>'
        + '<div class="note">' + dirNote + ' · nicknames only, keep them friendly'
        + (cfg.rivals ? '<br>🤖 AI = computer rival to beat, not a real player' : '') + '</div>';

      var board = { box: box, listEl: box.querySelector("ol"), cfg: cfg, period: "day",
                    nickEl: opts.showNick !== false ? box.querySelector(".nick") : null };
      boards.push(board);
      if (board.nickEl) paintNick(board.nickEl, {});
      box.querySelectorAll(".tabs button").forEach(function (btn) {
        btn.addEventListener("click", function () { board.period = btn.dataset.p; renderBoard(board); });
      });
      renderBoard(board);
      if (board.nickEl) flushPending();
    }
  };

  window.Leaderboard = Leaderboard;
})();
