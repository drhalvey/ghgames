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

  // Portal ad and event layer (only in portal builds that set GH_TARGET).
  // GHPortal.adBreak() shows a portal ad at a natural break (between levels, rounds or
  // before "play again"); the portal decides whether an ad is actually due.
  // GHPortal.breakOn([...selectors]) runs an ad break before the click on those buttons
  // goes through, so games need no changes of their own.
  var T = window.GH_TARGET || (window.GH_CRAZY ? "crazygames" : "");
  var ctxs = [];
  (function trackAudio() {
    ["AudioContext", "webkitAudioContext"].forEach(function (k) {
      var C = window[k]; if (!C) return;
      var W = function () { var c = new (Function.prototype.bind.apply(C, [null].concat([].slice.call(arguments))))(); ctxs.push(c); return c; };
      W.prototype = C.prototype; window[k] = W;
    });
  })();
  var muted = false, wasRunning = [];
  function mute() {
    if (muted) return; muted = true; wasRunning = [];
    ctxs.forEach(function (c) { if (c.state === "running") { wasRunning.push(c); try { c.suspend(); } catch (e) {} } });
    [].forEach.call(document.querySelectorAll("audio,video"), function (m) { if (!m.paused) { m.dataset.ghWas = "1"; m.pause(); } });
  }
  function unmute() {
    if (!muted) return; muted = false;
    wasRunning.forEach(function (c) { try { c.resume(); } catch (e) {} }); wasRunning = [];
    [].forEach.call(document.querySelectorAll("audio[data-gh-was],video[data-gh-was]"), function (m) { delete m.dataset.ghWas; try { m.play(); } catch (e) {} });
  }
  var playing = false, adOn = false;
  var api = {
    init: function () { return Promise.resolve(); }, loaded: noop,
    start: noop, stop: noop, ad: function () { return Promise.resolve(); }
  };
  if (T === "crazygames") {
    var cg = function () { return window.CrazyGames && window.CrazyGames.SDK; };
    api.init = function () { return new Promise(function (res) { var n = 0; (function w() { if (cg()) cg().init().then(res, res); else if (n++ < 50) setTimeout(w, 100); else res(); })(); }).then(function () { try { cg().game.loadingStart(); } catch (e) {} }); };
    api.loaded = function () { try { cg().game.loadingStop(); } catch (e) {} };
    api.start = function () { try { cg().game.gameplayStart(); } catch (e) {} };
    api.stop = function () { try { cg().game.gameplayStop(); } catch (e) {} };
    api.ad = function () { return new Promise(function (res) {
      try { cg().ad.requestAd("midgame", { adStarted: mute, adFinished: function () { unmute(); res(); }, adError: function () { unmute(); res(); } }); }
      catch (e) { res(); } }); };
  } else if (T === "poki") {
    var pk = function () { return window.PokiSDK; };
    api.init = function () { return pk() ? pk().init().then(noop, noop) : Promise.resolve(); };
    api.loaded = function () { try { pk().gameLoadingFinished(); } catch (e) {} };
    api.start = function () { try { pk().gameplayStart(); } catch (e) {} };
    api.stop = function () { try { pk().gameplayStop(); } catch (e) {} };
    api.ad = function () { try { return pk().commercialBreak(mute).then(unmute, unmute); } catch (e) { return Promise.resolve(); } };
  } else if (T === "gd") {
    var gdDone = null;
    window.GD_OPTIONS = { gameId: window.GH_GD_ID || "", onEvent: function (ev) {
      if (ev.name === "SDK_GAME_PAUSE") mute();
      if (ev.name === "SDK_GAME_START") { unmute(); if (gdDone) { var d = gdDone; gdDone = null; d(); } }
    } };
    (function (d, s, id) { var js, fjs = d.getElementsByTagName(s)[0]; if (d.getElementById(id)) return; js = d.createElement(s); js.id = id;
      js.src = "https://html5.api.gamedistribution.com/main.min.js"; fjs.parentNode.insertBefore(js, fjs); })(document, "script", "gamedistribution-jssdk");
    api.ad = function () { return new Promise(function (res) {
      var g = window.gdsdk; if (!g || !g.showAd) return res();
      var t = setTimeout(function () { gdDone = null; unmute(); res(); }, 45000); gdDone = function () { clearTimeout(t); res(); };
      try { var p = g.showAd(); if (p && p.then) p.then(null, function () { clearTimeout(t); gdDone = null; unmute(); res(); }); } catch (e) { clearTimeout(t); gdDone = null; res(); }
    }); };
  }
  var ready = T ? api.init() : Promise.resolve();
  window.GHPortal = {
    target: T,
    start: function () { if (!playing && !adOn) { playing = true; api.start(); } },
    stop: function () { if (playing) { playing = false; api.stop(); } },
    adBreak: function () {
      if (!T || adOn) return Promise.resolve();
      adOn = true; window.GHPortal.stop();
      return ready.then(api.ad).then(function () { adOn = false; unmute(); }, function () { adOn = false; unmute(); });
    },
    breakOn: function (sels) {
      var bypass = false, sel = sels.join(",");
      document.addEventListener("click", function (e) {
        if (bypass || !T) return;
        var b = e.target && e.target.closest && e.target.closest(sel); if (!b || b.disabled) return;
        e.stopImmediatePropagation(); e.preventDefault();
        window.GHPortal.adBreak().then(function () { bypass = true; try { b.click(); } finally { bypass = false; } window.GHPortal.start(); });
      }, true);
    }
  };
  if (T) {
    window.addEventListener("load", function () {
      ready.then(function () {
        api.loaded();
        ["pointerdown", "keydown", "touchstart"].forEach(function (ev) { window.addEventListener(ev, window.GHPortal.start, { passive: true }); });
        document.addEventListener("visibilitychange", function () { if (document.hidden) window.GHPortal.stop(); });
      });
    });
  }
})();
