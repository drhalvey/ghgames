/* GH Games homepage: the PhatCoin hub under the hero, and "Continue playing".
   Needs account.js and phatcoin.js (data-game="arcade") on the page. */
(function () {
  "use strict";
  var hub = document.getElementById("hub"), cont = document.getElementById("cont");
  if (!hub) return;
  var A = window.GHAccount, P = window.PhatCoin;
  var shop = null, prof = null, lastTok = null;
  var TITLES = { "frondi-clicker": "Frondi Clicker" };
  if (A) Object.keys(A.games).forEach(function (g) { TITLES[g] = A.games[g].title; });

  function esc(t) { var d = document.createElement("div"); d.textContent = t == null ? "" : String(t); return d.innerHTML; }
  function n(x) { return Number(x || 0).toLocaleString(); }
  function ago(t) {
    if (!t) return "";
    var s = (Date.now() - new Date(t).getTime()) / 1000;
    if (s < 300) return "now";
    if (s < 3600) return Math.round(s / 60) + " min ago";
    if (s < 86400) return Math.round(s / 3600) + " h ago";
    return Math.round(s / 86400) + " d ago";
  }
  var COIN = '<span class="coin"></span>';
  var BIGCOIN = '<svg class="big-coin" viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="50" r="48" fill="#c98a00"/><circle cx="50" cy="47" r="46" fill="#f5b400"/><circle cx="50" cy="47" r="36" fill="#ffd54a" stroke="#c98a00" stroke-width="3"/><text x="50" y="62" text-anchor="middle" font-family="Lilita One,Arial Black,sans-serif" font-size="44" fill="#8a5a00">P</text></svg>';

  // ---------- continue playing ----------
  function art(href) {
    var a = document.querySelector('#grid .tile[href="' + href + '"] .art svg');
    if (!a) return "";
    var c = a.cloneNode(true);
    // gradient ids are renamed so copies never clash
    c.querySelectorAll("[id]").forEach(function (el) { el.removeAttribute("id"); });
    return c.outerHTML;
  }
  function paintCont() {
    if (!cont || !A) return;
    var rec = A.recent().slice(0, 6);
    if (!rec.length) { cont.hidden = true; return; }
    cont.hidden = false;
    cont.querySelector(".cont-row").innerHTML = rec.map(function (r) {
      return '<a href="' + r.g + '.html">' + art(r.g + ".html") + "<span>▶ " + esc(TITLES[r.g] || r.g) + "</span></a>";
    }).join("");
  }

  // ---------- the hub ----------
  function guest() {
    var pocket = P ? P.balance() : 0;
    hub.innerHTML =
      '<div class="hub-card hub-guest">' + BIGCOIN
      + '<h3>Play with an account</h3>'
      + "<p>Takes 10 seconds. No email, no real name. " + (pocket ? "You've already got <b style=\"color:#ffd54a\">" + n(pocket) + " PhatCoin</b> in your pocket on this device. Make an account and it's yours forever." : "Then every game you play earns PhatCoin.") + "</p>"
      + "<ul><li>☁️ Your games save on every device</li><li>" + COIN + " Earn PhatCoin in every game</li><li>🛍️ Spend it on avatars, frames and themes</li><li>👯 Add friends and send them gifts</li></ul>"
      + '<div class="row"><button class="btn" type="button" data-act="new">Make my account</button><button class="btn ghost" type="button" data-act="login">I have one</button></div></div>'
      + '<div class="hub-card"><h3>' + COIN + " How to earn</h3>"
      + '<div class="flist">'
      + '<div class="frow">🎮<div class="t"><b>Play any game</b><small>2 every minute you play</small></div></div>'
      + '<div class="frow">🏆<div class="t"><b>Win</b><small>up to 5 a win</small></div></div>'
      + '<div class="frow">🔥<div class="t"><b>Come back every day</b><small>daily bonus up to 100</small></div></div>'
      + '<div class="frow">🥇<div class="t"><b>Top 10 today</b><small>up to 100 a game</small></div></div>'
      + '<div class="frow">🎁<div class="t"><b>Invite friends</b><small>100 each, once they play</small></div></div>'
      + "</div></div>";
    hub.querySelector('[data-act="new"]').onclick = function () { A.open("new"); };
    hub.querySelector('[data-act="login"]').onclick = function () { A.open("login"); };
  }

  function nextBuy(bal, owned) {
    if (!shop) return "";
    var have = {}; (owned || []).forEach(function (k) { have[k] = 1; });
    var want = shop.filter(function (i) { return i.price > 0 && !have[i.kind + ":" + i.id] && (i.kind === "avatar" || i.kind === "frame"); })
      .sort(function (a, b) { return a.price - b.price; });
    if (!want.length) return '<p>You own everything in the shop. Legend.</p>';
    var can = want.filter(function (i) { return i.price <= bal; }).pop();
    var goal = want.filter(function (i) { return i.price > bal; })[0];
    var it = can || goal, l = A.look();
    var face = it.kind === "avatar" ? A.face({ avatar: it.id, frame: "none" }, 46) : A.face({ avatar: l.avatar, frame: it.id }, 46);
    return '<a class="next-buy" href="me.html#shop">' + face + '<div style="flex:1;min-width:0"><b>' + (can ? "You can buy the " : "Saving for the ") + esc(it.name) + (it.kind === "frame" ? " frame" : "") + "</b>"
      + "<small>" + (can ? "Costs " + n(it.price) + " PhatCoin. Tap to get it!" : n(it.price - bal) + " more PhatCoin to go") + "</small>"
      + (can ? "" : '<div class="mini-bar"><i style="width:' + Math.round(100 * bal / it.price) + '%"></i></div>') + "</div></a>";
  }

  function member() {
    var l = A.look(), p = prof || {}, info = (P && P.info()) || {};
    var bal = P ? P.balance() : p.balance || 0;
    var life = info.lifetime != null ? info.lifetime : p.lifetime || 0;
    var lv = A.level(life), a = A.levelStart(lv), b = A.levelStart(lv + 1);
    var ready = info.daily_ready != null ? info.daily_ready : p.daily_ready;
    var streak = info.streak != null ? info.streak : p.streak || 0;
    var next = info.next_daily || p.next_daily || 20;
    var today = info.earned_today != null ? info.earned_today : p.earned_today || 0;
    var days = ""; for (var i = 1; i <= 7; i++) days += '<span class="' + (i <= streak ? "on" : "") + '">' + (i <= streak ? "🔥" : i) + "</span>";
    var friends = (p.friends || []).slice().sort(function (x, y) { return new Date(y.last_seen || 0) - new Date(x.last_seen || 0); });
    var reqs = (p.requests || []).length;

    hub.innerHTML =
      '<div class="hub-card hub-wallet">'
      + '<div class="hub-me">' + A.face(l, 64) + '<div class="who"><b>' + A.nameHtml({ username: A.user(), color: l.color }) + "</b><small>Level " + lv + " · " + n(life) + " PhatCoin earned ever</small></div></div>"
      + '<div class="lvl"><i style="width:' + Math.round(100 * (life - a) / (b - a)) + '%"></i></div>'
      + '<div class="lvl-txt"><span>Level ' + lv + "</span><span>" + n(b - life) + " to level " + (lv + 1) + "</span></div>"
      + '<div class="hub-bal">' + '<span class="coin"></span>' + n(bal) + "<small>PhatCoin<br>to spend</small></div>"
      + (ready ? '<button class="daily" type="button" data-act="daily">🎁 Get your daily bonus: +' + next + "</button>"
               : '<button class="daily" type="button" disabled>✓ Daily bonus collected. Come back tomorrow!</button>')
      + '<div class="streak" title="Days in a row">' + days + "</div>"
      + '<p style="font-size:12.5px">Earned from playing today: ' + n(today) + " / 1,000</p>"
      + "</div>"
      + '<div class="hub-card"><h3>🛍️ Shop</h3>' + nextBuy(bal, l.owned)
      + "<p>Avatars, glowing frames, rainbow names and new site themes, all bought with PhatCoin.</p>"
      + '<div class="row"><a class="btn" href="me.html#shop">Open the shop</a></div></div>'
      + '<div class="hub-card"><h3>👯 Friends ' + (reqs ? '<span class="pill-note">' + reqs + " new</span>" : "") + "</h3>"
      + (friends.length
        ? '<div class="flist">' + friends.slice(0, 3).map(function (f) {
            var on = f.last_seen && Date.now() - new Date(f.last_seen) < 300000;
            return '<div class="frow">' + A.face(f, 36) + '<div class="t"><b>' + A.nameHtml(f) + "</b><small>"
              + (f.last_game ? (on ? '<span class="online-dot"></span>Playing ' : "Played ") + '<a href="' + esc(f.last_game) + '.html">' + esc(TITLES[f.last_game] || f.last_game) + "</a> · " + ago(f.last_seen) : "Level " + f.level)
              + "</small></div></div>";
          }).join("") + "</div>"
        : "<p>" + (reqs ? "Someone wants to be your friend!" : "Add friends by their player name, see what they're playing and send them PhatCoin.") + "</p>")
      + '<div class="row"><a class="btn ghost" href="me.html#friends">' + (reqs ? "See requests" : friends.length ? "All friends" : "Add friends") + '</a><button class="btn" type="button" data-act="invite">Invite</button></div></div>';

    var d = hub.querySelector('[data-act="daily"]');
    if (d) d.onclick = function () {
      d.disabled = true; d.textContent = "…";
      P.claimDaily().then(function () { load(); }, function () { d.disabled = false; });
    };
    hub.querySelector('[data-act="invite"]').onclick = function () {
      A.share({ what: "invite", text: "Come and play GH Games with me! Use my link and we both get PhatCoin.", url: A.inviteUrl() });
    };
  }

  function paint() { if (!A) return; if (A.token()) member(); else guest(); paintCont(); }

  function load() {
    paint();
    if (!A || !A.token()) return;
    var jobs = [A.refreshLook().then(function (p) { if (p) prof = p; })];
    if (!shop) jobs.push(A.rpc("gh_shop", {}).then(function (s) { shop = s; }, function () {}));
    if (P) jobs.push(P.refresh());
    Promise.all(jobs).then(paint, paint);
  }

  function watch() {
    var t = (A && A.token()) || "";
    if (t !== lastTok) { lastTok = t; prof = null; load(); }
  }
  watch();
  setInterval(watch, 2000);
  if (P) P.onChange(function () { if (A.token()) paint(); else guest(); });
  setInterval(function () { if (A && A.token() && !document.hidden) load(); }, 90000);
})();
