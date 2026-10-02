/* GH Games: my profile, the PhatCoin shop, friends, invites, account (me.html) */
(function () {
  "use strict";
  var A = window.GHAccount, P = window.PhatCoin, T = window.ghTheme;
  var $ = function (id) { return document.getElementById(id); };
  var prof = null, shop = [], kind = "avatar", sel = null, armed = null, previewTheme = null;
  var TITLES = { "frondi-clicker": "Frondi Clicker" };
  Object.keys(A.games).forEach(function (g) { TITLES[g] = A.games[g].title; });

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
  function bal() { return P ? P.balance() : (prof && prof.balance) || 0; }
  function owned(k, id) {
    var it = item(k, id);
    if (k === "theme" && !it) return true;               // the free themes
    if (it && it.price === 0) return true;
    return ((prof && prof.owned) || []).indexOf(k + ":" + id) >= 0;
  }
  function item(k, id) { return shop.filter(function (i) { return i.kind === k && i.id === id; })[0]; }
  function wearing(k, id) {
    var l = A.look();
    if (k === "avatar") return l.avatar === id;
    if (k === "frame") return l.frame === id;
    if (k === "color") return l.color === id;
    if (k === "theme") return T && T.get() === id;
  }
  function themeItems() {
    if (!T) return [];
    return T.list.map(function (t, i) {
      var s = item("theme", t.id);
      return { kind: "theme", id: t.id, name: t.name, price: s ? s.price : 0, swatch: t.swatch, sort: i };
    });
  }
  function items(k) { return k === "theme" ? themeItems() : shop.filter(function (i) { return i.kind === k; }); }

  // ---------- header ----------
  function head() {
    var l = A.look(), p = prof || {}, life = p.lifetime || 0, lv = A.level(life), a = A.levelStart(lv), b = A.levelStart(lv + 1);
    $("head").innerHTML = A.face(l, 88)
      + '<div class="who"><h1>' + A.nameHtml({ username: A.user(), color: l.color }) + "</h1>"
      + "<p>Level " + lv + " · " + n(b - life) + " PhatCoin to level " + (lv + 1) + "</p>"
      + '<div class="lvl" style="max-width:340px;margin-top:8px"><i style="width:' + Math.round(100 * (life - a) / (b - a)) + '%"></i></div></div>'
      + '<div class="me-stats">'
      + "<div><b>" + COIN + n(bal()) + "</b><small>to spend</small></div>"
      + "<div><b>" + n(life) + "</b><small>earned ever</small></div>"
      + "<div><b>" + (p.friends ? p.friends.length : 0) + "</b><small>friends</small></div>"
      + "<div><b>🔥" + (p.streak || 0) + "</b><small>days in a row</small></div></div>";
    var r = (p.requests || []).length;
    $("reqN").hidden = !r; $("reqN").textContent = r;
  }

  // ---------- shop ----------
  function preview(it) {
    var l = A.look();
    if (!it) return A.face(l, 120);
    if (it.kind === "avatar") return A.face({ avatar: it.id, frame: l.frame }, 120);
    if (it.kind === "frame") return A.face({ avatar: l.avatar, frame: it.id }, 120);
    if (it.kind === "color") return A.face(l, 90);
    return '<div class="swatch" style="background:' + it.swatch + '"></div>';
  }
  function tryPanel() {
    var it = sel, l = A.look(), html;
    if (!it) {
      html = preview(null) + '<div><div class="name">' + A.nameHtml({ username: A.user(), color: l.color }) + '</div><div class="what">Tap anything to try it on.</div></div>';
      $("try").innerHTML = html; return;
    }
    var have = owned(it.kind, it.id), on = wearing(it.kind, it.id), b = bal();
    var btn;
    if (on) btn = '<button class="btn ghost" type="button" disabled>' + (it.kind === "theme" ? "Using it ✓" : "Wearing it ✓") + "</button>";
    else if (have) btn = '<button class="btn" type="button" data-act="wear">' + (it.kind === "theme" ? "Use this theme" : "Wear it") + "</button>";
    else if (b >= it.price) btn = '<button class="btn" type="button" data-act="buy">' + (armed === it.kind + it.id ? "Tap again to buy" : "Buy for " + COIN + " " + n(it.price)) + "</button>";
    else btn = '<button class="btn ghost" type="button" disabled>Need ' + n(it.price - b) + " more " + COIN + "</button>";
    html = preview(it) + "<div>"
      + '<div class="name">' + (it.kind === "color" ? A.nameHtml({ username: A.user(), color: it.id }) : esc(it.name)) + "</div>"
      + '<div class="what">' + (it.kind === "color" ? esc(it.name) + " name" : it.kind === "frame" ? "Frame" : it.kind === "theme" ? "Site theme" : "Avatar")
      + (have ? " · yours" : it.price ? " · " + n(it.price) + " PhatCoin" : " · free")
      + (!have && b < it.price ? "<br>Play any game to earn more." : "") + "</div>"
      + btn + "</div>";
    $("try").innerHTML = html;
    var w = $("try").querySelector('[data-act="wear"]'), by = $("try").querySelector('[data-act="buy"]');
    if (w) w.onclick = function () { wear(it); };
    if (by) by.onclick = function () {
      if (armed !== it.kind + it.id) { armed = it.kind + it.id; tryPanel(); setTimeout(function () { if (armed === it.kind + it.id) { armed = null; tryPanel(); } }, 3500); return; }
      armed = null; by.disabled = true; by.textContent = "…";
      A.rpc("gh_buy", { p_token: A.token(), p_kind: it.kind, p_id: it.id }).then(function (r) {
        if (r.error) { A.flash(r.error === "not_enough" ? "Not enough PhatCoin yet" : "That didn't work. Try again."); tryPanel(); return; }
        if (window.gtag) window.gtag("event", "shop_buy", { item: it.kind + ":" + it.id, price: it.price });
        prof.owned = (prof.owned || []).concat(it.kind + ":" + it.id);
        A.setLook({ owned: prof.owned });
        if (P) P.refresh();
        confetti();
        return wear(it, "Bought it! ");
      }, function (e) { A.flash(A.msg(e)); tryPanel(); });
    };
  }
  function wear(it, pre) {
    if (it.kind === "theme") {
      previewTheme = null;
      if (T && T.set(it.id)) { if (window.ghThemeMark) window.ghThemeMark(); A.flash((pre || "") + "Theme switched to " + it.name + "!"); }
      renderShop(); return Promise.resolve();
    }
    var args = { p_token: A.token(), p_avatar: null, p_color: null, p_frame: null };
    args[it.kind === "avatar" ? "p_avatar" : it.kind === "color" ? "p_color" : "p_frame"] = it.id;
    return A.rpc("gh_set_look", args).then(function (r) {
      if (r.error) { A.flash("You don't own that yet."); return; }
      var ch = {}; ch[it.kind] = it.id; A.setLook(ch);
      A.flash((pre || "") + "Looking good!");
      head(); renderShop();
    }, function (e) { A.flash(A.msg(e)); });
  }
  function card(it) {
    var have = owned(it.kind, it.id), on = wearing(it.kind, it.id), l = A.look();
    var pic = it.kind === "avatar" ? A.face({ avatar: it.id, frame: "none" }, 58)
      : it.kind === "frame" ? A.face({ avatar: l.avatar, frame: it.id }, 58)
      : it.kind === "color" ? '<span class="nm-c">' + A.nameHtml({ username: "Aa", color: it.id }) + "</span>"
      : '<span class="sw" style="background:' + it.swatch + '"></span>';
    var pr = on ? '<span class="pr wear">' + (it.kind === "theme" ? "Using" : "Wearing") + "</span>"
      : have ? '<span class="pr ' + (it.price ? "own" : "free") + '">' + (it.price ? "Owned" : "Free") + "</span>"
      : '<span class="pr">' + COIN + n(it.price) + "</span>";
    return '<button type="button" class="item' + (sel && sel.kind === it.kind && sel.id === it.id ? " sel" : "") + (!have && bal() < it.price ? " cant" : "") + '" data-id="' + esc(it.id) + '">'
      + pic + '<span class="nm">' + esc(it.name) + "</span>" + pr + "</button>";
  }
  function renderShop() {
    var list = items(kind);
    $("items").innerHTML = list.map(card).join("");
    $("items").querySelectorAll(".item").forEach(function (b) {
      b.onclick = function () {
        sel = list.filter(function (i) { return i.id === b.dataset.id; })[0]; armed = null;
        if (sel.kind === "theme") { previewTheme = sel.id; document.documentElement.setAttribute("data-theme", sel.id === "classic" ? "" : sel.id); if (sel.id === "classic") document.documentElement.removeAttribute("data-theme"); }
        else restoreTheme();
        renderShop();
        if (innerWidth < 760) $("try").scrollIntoView({ behavior: "smooth", block: "nearest" });
      };
    });
    tryPanel();
  }
  function restoreTheme() {
    if (!previewTheme || !T) return;
    previewTheme = null;
    var t = T.get();
    if (t === "classic") document.documentElement.removeAttribute("data-theme"); else document.documentElement.setAttribute("data-theme", t);
  }
  $("kinds").querySelectorAll(".chip").forEach(function (c) {
    c.onclick = function () {
      kind = c.dataset.k; sel = null; armed = null; restoreTheme();
      $("kinds").querySelectorAll(".chip").forEach(function (x) { x.classList.toggle("on", x === c); });
      renderShop();
    };
  });

  function confetti() {
    var colors = ["#ffcc33", "#ff5a5f", "#3ddc84", "#37a2ff", "#b36bff"];
    for (var i = 0; i < 40; i++) {
      var d = document.createElement("div");
      d.style.cssText = "position:fixed;z-index:9999;top:-10px;width:9px;height:14px;border-radius:2px;pointer-events:none;left:" + Math.random() * 100 + "vw;background:" + colors[i % 5];
      document.body.appendChild(d);
      d.animate([{ transform: "translateY(0) rotate(0)" }, { transform: "translateY(" + (innerHeight + 40) + "px) rotate(" + (Math.random() * 900 - 450) + "deg)" }],
        { duration: 1400 + Math.random() * 1200, easing: "cubic-bezier(.2,.6,.4,1)" }).onfinish = function () { this.effect.target.remove(); };
    }
  }

  // ---------- friends ----------
  function renderFriends() {
    var p = prof || {}, me = { username: A.user(), avatar: A.look().avatar, frame: A.look().frame, color: A.look().color, level: A.level(p.lifetime || 0), lifetime: p.lifetime || 0, me: true };
    var all = (p.friends || []).concat([me]).sort(function (a, b) { return b.lifetime - a.lifetime; });
    var medal = ["🥇", "🥈", "🥉"];
    $("friends").innerHTML = (p.friends || []).length ? all.map(function (f, i) {
      var on = f.last_seen && Date.now() - new Date(f.last_seen) < 300000;
      return '<div class="rank' + (f.me ? " me" : "") + '" data-u="' + esc(f.username) + '"><span class="n">' + (medal[i] || i + 1) + "</span>" + A.face(f, 40)
        + '<div class="t"><b>' + A.nameHtml(f) + (f.me ? " (you)" : "") + "</b><small>Level " + f.level + " · " + n(f.lifetime) + " earned"
        + (!f.me && f.last_game ? " · " + (on ? '<span class="online-dot"></span>playing ' : "played ") + '<a href="' + esc(f.last_game) + '.html">' + esc(TITLES[f.last_game] || f.last_game) + "</a> " + ago(f.last_seen) : "") + "</small>"
        + '<div class="gift-chips" hidden></div></div>'
        + (f.me ? "" : '<div class="acts"><button class="sbtn go" type="button" data-act="gift">🎁 Gift</button><button class="sbtn x" type="button" data-act="rm" aria-label="Remove friend">✕</button></div>')
        + "</div>";
    }).join("") : '<p>No friends yet. Type a friend\'s player name above, or send them your invite link.</p>';
    $("friends").querySelectorAll(".rank").forEach(function (row) {
      var u = row.dataset.u, g = row.querySelector('[data-act="gift"]'), x = row.querySelector('[data-act="rm"]');
      if (g) g.onclick = function () {
        var box = row.querySelector(".gift-chips"), left = 100 - (prof.gifts_sent_today || 0);
        box.hidden = !box.hidden;
        box.innerHTML = left <= 0 ? '<small>You\'ve given 100 today. More tomorrow!</small>' : [5, 10, 25, 50].filter(function (v) { return v <= left; }).map(function (v) {
          return '<button class="sbtn" type="button" data-v="' + v + '">' + COIN + " " + v + "</button>";
        }).join("");
        box.querySelectorAll("[data-v]").forEach(function (b) {
          b.onclick = function () {
            b.disabled = true;
            A.rpc("gh_gift", { p_token: A.token(), p_username: u, p_amount: +b.dataset.v }).then(function (r) {
              if (r.error) { A.flash(r.error === "not_enough" ? "Not enough PhatCoin" : r.error === "gift_max" ? "That's the most you can give today" : "Couldn't send it"); b.disabled = false; return; }
              if (window.gtag) window.gtag("event", "gift", { amount: +b.dataset.v });
              A.flash("Sent " + b.dataset.v + " PhatCoin to " + u + "!");
              if (P) P.refresh(); load();
            }, function (e) { A.flash(A.msg(e)); b.disabled = false; });
          };
        });
      };
      if (x) x.onclick = function () {
        if (x.textContent !== "Sure?") { x.textContent = "Sure?"; setTimeout(function () { x.textContent = "✕"; }, 3000); return; }
        A.rpc("gh_friend_remove", { p_token: A.token(), p_username: u }).then(load);
      };
    });
    var reqs = p.requests || [];
    $("reqCard").hidden = !reqs.length;
    $("reqs").innerHTML = reqs.map(function (f) {
      return '<div class="rank" data-u="' + esc(f.username) + '">' + A.face(f, 40) + '<div class="t"><b>' + A.nameHtml(f) + "</b><small>Level " + f.level + " wants to be friends</small></div>"
        + '<div class="acts"><button class="sbtn go" type="button" data-yes="1">Yes</button><button class="sbtn x" type="button" data-yes="0">No</button></div></div>';
    }).join("");
    $("reqs").querySelectorAll("[data-yes]").forEach(function (b) {
      b.onclick = function () {
        var u = b.closest(".rank").dataset.u;
        A.rpc("gh_friend_answer", { p_token: A.token(), p_username: u, p_yes: b.dataset.yes === "1" }).then(load);
      };
    });
    var gifts = p.gifts_in || [];
    $("giftCard").hidden = !gifts.length;
    $("gifts").innerHTML = gifts.map(function (g) {
      return '<div class="rank"><span class="n">🎁</span><div class="t"><b>' + COIN + " " + n(g.amount) + " from " + esc(g.from) + "</b><small>" + ago(g.at) + "</small></div></div>";
    }).join("");
    var asked = p.asked || [];
    if (asked.length && !$("frMsg").dataset.keep) $("frMsg").textContent = "Waiting for " + asked.join(", ") + " to say yes.";
  }
  function addFriend() {
    var u = $("frName").value.trim().toLowerCase();
    if (u.length < 3) return;
    $("frMsg").dataset.keep = "1";
    A.rpc("gh_friend_add", { p_token: A.token(), p_username: u }).then(function (r) {
      $("frMsg").textContent = r.error === "no_user" ? "There's no player called " + u + ". Check the spelling."
        : r.error === "self" ? "That's you!" : r.error ? "Couldn't add them right now."
        : r.status === "friends" ? "You and " + u + " are friends now!" : "Asked " + u + ". They'll see it next time they play.";
      if (!r.error) $("frName").value = "";
      load();
    }, function (e) { $("frMsg").textContent = A.msg(e); });
  }
  $("frAdd").onclick = addFriend;
  $("frName").addEventListener("keydown", function (e) { if (e.key === "Enter") addFriend(); });
  $("frName").addEventListener("input", function () { var v = this.value.toLowerCase().replace(/[^a-z0-9_]/g, ""); if (v !== this.value) this.value = v; });

  // ---------- invite ----------
  function renderInvite() {
    $("invLink").textContent = A.inviteUrl().replace("https://", "");
    var p = prof || {};
    $("invStats").innerHTML = (p.invites_joined || 0) ? n(p.invites_joined) + " friend" + (p.invites_joined === 1 ? "" : "s") + " joined with your link. " + n(p.invites_paid) + " ha" + (p.invites_paid === 1 ? "s" : "ve") + " played enough for your bonus." : "Nobody has joined with your link yet.";
  }
  $("invShare").onclick = function () { A.share({ what: "invite", text: "Come and play GH Games with me! Use my link and we both get PhatCoin.", url: A.inviteUrl() }); };
  $("invCopy").onclick = function () {
    var b = this;
    (navigator.clipboard ? navigator.clipboard.writeText(A.inviteUrl()) : Promise.reject()).then(function () { b.textContent = "Copied ✓"; setTimeout(function () { b.textContent = "Copy"; }, 2000); });
  };

  // ---------- account ----------
  $("accLink").onclick = function () { A.linkMakeView(); };
  $("accMore").onclick = function () { A.open(); };
  var deferred = null;
  window.addEventListener("beforeinstallprompt", function (e) { e.preventDefault(); deferred = e; $("installBtn").hidden = false; });
  $("installBtn").onclick = function () { if (deferred) { deferred.prompt(); deferred = null; $("installBtn").hidden = true; } };
  if (window.matchMedia && matchMedia("(display-mode: standalone)").matches) $("installTxt").textContent = "You're already using GH Games from your home screen. Nice.";

  // ---------- tabs ----------
  function tab(t) {
    t = t || "shop";
    if (t.indexOf("shop-") === 0) { kind = t.slice(5) === "themes" ? "theme" : t.slice(5); t = "shop"; $("kinds").querySelectorAll(".chip").forEach(function (x) { x.classList.toggle("on", x.dataset.k === kind); }); }
    document.querySelectorAll(".tabsbar button").forEach(function (b) { b.classList.toggle("on", b.dataset.tab === t); });
    document.querySelectorAll(".panel").forEach(function (p) { p.classList.toggle("on", p.id === "p-" + t); });
    if (t !== "shop") restoreTheme();
  }
  document.querySelectorAll(".tabsbar button").forEach(function (b) {
    b.onclick = function () { history.replaceState(null, "", "#" + b.dataset.tab); tab(b.dataset.tab); };
  });

  // ---------- load ----------
  function paintAll() { head(); renderShop(); renderFriends(); renderInvite(); }
  function load() {
    return Promise.all([
      A.refreshLook().then(function (p) { if (p) prof = p; }),
      shop.length ? null : A.rpc("gh_shop", {}).then(function (s) { shop = s || []; }, function () {}),
      P ? P.refresh() : null
    ]).then(paintAll, paintAll);
  }
  var lastTok = null;
  function watch() {
    var t = A.token() || "";
    if (t === lastTok) return;
    lastTok = t;
    $("guest").hidden = !!t; $("member").hidden = !t;
    if (t) { tab(location.hash.slice(1)); paintAll(); load(); }
  }
  $("guestNew").onclick = function () { A.open("new"); };
  $("guestLogin").onclick = function () { A.open("login"); };
  watch();
  setInterval(watch, 1500);
  if (P) P.onChange(function () { if (A.token()) { head(); tryPanel(); } });
  setInterval(function () { if (A.token() && !document.hidden) load(); }, 60000);
})();
