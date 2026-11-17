(function(){
  var $ = function(id){ return document.getElementById(id); };
  var stage = $("stage"); if (!stage) return;
  document.body.classList.add("pa");
  var store = { get:function(k){ try { return localStorage.getItem(k); } catch(e){ return null; } }, set:function(k,v){ try { localStorage.setItem(k,v); } catch(e){} } };

  // HUD chips into the game view
  var hud = document.querySelector(".top .hud");
  if (hud) { hud.classList.add("pa-hud"); stage.appendChild(hud); }

  // Dock: Shop, Records, Auto
  var dock = document.createElement("div"); dock.className = "pa-dock";
  dock.innerHTML = '<button id="paShop">🛒 Shop<i id="paBadge">!</i></button><button id="paRec" title="Biggest poo">🏆</button><button id="paAuto">🤖 <span id="paAutoT">Auto</span></button>';
  stage.appendChild(dock);

  // Drawer holding the tabs and panels
  var dr = document.createElement("div"); dr.className = "pa-drawer"; dr.id = "paDrawer";
  dr.innerHTML = '<div class="pa-dhead"><b>Shop</b><span class="coins">🪙 <span id="paCoins">0</span></span><button id="paClose" title="Close">✕</button></div><div class="pa-dbody" id="paBody"></div>';
  stage.appendChild(dr);
  ["tabs","pFood","pWorlds","pReb"].forEach(function(id){ var el = $(id); if (el) $("paBody").appendChild(el); });

  var stop = function(e){ e.stopPropagation(); };
  ["pointerdown","mousedown","touchstart","wheel"].forEach(function(ev){ dock.addEventListener(ev, stop); dr.addEventListener(ev, stop, {passive:true}); });
  function openShop(){ dr.classList.add("open"); store.set("pa_shop_seen","1"); }
  function closeShop(){ dr.classList.remove("open"); }
  $("paShop").onclick = openShop; $("paClose").onclick = closeShop;
  $("paRec").onclick = function(){ var b = $("bRec"); if (b) b.click(); };
  $("paAuto").onclick = function(){ var b = $("bAuto"); if (b && !b.disabled) b.click(); else openShop(); };
  addEventListener("keydown", function(e){ if (e.key === "Escape" && dr.classList.contains("open")) { /* Escape also leaves fullscreen; just close */ closeShop(); } if ((e.key === "b" || e.key === "B") && !e.repeat) { dr.classList.contains("open") ? closeShop() : openShop(); } });

  // Badge when something is affordable; mirror Auto button
  function canBuy(){
    var sel = '#foods .b1:not(:disabled), #worlds .wb.green:not(:disabled), #doReb:not(:disabled)';
    return !!document.querySelector(sel);
  }
  setInterval(function(){
    var has = canBuy();
    $("paShop").classList.toggle("has", has && !dr.classList.contains("open"));
    var c = $("hCoins"); if (c) $("paCoins").textContent = c.textContent;
    var a = $("bAuto"); if (a) { var t = a.textContent.replace(/^\s*🤖\s*/, "").trim(); $("paAutoT").textContent = t.length > 18 ? "Auto" : t; }
    if (has && !store.get("pa_shop_seen") && !store.get("pa_tip_shop") && poos >= 1 && !coach) shopTip();
  }, 400);

  // First-play coach: hand on the PUSH button, arrow at the gold zone
  var poos = 0, coach = null;
  var l1 = $("bigL1");
  if (l1 && window.MutationObserver) new MutationObserver(function(){ if (l1.textContent) { poos++; if (coach && coach.kind === "push" && poos >= 2) endCoach(); } }).observe(l1, { childList:true, characterData:true, subtree:true });
  function endCoach(){ if (coach) { coach.el.remove(); if (coach.skip) coach.skip.remove(); coach = null; } }
  function place(el, x, y){ el.style.left = x + "px"; el.style.top = y + "px"; }
  function pushCoach(){
    var c = document.createElement("div"); c.className = "pa-coach";
    c.innerHTML = '<div class="tip" id="paTip">Hold to push!<small>Hold the big button, the screen or Space, and let go when the meter hits the GOLD zone.</small></div><div class="hand" id="paHand">👇</div><div class="gold" id="paGold">◀ let go here!</div>';
    stage.appendChild(c);
    var sk = document.createElement("button"); sk.className = "pa-skip"; sk.textContent = "Skip tips"; sk.onclick = function(){ store.set("pa_coached","1"); store.set("pa_tip_shop","1"); endCoach(); };
    sk.addEventListener("pointerdown", stop); stage.appendChild(sk);
    coach = { el:c, skip:sk, kind:"push" };
    function lay(){
      if (!coach || coach.kind !== "push") return;
      var s = stage.getBoundingClientRect(), b = $("bP").getBoundingClientRect(), m = $("meter").getBoundingClientRect(), g = $("mGold").getBoundingClientRect();
      var hand = $("paHand"), tip = $("paTip"), gold = $("paGold");
      place(hand, b.left - s.left + b.width/2 - 26, b.top - s.top - 62);
      place(tip, Math.max(8, b.left - s.left - 250), Math.max(8, b.top - s.top - 150));
      place(gold, m.right - s.left + 8, (g.height ? g.top + g.height/2 : m.top + 20) - s.top - 12);
      requestAnimationFrame(lay);
    }
    lay();
  }
  function shopTip(){
    store.set("pa_tip_shop","1");
    var c = document.createElement("div"); c.className = "pa-coach";
    c.innerHTML = '<div class="tip" id="paTip2">You can buy food!<small>Food gives more push power, so bigger poos and more coins.</small></div><div class="hand" id="paHand2">👇</div>';
    stage.appendChild(c); coach = { el:c, kind:"shop" };
    var s = stage.getBoundingClientRect(), b = $("paShop").getBoundingClientRect();
    place($("paHand2"), b.left - s.left + b.width/2 - 26, b.top - s.top - 62);
    place($("paTip2"), b.left - s.left, Math.max(8, b.top - s.top - 140));
    var done = function(){ endCoach(); $("paShop").removeEventListener("click", done); };
    $("paShop").addEventListener("click", done);
    setTimeout(function(){ if (coach && coach.kind === "shop") endCoach(); }, 9000);
  }
  if (!store.get("pa_coached")) { store.set("pa_coached","1"); setTimeout(pushCoach, 600); }
  setTimeout(function(){ window.dispatchEvent(new Event("resize")); }, 50);
})();
