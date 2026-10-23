/* GH Games homepage: the Changing Room card. Loads three.js and gear.js only when the card is on screen,
   so the homepage stays quick. */
(function () {
  "use strict";
  var sec = document.getElementById("dress"); if (!sec) return;
  var view = document.getElementById("dressView"), stats = document.getElementById("dressStats");
  function n(x) { return Number(x || 0).toLocaleString(); }
  function load(src) { return new Promise(function (ok, bad) { var s = document.createElement("script"); s.src = src; s.onload = ok; s.onerror = bad; document.head.appendChild(s); }); }
  function paint(S) {
    var logged = window.GHAccount && window.GHAccount.token && window.GHAccount.token();
    if (!logged) { stats.innerHTML = "<span><b>124</b>things to wear</span><span><b>3</b>crates</span><span>Make an account to start earning XP</span>"; return; }
    var worn = Object.keys(S.on || {}).length;
    stats.innerHTML = "<span><b>" + n(S.balance) + "</b>XP</span><span><b>Level " + (S.level || 1) + "</b></span><span><b>" + n((S.owned || []).length) + "</b>owned</span>" + (S.keys ? "<span><b>" + n(S.keys) + "</b>crate keys 🔑</span>" : "") + (worn ? "" : "<span>Nothing on yet</span>");
  }
  var started = false;
  function start() {
    if (started) return; started = true;
    (window.THREE ? Promise.resolve() : load("vendor/three.min.js")).then(function () { return window.Gear ? null : load("gear.js"); }).then(function () {
      var G = window.Gear; if (!G) return;
      G.onChange(paint); paint(G.state());
      var p = G.preview(view, { spin: 0.6 });
      // logged out (or nothing worn yet): show off a look so people see what it is
      var on = G.on();
      if (p && !Object.keys(on).length) p.setLook({ hat: "crown-gold", back: "angel-wings", aura: "aura-galaxy", trail: "trail-rainbow", face: "shades" });
      G.onChange(function () { if (!p) return; if (Object.keys(G.on()).length) p.wearMine(); });
      G.refresh();
    }, function () {});
  }
  if ("IntersectionObserver" in window) {
    var io = new IntersectionObserver(function (es) { es.forEach(function (e) { if (e.isIntersecting) { io.disconnect(); start(); } }); }, { rootMargin: "200px" });
    io.observe(sec);
  } else start();
})();
