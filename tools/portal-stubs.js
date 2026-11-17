/* GH Games portal build: offline stand-ins for account.js, phatcoin.js, gear.js,
   leaderboard.js and analytics.js. The game plays and saves on this device only:
   no accounts, no PhatCoin wallet, no online leaderboards, no names sent anywhere. */
(function () {
  var done = function (v) { return Promise.resolve(v); };
  var noop = function () {};
  function stub(known) {
    return new Proxy(known, { get: function (t, k) { return k in t ? t[k] : (typeof k === "string" ? function () { return done(null); } : undefined); } });
  }
  window.GH_PORTAL = true;
  window.GHName = { ok: function () { return true; }, clean: function (n) { return n || "Player"; }, scrub: function (o) { return o; } };
  window.GHAccount = stub({
    user: function () { return null; }, token: function () { return null; }, open: noop, msg: noop, flash: noop, share: noop,
    rpc: function () { return Promise.reject(new Error("offline")); }, sync: function () { return done(); },
    look: function () { return {}; }, setLook: noop, refreshLook: noop, onLook: noop,
    face: function () { return ""; }, nameHtml: function (n) { return String(n || ""); },
    level: function () { return 1; }, levelStart: function () { return 0; }, AVATARS: [],
    inviteUrl: function () { return ""; }, recoveryView: noop, linkMakeView: noop,
    recent: function () { return []; }, games: {}
  });
  window.PhatCoin = stub({
    earn: function () { return done(0); }, spend: function () { return done(false); },
    leaderboard: function () { return done({ amount: 0 }); }, open: noop, refresh: function () { return done(); },
    claimDaily: function () { return done({ amount: 0 }); }, info: function () { return {}; },
    balance: function () { return 0; }, loggedIn: function () { return false; }, onChange: noop
  });
  window.Gear = stub({
    RAR: {}, SLOTS: [], CRATES: [], items: [], item: function () { return null; }, state: function () { return { owned: [], on: {} }; },
    on: function () { return {}; }, refresh: function () { return done(); }, onChange: noop,
    owns: function () { return false; }, dress: function () { return null; }, undress: noop,
    preview: noop, thumb: function () { return ""; }, mannequin: function () { return null; }, toast: noop,
    _dressed: function () { return []; }
  });
  var NICK = "ghgames_nick";
  window.Leaderboard = stub({
    getName: function () { try { return localStorage.getItem(NICK) || "Player"; } catch (e) { return "Player"; } },
    setName: noop, submit: function () { return done(null); }, refresh: noop,
    mountNick: function (t) { var el = typeof t === "string" ? document.getElementById(t) : t; if (el) el.style.display = "none"; },
    mount: function (opts) {
      var box = opts && (typeof opts.el === "string" ? document.getElementById(opts.el) : opts.el)
        || (opts && typeof opts.target === "string" ? document.getElementById(opts.target) : opts && opts.target);
      if (box && box.style) box.style.display = "none";
    }
  });
  // hide leaderboard boxes the page builds itself
  document.addEventListener("DOMContentLoaded", function () {
    var st = document.createElement("style");
    st.textContent = ".lb,.lb-nickbar{display:none!important}";
    document.head.appendChild(st);
  });

  // CrazyGames SDK v3: loading and gameplay events (only in the CrazyGames build)
  if (window.GH_CRAZY) {
    var sdk = function () { return window.CrazyGames && window.CrazyGames.SDK; };
    var ready = new Promise(function (res) {
      var tries = 0; (function wait() { if (sdk()) sdk().init().then(res, res); else if (tries++ < 50) setTimeout(wait, 100); else res(); })();
    });
    ready.then(function () { try { sdk().game.loadingStart(); } catch (e) {} });
    window.addEventListener("load", function () {
      ready.then(function () {
        try { sdk().game.loadingStop(); } catch (e) {}
        var playing = false;
        var start = function () { if (!playing) { playing = true; try { sdk().game.gameplayStart(); } catch (e) {} } };
        var stop = function () { if (playing) { playing = false; try { sdk().game.gameplayStop(); } catch (e) {} } };
        ["pointerdown", "keydown", "touchstart"].forEach(function (ev) { window.addEventListener(ev, start, { passive: true }); });
        document.addEventListener("visibilitychange", function () { if (document.hidden) stop(); });
      });
    });
  }
})();
