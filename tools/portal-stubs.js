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
    // Progress save through the CrazyGames Data Module. Games keep using
    // localStorage; every write is mirrored into SDK.data, and on start any
    // newer cloud copy is pulled back into localStorage (one reload).
    ready.then(function () {
      var d; try { d = sdk().data; } catch (e) {}
      if (!d) return;
      var LS = Storage.prototype, set0 = LS.setItem, rem0 = LS.removeItem, clr0 = LS.clear;
      var keysOf = function () { try { return JSON.parse(d.getItem("__gh_keys") || "[]"); } catch (e) { return []; } };
      var keys = keysOf(), changed = false;
      keys.forEach(function (k) {
        var v = d.getItem(k);
        if (v !== null && localStorage.getItem(k) !== v) { set0.call(localStorage, k, v); changed = true; }
      });
      var addKey = function (k) { if (keys.indexOf(k) < 0) { keys.push(k); d.setItem("__gh_keys", JSON.stringify(keys)); } };
      for (var i = 0; i < localStorage.length; i++) {
        var k = localStorage.key(i);
        if (k && k.indexOf("SDK") < 0 && k.indexOf("crazygames") < 0) { addKey(k); if (d.getItem(k) === null) d.setItem(k, localStorage.getItem(k)); }
      }
      LS.setItem = function (k, v) { set0.call(this, k, v); if (this === localStorage) { try { addKey(k); d.setItem(k, String(v)); } catch (e) {} } };
      LS.removeItem = function (k) { rem0.call(this, k); if (this === localStorage) { try { d.removeItem(k); } catch (e) {} } };
      LS.clear = function () { clr0.call(this); if (this === localStorage) { try { d.clear(); } catch (e) {} } };
      if (changed && !sessionStorage.getItem("gh_cg_synced")) { sessionStorage.setItem("gh_cg_synced", "1"); location.reload(); }
    });
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
