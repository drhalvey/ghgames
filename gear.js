/* GH Games: gear.js, Experience (XP) and the Accessories you wear in every game
   ------------------------------------------------------------------------------
   Load after account.js (and after three.js on 3D pages):
     <script src="gear.js"></script>

   XP is the rare currency (PhatCoin is the common one). It lives in the player's
   account and is earned on the server, so games never pay it out themselves:
     playing any game  1 XP a minute       winning   1 XP (one per 15 s)
     rebirth           3 XP (one a minute)   most from play in a day: 200
     daily quests      3 a day, 30-60 XP each, all three = a free crate key
     levels            every new level = a crate key, some levels give exclusive gear
   Spend XP in the Changing Room (wardrobe.html) on hats, face stuff, backs, auras,
   trails and bodies, or open crates for crate-only Secret gear.

   For games (all on window.Gear):
     Gear.dress(root, opts)  -> puts the player's equipped gear on a THREE.Object3D
        opts (all optional, in root's own units):
          forward: "z" | "-z" | "x" | "-x"   which way the character faces (default "z")
          height:  number   feet-to-top height (default: measured)
          feet:    number   y of the feet in root space (default: measured)
          head:    Object3D the head mesh/group; hats and face gear stick to it
          headTop, headSize, headZ: numbers, if there is no head object
          torso:   Object3D the body/torso, backs stick to it
          body:    array of meshes (or "all") that body skins repaint
          slots:   { hat:false, face:false, back:false, aura:false, trail:false, body:false }
        returns { refresh(), remove() }. The look updates by itself when it changes.
     Gear.undress(root)
     Gear.on()               -> { hat, face, back, aura, trail, body } item ids being worn
     Gear.onChange(fn)
   For the Changing Room:  Gear.items, Gear.RAR, Gear.CRATES, Gear.state(), Gear.refresh(),
     Gear.buy(id), Gear.crate(kind, useKey), Gear.equip(slot, id), Gear.claimQuest(i),
     Gear.claimBonus(), Gear.preview(el), Gear.thumb(id, px)
*/
(function () {
  "use strict";
  if (window.Gear) return;

  /* ================= catalogue ================= */
  var RAR = {
    common:    { n: "Common",    c: "#9aa4b2", price: 40,   rank: 1 },
    uncommon:  { n: "Uncommon",  c: "#4fd16a", price: 120,  rank: 2 },
    rare:      { n: "Rare",      c: "#3d8bff", price: 350,  rank: 3 },
    epic:      { n: "Epic",      c: "#b04aff", price: 900,  rank: 4 },
    legendary: { n: "Legendary", c: "#ffb300", price: 2500, rank: 5 },
    mythic:    { n: "Mythic",    c: "#ff3a6a", price: 7000, rank: 6 },
    secret:    { n: "Secret",    c: "#ffffff", price: 0,    rank: 7, value: 5000, rainbow: true },
    level:     { n: "Level",     c: "#2fd3c4", price: 0,    rank: 0 }
  };
  var SLOTS = [
    { id: "hat",   n: "Hats",   one: "Hat",   ic: "🎩" },
    { id: "face",  n: "Face",   one: "Face",  ic: "🕶️" },
    { id: "back",  n: "Backs",  one: "Back",  ic: "🪽" },
    { id: "aura",  n: "Auras",  one: "Aura",  ic: "✨" },
    { id: "trail", n: "Trails", one: "Trail", ic: "💫" },
    { id: "body",  n: "Bodies", one: "Body",  ic: "🧍" }
  ];
  var CRATES = {
    starter: { n: "Starter Crate", price: 100,  c: "#3d8bff", odds: { common: 60, uncommon: 30, rare: 9, epic: 1 } },
    epic:    { n: "Epic Crate",    price: 600,  c: "#b04aff", odds: { uncommon: 25, rare: 45, epic: 25, legendary: 5 } },
    mythic:  { n: "Mythic Crate",  price: 2500, c: "#ff3a6a", odds: { epic: 45, legendary: 35, mythic: 15, secret: 5 } }
  };
  // [id, name, rarity, template, params, level]  (rarity "level" items come free at that level;
  // "secret" items only come out of Mythic Crates)
  var RAW = {
    hat: [
      ["cap-red", "Red Cap", "common", "cap", { c: "#e8423a" }],
      ["cap-blue", "Blue Cap", "common", "cap", { c: "#3d8bff" }],
      ["beanie", "Comfy Beanie", "common", "beanie", { c: "#4fae46", p: "#ffffff" }],
      ["party-hat", "Party Hat", "common", "party", { c: "#ff5aa8", s: "#ffd23f" }],
      ["traffic-cone", "Traffic Cone", "uncommon", "cone", {}],
      ["chef-hat", "Chef Hat", "uncommon", "chef", {}],
      ["cowboy-hat", "Cowboy Hat", "uncommon", "cowboy", { c: "#8a5a2a" }],
      ["bunny-ears", "Bunny Ears", "uncommon", "ears", { c: "#ffffff", i: "#ffb3c8", kind: "bunny" }],
      ["cat-ears", "Cat Ears", "uncommon", "ears", { c: "#333333", i: "#ff8ab0", kind: "cat" }],
      ["top-hat", "Top Hat", "rare", "tophat", { c: "#1a1a22", b: "#e8423a" }],
      ["viking-helmet", "Viking Helmet", "rare", "viking", {}],
      ["pirate-hat", "Pirate Hat", "rare", "pirate", {}],
      ["propeller-cap", "Propeller Cap", "rare", "propeller", { c: "#ffd23f" }],
      ["headphones", "DJ Headphones", "rare", "headphones", { c: "#222222", g: "#3dffb0" }],
      ["wizard-hat", "Wizard Hat", "epic", "wizard", { c: "#5a3fae" }],
      ["knight-helmet", "Knight Helmet", "epic", "knight", {}],
      ["devil-horns", "Devil Horns", "epic", "horns", { c: "#d81e1e" }],
      ["antlers", "Reindeer Antlers", "epic", "antlers", {}],
      ["poo-hat", "Poo Hat", "epic", "poo", { c: "#7a4a1e" }],
      ["crown-gold", "Gold Crown", "legendary", "crown", { c: "#ffcc33", g: "#e8423a" }],
      ["astronaut-helmet", "Astronaut Helmet", "legendary", "astro", {}],
      ["pumpkin-head", "Pumpkin Head", "legendary", "pumpkin", {}],
      ["halo", "Angel Halo", "mythic", "halo", { c: "#fff6a0" }],
      ["flame-crown", "Flame Crown", "mythic", "flamecrown", {}],
      ["cosmic-crown", "Cosmic Crown", "secret", "crown", { c: "#2a1a6a", g: "#d27bff", glow: 1, stars: 1 }],
      ["golden-poo", "Golden Poo Hat", "secret", "poo", { c: "#ffcc33", metal: 1 }],
      ["rookie-cap", "Rookie Cap", "level", "cap", { c: "#2fd3c4", star: 1 }, 5],
      ["bronze-crown", "Bronze Crown", "level", "crown", { c: "#c98a4a", g: "#3d8bff" }, 10],
      ["mythic-halo", "Double Halo", "level", "halo", { c: "#ff5aa8", double: 1 }, 75],
      ["arcade-god-crown", "Arcade God Crown", "level", "crown", { c: "#ffffff", g: "#ff3ab0", glow: 1, rainbow: 1 }, 100]
    ],
    face: [
      ["shades", "Cool Shades", "common", "shades", { c: "#111111" }],
      ["shades-pink", "Pink Shades", "common", "shades", { c: "#ff5aa8" }],
      ["moustache", "Moustache", "common", "moustache", { c: "#4a2a10" }],
      ["clown-nose", "Clown Nose", "common", "nose", {}],
      ["nerd-glasses", "Nerd Glasses", "uncommon", "nerd", {}],
      ["eyepatch", "Eyepatch", "uncommon", "eyepatch", {}],
      ["doctor-mask", "Doctor Mask", "uncommon", "mask", { c: "#8fd0ff" }],
      ["3d-glasses", "3D Glasses", "uncommon", "glasses3d", {}],
      ["heart-glasses", "Heart Glasses", "rare", "heartglasses", { c: "#ff3a6a" }],
      ["star-glasses", "Star Glasses", "rare", "starglasses", { c: "#ffd23f" }],
      ["monocle", "Fancy Monocle", "rare", "monocle", {}],
      ["beard", "Big Beard", "rare", "beard", { c: "#6a3a1a" }],
      ["ninja-mask", "Ninja Mask", "epic", "ninja", { c: "#222222", b: "#e8423a" }],
      ["goggles", "Ski Goggles", "epic", "goggles", { c: "#3dffb0" }],
      ["vr-headset", "VR Headset", "epic", "vr", {}],
      ["cyber-visor", "Cyber Visor", "legendary", "visor", { c: "#3df0ff" }],
      ["gold-shades", "Gold Shades", "legendary", "shades", { c: "#ffcc33", metal: 1 }],
      ["laser-eyes", "Laser Eyes", "mythic", "laser", { c: "#ff2a2a" }],
      ["void-eyes", "Void Eyes", "secret", "laser", { c: "#b04aff" }],
      ["star-glasses-pro", "Star Glasses Pro", "level", "starglasses", { c: "#2fd3c4", glow: 1 }, 25]
    ],
    back: [
      ["cape-red", "Red Cape", "common", "cape", { c: "#d81e1e" }],
      ["cape-blue", "Blue Cape", "common", "cape", { c: "#2a5ad8" }],
      ["backpack", "School Backpack", "common", "backpack", { c: "#3d8bff" }],
      ["cricket-bat", "Cricket Bat", "uncommon", "bat", {}],
      ["sword-back", "Sword", "uncommon", "sword", {}],
      ["turtle-shell", "Turtle Shell", "uncommon", "shell", {}],
      ["guitar", "Rock Guitar", "rare", "guitar", { c: "#e8423a" }],
      ["shield", "Knight Shield", "rare", "shield", {}],
      ["butterfly-wings", "Butterfly Wings", "rare", "wings", { kind: "butterfly", c: "#ff8a3d", c2: "#3d8bff" }],
      ["bat-wings", "Bat Wings", "rare", "wings", { kind: "bat", c: "#2a1a3a" }],
      ["cape-royal", "Royal Cape", "epic", "cape", { c: "#6a1a9a", t: "#ffcc33" }],
      ["angel-wings", "Angel Wings", "epic", "wings", { kind: "feather", c: "#ffffff" }],
      ["fairy-wings", "Fairy Wings", "epic", "wings", { kind: "fairy", c: "#bff8ff" }],
      ["jetpack", "Jetpack", "epic", "jetpack", {}],
      ["robot-wings", "Robot Wings", "legendary", "wings", { kind: "robot", c: "#9aa4b2", g: "#3df0ff" }],
      ["dragon-wings", "Dragon Wings", "legendary", "wings", { kind: "bat", c: "#2a8a3a", g: "#7dff3a" }],
      ["ice-wings", "Ice Wings", "legendary", "wings", { kind: "feather", c: "#9ee8ff", glow: 1, op: 0.8 }],
      ["rainbow-wings", "Rainbow Wings", "mythic", "wings", { kind: "feather", rainbow: 1 }],
      ["phoenix-wings", "Phoenix Wings", "mythic", "wings", { kind: "feather", c: "#ff8a3d", fire: 1, glow: 1 }],
      ["void-wings", "Void Wings", "secret", "wings", { kind: "bat", c: "#120424", g: "#b04aff", glow: 1 }],
      ["veteran-cape", "Veteran Cape", "level", "cape", { c: "#2fd3c4", t: "#ffffff" }, 15],
      ["silver-wings", "Silver Wings", "level", "wings", { kind: "feather", c: "#c8d0d8", metal: 1 }, 20]
    ],
    aura: [
      ["aura-blue-ring", "Blue Ring", "common", "ring", { c: "#3d8bff", n: 1 }],
      ["aura-sparkle", "Sparkles", "uncommon", "rise", { c: "#fff6a0", shape: "spark" }],
      ["aura-hearts", "Heart Aura", "uncommon", "orbit", { shape: "heart", c: "#ff5aa8", n: 5 }],
      ["aura-bubbles", "Bubbles", "uncommon", "rise", { shape: "bubble", c: "#bff8ff" }],
      ["aura-leaves", "Leaf Swirl", "rare", "orbit", { shape: "leaf", c: "#4fae46", n: 8 }],
      ["aura-fire", "Fire Aura", "rare", "rise", { shape: "fire", c: "#ff8a3d" }],
      ["aura-frost", "Frost Aura", "rare", "rise", { shape: "snow", c: "#dff8ff" }],
      ["aura-music", "Music Notes", "epic", "orbit", { shape: "note", c: "#ffd23f", n: 6 }],
      ["aura-lightning", "Lightning", "epic", "bolt", { c: "#9ee8ff" }],
      ["aura-toxic", "Toxic Cloud", "epic", "shell", { c: "#7dff3a" }],
      ["aura-coins", "Coin Storm", "legendary", "orbit", { shape: "coin", c: "#ffcc33", n: 10 }],
      ["aura-rainbow", "Rainbow Rings", "legendary", "ring", { rainbow: 1, n: 3 }],
      ["aura-galaxy", "Galaxy Aura", "mythic", "orbit", { shape: "star", c: "#d27bff", n: 14, shellc: "#5a2aae" }],
      ["aura-void", "Void Aura", "mythic", "shell", { c: "#6a1aff", dark: 1 }],
      ["black-hole-aura", "Black Hole", "secret", "ring", { c: "#ff8a3d", n: 4, hole: 1 }],
      ["golden-aura", "Golden Aura", "level", "ring", { c: "#ffcc33", n: 2 }, 30]
    ],
    trail: [
      ["trail-puff", "Puff Trail", "common", "trail", { shape: "cube", c: "#ffffff" }],
      ["trail-sparkle", "Sparkle Trail", "common", "trail", { shape: "spark", c: "#fff6a0" }],
      ["trail-hearts", "Heart Trail", "uncommon", "trail", { shape: "heart", c: "#ff5aa8" }],
      ["trail-bubbles", "Bubble Trail", "uncommon", "trail", { shape: "bubble", c: "#bff8ff" }],
      ["trail-leaves", "Leaf Trail", "uncommon", "trail", { shape: "leaf", c: "#4fae46" }],
      ["trail-stars", "Star Trail", "rare", "trail", { shape: "star", c: "#ffd23f" }],
      ["trail-snow", "Snow Trail", "rare", "trail", { shape: "snow", c: "#ffffff" }],
      ["trail-notes", "Music Trail", "rare", "trail", { shape: "note", c: "#d27bff" }],
      ["trail-fire", "Fire Trail", "epic", "trail", { shape: "fire", c: "#ff8a3d" }],
      ["trail-coins", "Coin Trail", "epic", "trail", { shape: "coin", c: "#ffcc33" }],
      ["trail-poo", "Poo Trail", "epic", "trail", { shape: "poo", c: "#7a4a1e" }],
      ["trail-rainbow", "Rainbow Trail", "legendary", "trail", { shape: "cube", rainbow: 1 }],
      ["trail-zap", "Zap Trail", "legendary", "trail", { shape: "spark", c: "#9ee8ff", big: 1 }],
      ["trail-galaxy", "Galaxy Trail", "mythic", "trail", { shape: "star", c: "#d27bff", glow: 1, big: 1 }],
      ["rainbow-poo-trail", "Rainbow Poo Trail", "secret", "trail", { shape: "poo", rainbow: 1 }],
      ["champion-trail", "Champion Trail", "level", "trail", { shape: "star", c: "#2fd3c4", glow: 1 }, 40]
    ],
    body: [
      ["body-red", "Red Paint", "common", "mat", { c: "#e8423a" }],
      ["body-blue", "Blue Paint", "common", "mat", { c: "#3d8bff" }],
      ["body-bronze", "Bronze", "uncommon", "mat", { c: "#c98a4a", metal: 0.6, rough: 0.35 }],
      ["body-zombie", "Zombie Skin", "uncommon", "mat", { c: "#6fae4a", rough: 1 }],
      ["body-camo", "Camo", "uncommon", "tex", { tex: "camo" }],
      ["body-candy", "Candy Stripes", "rare", "tex", { tex: "candy" }],
      ["body-marble", "Marble", "rare", "tex", { tex: "marble" }],
      ["body-ice", "Ice", "rare", "mat", { c: "#9ee8ff", op: 0.8, rough: 0.1, glow: "#1a4a6a" }],
      ["body-emerald", "Emerald", "epic", "mat", { c: "#1ec26a", flat: 1, metal: 0.3, glow: "#063a1e" }],
      ["body-ruby", "Ruby", "epic", "mat", { c: "#e8203a", flat: 1, metal: 0.3, glow: "#3a060c" }],
      ["body-shadow", "Shadow", "epic", "mat", { c: "#141018", glow: "#24083e" }],
      ["body-neon", "Neon Glow", "epic", "mat", { c: "#3dffb0", glow: "#20c080" }],
      ["body-gold", "Solid Gold", "legendary", "mat", { c: "#ffcc33", metal: 0.7, rough: 0.25, glow: "#3a2600" }],
      ["body-diamond", "Diamond", "legendary", "mat", { c: "#bff8ff", flat: 1, metal: 0.3, glow: "#2a5a6a" }],
      ["body-ghost", "Ghost", "legendary", "mat", { c: "#ffffff", op: 0.45, glow: "#6a7aff" }],
      ["body-lava", "Lava", "legendary", "tex", { tex: "lava" }],
      ["body-galaxy", "Galaxy", "mythic", "tex", { tex: "galaxy" }],
      ["body-rainbow", "Rainbow", "mythic", "rainbow", {}],
      ["body-glitch", "Glitch", "secret", "glitch", {}],
      ["body-platinum", "Platinum", "level", "mat", { c: "#e6ecf2", metal: 0.6, rough: 0.2, glow: "#2a3040" }, 50]
    ]
  };
  var ITEMS = [], BY = {};
  SLOTS.forEach(function (s) {
    RAW[s.id].forEach(function (r, i) {
      var it = { id: r[0], slot: s.id, name: r[1], rarity: r[2], t: r[3], p: r[4] || {}, level: r[5] || 0, sort: i };
      it.price = RAR[it.rarity].price;
      it.source = it.rarity === "level" ? "level" : it.rarity === "secret" ? "crate" : "shop";
      ITEMS.push(it); BY[it.id] = it;
    });
  });

  /* ================= state, from the server ================= */
  var KEY = "ghgear";
  function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  function token() { return lsGet("ghacct_token"); }
  var S = (function () { try { return JSON.parse(lsGet(KEY) || "null"); } catch (e) { return null; } })() || {};
  S.on = S.on || {}; S.owned = S.owned || [];
  var listeners = [];
  function emit() {
    lsSet(KEY, JSON.stringify(S));
    listeners.forEach(function (f) { try { f(S); } catch (e) {} });
    redressAll();
  }
  function rpc(fn, args) {
    if (!window.GHAccount || !window.GHAccount.rpc) return Promise.reject(new Error("no_account"));
    return window.GHAccount.rpc(fn, args);
  }
  function wearing() { return token() ? S.on : {}; }
  function apply(r) {
    if (!r || typeof r !== "object") return;
    var oldLevel = S.level;
    ["balance", "lifetime", "level", "level_start", "next_level", "keys", "owned", "on", "quests", "bonus_ready", "bonus_claimed", "earned_today", "cap"].forEach(function (k) {
      if (r[k] !== undefined && r[k] !== null) S[k] = r[k];
    });
    if (!S.on || Array.isArray(S.on)) S.on = {};
    S.user = window.GHAccount && window.GHAccount.user && window.GHAccount.user();
    if (oldLevel && S.level > oldLevel) toast("Level " + S.level + "!", "+" + (S.level - oldLevel) + " crate key" + (S.level - oldLevel > 1 ? "s" : "") + levelPrize(oldLevel, S.level));
    emit();
  }
  function levelPrize(a, b) {
    var got = ITEMS.filter(function (it) { return it.level > a && it.level <= b; });
    return got.length ? " and " + got.map(function (g) { return g.name; }).join(", ") : "";
  }
  function refresh() {
    if (!token()) { S = { on: {}, owned: [] }; emit(); return Promise.resolve(S); }
    return rpc("gh_gear_state", { p_token: token() }).then(function (r) { apply(r); return S; }, function () { return S; });
  }
  function buy(id) {
    return rpc("gh_gear_buy", { p_token: token(), p_item: id }).then(function (r) { if (!r.error) apply(r); return r; });
  }
  function crate(kind, useKey) {
    return rpc("gh_gear_crate", { p_token: token(), p_crate: kind, p_key: !!useKey }).then(function (r) { if (!r.error) apply(r); return r; });
  }
  function equip(slot, id) {
    var prev = S.on[slot];
    if (id) S.on[slot] = id; else delete S.on[slot];
    emit();
    return rpc("gh_gear_equip", { p_token: token(), p_slot: slot, p_item: id || null }).then(function (r) {
      if (r && r.error) { if (prev) S.on[slot] = prev; else delete S.on[slot]; emit(); }
      return r;
    });
  }
  function claimQuest(i) { return rpc("gh_gear_quest", { p_token: token(), p_idx: i }).then(function (r) { if (!r.error) apply(r); return r; }); }
  function claimBonus() { return rpc("gh_gear_bonus", { p_token: token() }).then(function (r) { if (!r.error) apply(r); return r; }); }

  // the PhatCoin earn calls also earn XP on the server; phatcoin.js fires "gh-xp" with the result
  var pendingXp = 0, xpT = null;
  window.addEventListener("gh-xp", function (e) {
    var d = e.detail || {};
    if (d.balance != null) S.balance = d.balance;
    if (d.lifetime != null) S.lifetime = d.lifetime;
    if (d.level != null && S.level && d.level > S.level) { refresh(); return; }
    if (d.level != null) S.level = d.level;
    if (d.amount > 0) {
      pendingXp += d.amount;
      clearTimeout(xpT);
      xpT = setTimeout(function () { bump("+" + pendingXp + " XP"); pendingXp = 0; }, 400);
    }
    lsSet(KEY, JSON.stringify(S));
    listeners.forEach(function (f) { try { f(S); } catch (er) {} });
  });

  /* ================= little messages ================= */
  function css() {
    if (document.getElementById("gear-css")) return;
    var st = document.createElement("style"); st.id = "gear-css";
    st.textContent = ".gear-bump{position:fixed;right:14px;bottom:70px;z-index:2147483000;font:900 15px Nunito,Arial Black,Arial,sans-serif;color:#fff;background:linear-gradient(135deg,#7a3aff,#2fd3c4);padding:4px 10px;border-radius:999px;box-shadow:0 4px 14px rgba(0,0,0,.35);animation:gearUp 1.4s ease-out forwards;pointer-events:none}"
      + "@keyframes gearUp{0%{opacity:0;transform:translateY(10px)}15%{opacity:1}100%{opacity:0;transform:translateY(-34px)}}"
      + ".gear-toast{position:fixed;left:50%;top:16px;transform:translateX(-50%);z-index:2147483001;background:linear-gradient(135deg,#2a1260,#0f3a4a);color:#fff;border:2px solid #2fd3c4;border-radius:16px;padding:10px 18px;font:800 15px Nunito,Arial,sans-serif;text-align:center;box-shadow:0 10px 30px rgba(0,0,0,.45);pointer-events:none}.gear-toast b{display:block;font-size:20px;color:#ffe14a}";
    document.head.appendChild(st);
  }
  function bump(t) {
    if (!document.body) return; css();
    var d = document.createElement("div"); d.className = "gear-bump"; d.textContent = t;
    document.body.appendChild(d); setTimeout(function () { d.remove(); }, 1500);
  }
  function toast(t, sub) {
    if (!document.body) return; css();
    var d = document.createElement("div"); d.className = "gear-toast";
    d.innerHTML = "<b></b><span></span>"; d.firstChild.textContent = t; d.lastChild.textContent = sub || "";
    document.body.appendChild(d); setTimeout(function () { d.remove(); }, 3200);
  }

  /* ================= 3D: building blocks ================= */
  function T() { return window.THREE; }
  var matCache = {};
  function mat(color, o) {
    o = o || {};
    var k = color + "|" + JSON.stringify(o);
    if (matCache[k]) return matCache[k];
    var m = new (T().MeshStandardMaterial)({
      color: color, roughness: o.rough != null ? o.rough : 0.55, metalness: o.metal || 0,
      emissive: o.glow ? (o.glowc || color) : 0x000000, emissiveIntensity: o.glow ? (o.gi || 0.6) : 1,
      transparent: o.op != null && o.op < 1, opacity: o.op != null ? o.op : 1, flatShading: !!o.flat,
      side: o.double ? T().DoubleSide : T().FrontSide, depthWrite: !(o.op != null && o.op < 0.6)
    });
    return (matCache[k] = m);
  }
  function M(geo, color, o) { var m = new (T().Mesh)(geo, color && color.isMaterial ? color : mat(color, o)); m.castShadow = true; m.userData.gear = true; return m; }
  function box(w, h, d, c, o) { return M(new (T().BoxGeometry)(w, h, d), c, o); }
  function ball(r, c, o, ws, hs) { return M(new (T().SphereGeometry)(r, ws || 18, hs || 12), c, o); }
  function cyl(rt, rb, h, c, seg, o) { return M(new (T().CylinderGeometry)(rt, rb, h, seg || 18), c, o); }
  function cone(r, h, c, seg, o) { return M(new (T().ConeGeometry)(r, h, seg || 18), c, o); }
  function torus(r, t, c, o, arc) { return M(new (T().TorusGeometry)(r, t, 10, 32, arc || Math.PI * 2), c, o); }
  function at(o, x, y, z) { o.position.set(x || 0, y || 0, z || 0); return o; }
  function grp() { var g = new (T().Group)(); g.userData.gear = true; return g; }
  function add(g) { for (var i = 1; i < arguments.length; i++) g.add(arguments[i]); return g; }
  function hueColor(t, off) { var c = new (T().Color)(); c.setHSL(((t * 0.25 + (off || 0)) % 1 + 1) % 1, 0.9, 0.58); return c; }
  function rainbowTick(meshes, speed) {
    return function (t) { meshes.forEach(function (m, i) { var c = hueColor(t * (speed || 1), i / Math.max(1, meshes.length)); m.material.color.copy(c); if (m.material.emissive) m.material.emissive.copy(c).multiplyScalar(0.35); }); };
  }
  function own(m) { m.material = m.material.clone(); return m; }

  // flat 2D shapes for trails and auras
  var shapeGeo = {};
  function shape2(kind) {
    var THREE = T();
    if (shapeGeo[kind]) return shapeGeo[kind];
    var s = new THREE.Shape(), i;
    if (kind === "star") {
      for (i = 0; i < 10; i++) { var r = i % 2 ? 0.45 : 1, a = i / 10 * Math.PI * 2 + Math.PI / 2; var x = Math.cos(a) * r, y = Math.sin(a) * r; if (i) s.lineTo(x, y); else s.moveTo(x, y); }
    } else if (kind === "heart") {
      s.moveTo(0, -0.9); s.bezierCurveTo(-1.3, 0, -0.7, 1.1, 0, 0.45); s.bezierCurveTo(0.7, 1.1, 1.3, 0, 0, -0.9);
    } else if (kind === "leaf") {
      s.moveTo(0, -1); s.quadraticCurveTo(0.9, 0, 0, 1); s.quadraticCurveTo(-0.9, 0, 0, -1);
    } else if (kind === "note") {
      s.moveTo(0.15, -0.6); s.absarc(-0.15, -0.6, 0.32, 0, Math.PI * 2, false);
      var st = new THREE.Shape(); st.moveTo(0.12, -0.6); st.lineTo(0.26, -0.6); st.lineTo(0.26, 0.9); st.lineTo(0.7, 0.6); st.lineTo(0.7, 0.85); st.lineTo(0.12, 1.1); st.lineTo(0.12, -0.6);
      shapeGeo[kind] = new THREE.ExtrudeGeometry([s, st], { depth: 0.15, bevelEnabled: false }); return shapeGeo[kind];
    } else if (kind === "snow") {
      for (i = 0; i < 12; i++) { var r2 = i % 2 ? 0.25 : 1, a2 = i / 12 * Math.PI * 2; var x2 = Math.cos(a2) * r2, y2 = Math.sin(a2) * r2; if (i) s.lineTo(x2, y2); else s.moveTo(x2, y2); }
    } else if (kind === "bolt") {
      s.moveTo(0.2, 1); s.lineTo(-0.5, 0); s.lineTo(0, 0); s.lineTo(-0.3, -1); s.lineTo(0.5, 0.15); s.lineTo(0, 0.15); s.lineTo(0.2, 1);
    }
    shapeGeo[kind] = new THREE.ExtrudeGeometry(s, { depth: 0.18, bevelEnabled: false });
    shapeGeo[kind].center();
    return shapeGeo[kind];
  }
  function particle(kind, color, o) {
    o = o || {};
    var g, mo = { glow: 1, gi: o.glow ? 1 : 0.45, op: kind === "bubble" ? 0.45 : undefined, rough: 0.4 };
    switch (kind) {
      case "star": case "heart": case "leaf": case "note": case "snow": case "bolt": return M(shape2(kind), new (T().MeshStandardMaterial)(Object.assign({}, matOpts(color, mo))));
      case "coin": g = cyl(0.8, 0.8, 0.22, new (T().MeshStandardMaterial)(matOpts(color, { metal: 0.6, rough: 0.3, glow: 1, gi: 0.25 })), 16); g.rotation.x = Math.PI / 2; var cg = grp(); cg.add(g); cg.material = g.material; return cg;
      case "bubble": return M(new (T().SphereGeometry)(0.8, 14, 10), new (T().MeshStandardMaterial)(matOpts(color, mo)));
      case "fire": return M(new (T().OctahedronGeometry)(0.8, 0), new (T().MeshStandardMaterial)(matOpts(color, { glow: 1, gi: 1, op: 0.9 })));
      case "spark": return M(new (T().OctahedronGeometry)(0.6, 0), new (T().MeshStandardMaterial)(matOpts(color, { glow: 1, gi: 1 })));
      case "poo": {
        var m2 = new (T().MeshStandardMaterial)(matOpts(color, { rough: 0.7, glow: 1, gi: 0.15 })), p = grp();
        p.add(at(M(new (T().SphereGeometry)(0.8, 12, 8), m2), 0, -0.35, 0), at(M(new (T().SphereGeometry)(0.6, 12, 8), m2), 0, 0.2, 0), at(M(new (T().ConeGeometry)(0.45, 0.7, 12), m2), 0, 0.75, 0));
        p.scale.y = 0.8; p.material = m2; return p;
      }
      default: return M(new (T().BoxGeometry)(1, 1, 1), new (T().MeshStandardMaterial)(matOpts(color, mo)));
    }
  }
  function matOpts(color, o) {
    return { color: color, roughness: o.rough != null ? o.rough : 0.5, metalness: o.metal || 0, emissive: o.glow ? color : 0x000000, emissiveIntensity: o.gi || 0.5, transparent: o.op != null, opacity: o.op != null ? o.op : 1 };
  }

  // canvas textures for bodies
  var texCache = {};
  function tex(kind) {
    if (texCache[kind]) return texCache[kind];
    var c = document.createElement("canvas"); c.width = c.height = 128; var g = c.getContext("2d"), i;
    var R = function (a) { return Math.random() * a; };
    if (kind === "camo") {
      g.fillStyle = "#5a6a34"; g.fillRect(0, 0, 128, 128);
      ["#3a4a22", "#8a8a52", "#2a2a1a", "#6a7a3a"].forEach(function (col) { g.fillStyle = col; for (i = 0; i < 9; i++) { g.beginPath(); g.ellipse(R(128), R(128), 8 + R(16), 6 + R(10), R(3), 0, 7); g.fill(); } });
    } else if (kind === "candy") {
      for (i = -128; i < 256; i += 32) { g.fillStyle = "#fff"; g.fillRect(0, 0, 0, 0); g.save(); g.translate(i, 0); g.rotate(0.6); g.fillStyle = "#ff3a6a"; g.fillRect(0, -200, 16, 500); g.fillStyle = "#ffffff"; g.fillRect(16, -200, 16, 500); g.restore(); }
    } else if (kind === "marble") {
      g.fillStyle = "#f2efe8"; g.fillRect(0, 0, 128, 128); g.strokeStyle = "rgba(90,90,110,.45)";
      for (i = 0; i < 10; i++) { g.lineWidth = 0.5 + R(2); g.beginPath(); g.moveTo(R(128), 0); g.bezierCurveTo(R(128), 40, R(128), 90, R(128), 128); g.stroke(); }
    } else if (kind === "lava") {
      g.fillStyle = "#1a0a06"; g.fillRect(0, 0, 128, 128); g.strokeStyle = "#ff6a1a"; g.lineCap = "round";
      for (i = 0; i < 16; i++) { g.lineWidth = 1.5 + R(4); g.beginPath(); var x = R(128), y = R(128); g.moveTo(x, y); for (var k = 0; k < 4; k++) { x += R(40) - 20; y += R(40) - 20; g.lineTo(x, y); } g.stroke(); }
    } else if (kind === "galaxy") {
      var gr = g.createLinearGradient(0, 0, 128, 128); gr.addColorStop(0, "#1a0a4a"); gr.addColorStop(0.5, "#5a1a8a"); gr.addColorStop(1, "#0a2a6a"); g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
      for (i = 0; i < 70; i++) { g.fillStyle = "rgba(255,255,255," + (0.4 + R(0.6)) + ")"; g.fillRect(R(128), R(128), R(2) + 0.6, R(2) + 0.6); }
      g.fillStyle = "rgba(255,120,220,.25)"; g.beginPath(); g.ellipse(64, 64, 50, 16, 0.7, 0, 7); g.fill();
    }
    var t = new (T().CanvasTexture)(c); t.wrapS = t.wrapT = T().RepeatWrapping; if (T().sRGBEncoding) t.encoding = T().sRGBEncoding;
    return (texCache[kind] = t);
  }

  /* ================= 3D: every item =================
     Head frame: origin at the TOP of a 0.8 cube head, head spans y -0.8..0, x/z -0.4..0.4, face at +z.
     Body frame: origin at the feet, 3 units tall, torso y 1.2..2.2, back of torso at z -0.3.
     Each builder returns { obj, tick(t, dt) } (tick optional). */
  var B = {};
  // ----- hats -----
  B.cap = function (p) {
    var g = grp(), d = ball(0.43, p.c, null, 18, 10); d.scale.y = 0.55; at(d, 0, -0.06, 0);
    var brim = box(0.6, 0.05, 0.42, p.c); at(brim, 0, -0.1, 0.48);
    add(g, d, brim, at(ball(0.06, "#ffffff"), 0, 0.17, 0));
    if (p.star) add(g, at(M(shape2("star"), mat("#ffffff", { glow: 1, gi: 0.6 })), 0, 0.05, 0.38)).children[3].scale.setScalar(0.12);
    return { obj: g };
  };
  B.beanie = function (p) {
    var g = grp(), d = ball(0.44, p.c, { rough: 1 }, 18, 10); d.scale.y = 0.7; at(d, 0, -0.05, 0);
    add(g, d, at(cyl(0.445, 0.445, 0.14, p.p, 20, { rough: 1 }), 0, -0.14, 0), at(ball(0.11, p.p, { rough: 1 }), 0, 0.3, 0));
    return { obj: g };
  };
  B.party = function (p) {
    var g = grp(), c = cone(0.25, 0.7, p.c); at(c, 0, 0.35, 0);
    for (var i = 0; i < 3; i++) add(g, at(cyl(0.22 - i * 0.065, 0.24 - i * 0.065, 0.05, p.s), 0, 0.12 + i * 0.18, 0));
    add(g, c, at(ball(0.07, p.s), 0, 0.72, 0)); g.rotation.z = 0.15;
    return { obj: g };
  };
  B.cone = function () {
    var g = grp(); add(g, at(cone(0.3, 0.8, "#ff7a1a"), 0, 0.42, 0), at(cyl(0.21, 0.25, 0.1, "#ffffff"), 0, 0.3, 0), at(cyl(0.12, 0.15, 0.08, "#ffffff"), 0, 0.58, 0), at(box(0.7, 0.06, 0.7, "#ff7a1a"), 0, 0.03, 0));
    return { obj: g };
  };
  B.chef = function () {
    var g = grp(); add(g, at(cyl(0.38, 0.38, 0.3, "#ffffff"), 0, 0.12, 0));
    [[0, 0.42, 0, 0.32], [0.2, 0.36, 0.12, 0.22], [-0.2, 0.36, 0.12, 0.22], [0, 0.36, -0.2, 0.24]].forEach(function (b) { add(g, at(ball(b[3], "#ffffff", { rough: 1 }), b[0], b[1], b[2])); });
    return { obj: g };
  };
  B.cowboy = function (p) {
    var g = grp(), brim = cyl(0.7, 0.7, 0.05, p.c, 24); brim.scale.z = 0.85;
    add(g, at(brim, 0, 0.02, 0), at(cyl(0.32, 0.38, 0.38, p.c), 0, 0.22, 0), at(cyl(0.385, 0.385, 0.07, "#3a2210"), 0, 0.08, 0));
    g.children[0].rotation.x = 0.08;
    return { obj: g };
  };
  B.ears = function (p) {
    var g = grp();
    [-1, 1].forEach(function (s) {
      var e;
      if (p.kind === "bunny") { e = grp(); add(e, at(box(0.16, 0.6, 0.08, p.c), 0, 0.3, 0), at(box(0.08, 0.45, 0.02, p.i), 0, 0.28, 0.045)); e.rotation.z = -s * 0.15; at(e, s * 0.16, 0, 0); }
      else { e = grp(); var c = cone(0.14, 0.3, p.c, 4); c.rotation.y = Math.PI / 4; add(e, at(c, 0, 0.13, 0), at(cone(0.07, 0.17, p.i, 4), 0, 0.1, 0.06)); at(e, s * 0.25, 0, 0); e.rotation.z = -s * 0.2; }
      add(g, e);
    });
    var hb = torus(0.42, 0.03, p.kind === "bunny" ? "#ff8ab0" : "#222222", null, Math.PI); hb.rotation.y = Math.PI / 2; at(hb, 0, -0.38, 0);
    add(g, hb);
    return { obj: g };
  };
  B.tophat = function (p) {
    var g = grp(); add(g, at(cyl(0.62, 0.62, 0.05, p.c, 24), 0, 0.02, 0), at(cyl(0.34, 0.34, 0.7, p.c), 0, 0.38, 0), at(cyl(0.345, 0.345, 0.1, p.b), 0, 0.1, 0));
    return { obj: g };
  };
  B.viking = function () {
    var g = grp(), d = ball(0.46, "#9aa4b2", { metal: 0.6, rough: 0.35 }, 18, 10); d.scale.y = 0.7;
    add(g, at(d, 0, -0.08, 0), at(cyl(0.465, 0.465, 0.1, "#8a6a2a", 20), 0, -0.14, 0), at(box(0.08, 0.32, 0.06, "#9aa4b2", { metal: 0.6 }), 0, -0.3, 0.44));
    [-1, 1].forEach(function (s) { var h = cone(0.1, 0.5, "#f2ead8", 12); h.rotation.z = -s * 1.0; at(h, s * 0.56, 0.08, 0); add(g, h); });
    return { obj: g };
  };
  B.pirate = function () {
    var g = grp(), b = cyl(0.62, 0.62, 0.08, "#1a1a22", 3); b.rotation.y = Math.PI; at(b, 0, 0.04, -0.05);
    var top = ball(0.4, "#1a1a22", null, 16, 8); top.scale.y = 0.6; at(top, 0, 0.08, 0);
    var sk = box(0.14, 0.14, 0.02, "#ffffff"); at(sk, 0, 0.2, 0.34);
    add(g, b, top, sk, at(box(0.22, 0.03, 0.02, "#ffffff"), 0, 0.12, 0.34));
    return { obj: g };
  };
  B.propeller = function (p) {
    var g = grp(), r = B.cap(p).obj, prop = grp();
    add(prop, at(box(0.9, 0.02, 0.1, "#e8423a"), 0, 0, 0), at(box(0.1, 0.02, 0.9, "#3d8bff"), 0, 0, 0));
    add(g, r, at(cyl(0.02, 0.02, 0.22, "#333"), 0, 0.3, 0), at(prop, 0, 0.42, 0));
    return { obj: g, tick: function (t, dt) { prop.rotation.y += dt * 14; } };
  };
  B.headphones = function (p) {
    var g = grp(), band = torus(0.47, 0.05, p.c, null, Math.PI); band.rotation.y = Math.PI / 2; at(band, 0, -0.4, 0);
    add(g, band);
    var cups = [];
    [-1, 1].forEach(function (s) { var cup = cyl(0.17, 0.17, 0.14, p.c); cup.rotation.z = Math.PI / 2; at(cup, s * 0.47, -0.42, 0); var ring = cyl(0.12, 0.12, 0.15, p.g, 18, { glow: 1, gi: 0.9 }); ring.rotation.z = Math.PI / 2; at(ring, s * 0.48, -0.42, 0); cups.push(own(ring)); add(g, cup, ring); });
    return { obj: g, tick: function (t) { cups.forEach(function (c) { c.material.emissiveIntensity = 0.5 + 0.5 * Math.sin(t * 6); }); } };
  };
  B.wizard = function (p) {
    var g = grp(), brim = cyl(0.62, 0.62, 0.04, p.c, 24); at(brim, 0, 0.02, 0);
    var c1 = cone(0.36, 0.6, p.c, 20); at(c1, 0, 0.32, 0);
    var c2 = cone(0.17, 0.42, p.c, 16); c2.rotation.z = -0.5; at(c2, 0.08, 0.72, 0);
    add(g, brim, c1, c2);
    var stars = [];
    for (var i = 0; i < 4; i++) { var s = M(shape2("star"), own(cone(0.1, 0.1, "#ffe14a", 3, { glow: 1, gi: 0.8 })).material); s.scale.setScalar(0.07); var a = i * 1.6; at(s, Math.sin(a) * 0.28, 0.2 + i * 0.08, Math.cos(a) * 0.28); stars.push(s); add(g, s); }
    return { obj: g, tick: function (t) { stars.forEach(function (s, i) { s.material.emissiveIntensity = 0.4 + 0.6 * Math.abs(Math.sin(t * 2 + i)); s.rotation.z = t; }); } };
  };
  B.knight = function () {
    var g = grp(), st = { metal: 0.65, rough: 0.3 };
    var h = box(0.92, 0.92, 0.92, "#b8c0c8", st); at(h, 0, -0.4, 0);
    var top = ball(0.48, "#b8c0c8", st, 16, 8); top.scale.y = 0.4; at(top, 0, 0.04, 0);
    add(g, h, top, at(box(0.7, 0.07, 0.02, "#111"), 0, -0.36, 0.465), at(box(0.05, 0.5, 0.03, "#8a939c", st), 0, -0.45, 0.47));
    var plume = grp(); for (var i = 0; i < 5; i++) add(plume, at(ball(0.09, "#e8423a", { rough: 1 }), 0, 0.12 + i * 0.03, -0.1 * i));
    add(g, plume);
    return { obj: g };
  };
  B.horns = function (p) {
    var g = grp();
    [-1, 1].forEach(function (s) { var h = cone(0.09, 0.35, p.c, 12, { glow: 1, gi: 0.3 }); h.rotation.z = -s * 0.45; at(h, s * 0.25, 0.12, 0.05); add(g, h); });
    return { obj: g };
  };
  B.antlers = function () {
    var g = grp(), c = "#8a5a2a";
    [-1, 1].forEach(function (s) {
      var a = grp(), m = cyl(0.04, 0.05, 0.55, c, 8); at(m, 0, 0.27, 0);
      var b1 = cyl(0.03, 0.04, 0.25, c, 8); b1.rotation.z = -s * 0.9; at(b1, s * 0.1, 0.3, 0);
      var b2 = cyl(0.03, 0.04, 0.2, c, 8); b2.rotation.z = -s * 0.9; at(b2, s * 0.08, 0.48, 0);
      add(a, m, b1, b2); a.rotation.z = -s * 0.35; at(a, s * 0.22, -0.02, 0); add(g, a);
    });
    add(g, at(ball(0.07, "#e8203a", { glow: 1, gi: 0.6 }), 0, -0.4, 0.43));
    return { obj: g };
  };
  B.poo = function (p) {
    var g = grp(), o = p.metal ? { metal: 0.7, rough: 0.25, glow: 1, glowc: "#5a3a00", gi: 0.4 } : { rough: 0.8 };
    [[0.38, 0.1], [0.29, 0.3], [0.2, 0.47]].forEach(function (r) { var t = torus(r[0], 0.12, p.c, o); t.rotation.x = Math.PI / 2; at(t, 0, r[1], 0); add(g, t); });
    add(g, at(cone(0.14, 0.24, p.c, 12, o), 0, 0.62, 0));
    [-1, 1].forEach(function (s) { add(g, at(ball(0.06, "#ffffff"), s * 0.12, 0.33, 0.27), at(ball(0.03, "#111"), s * 0.12, 0.33, 0.32)); });
    return { obj: g };
  };
  B.crown = function (p) {
    var g = grp(), o = { metal: 0.7, rough: 0.25, glow: p.glow ? 1 : 0, glowc: p.c, gi: 0.25 };
    var band = cyl(0.44, 0.44, 0.18, p.c, 24, o); at(band, 0, 0.06, 0); add(g, band);
    var parts = [band], gems = [];
    for (var i = 0; i < 8; i++) { var a = i / 8 * Math.PI * 2, s = cone(0.08, 0.24, p.c, 4, o); at(s, Math.sin(a) * 0.42, 0.27, Math.cos(a) * 0.42); add(g, s); parts.push(s); var gm = ball(0.05, p.g, { glow: 1, gi: 0.7 }); at(gm, Math.sin(a) * 0.45, 0.06, Math.cos(a) * 0.45); add(g, gm); gems.push(own(gm)); }
    var orb = ball(0.08, p.g, { glow: 1, gi: 0.9 }); at(orb, 0, 0.38, 0.42);
    var spark = [];
    if (p.stars) for (var k = 0; k < 6; k++) { var st = M(shape2("star"), mat("#ffffff", { glow: 1, gi: 1 })); st.scale.setScalar(0.06); spark.push(st); add(g, st); }
    if (p.rainbow) parts.forEach(own);
    return { obj: g, tick: function (t) {
      if (p.rainbow) rainbowTick(parts.concat(gems), 0.6)(t);
      gems.forEach(function (gm, i) { gm.material.emissiveIntensity = 0.5 + 0.5 * Math.sin(t * 3 + i); });
      spark.forEach(function (s, i) { var a = t * 0.8 + i * 1.05; at(s, Math.sin(a) * 0.6, 0.2 + 0.15 * Math.sin(t * 2 + i), Math.cos(a) * 0.6); s.rotation.z = t * 2; });
    } };
  };
  B.astro = function () {
    var g = grp(), glass = ball(0.62, "#9ee8ff", { op: 0.3, rough: 0.05, metal: 0.2 }, 24, 16); at(glass, 0, -0.4, 0);
    var ring = torus(0.56, 0.07, "#ffffff"); ring.rotation.x = Math.PI / 2; at(ring, 0, -0.92, 0);
    add(g, glass, ring, at(cyl(0.02, 0.02, 0.3, "#9aa4b2"), 0.35, 0.25, -0.1), at(ball(0.05, "#e8423a", { glow: 1 }), 0.35, 0.42, -0.1));
    return { obj: g };
  };
  B.pumpkin = function () {
    var g = grp();
    for (var i = 0; i < 6; i++) { var s = ball(0.5, "#ff7a1a", { rough: 0.8 }, 16, 12); s.scale.set(0.55, 1, 1); s.rotation.y = i / 6 * Math.PI; at(s, 0, -0.42, 0); add(g, s); }
    add(g, at(cyl(0.05, 0.07, 0.2, "#3a6a1a"), 0, 0.12, 0));
    var glow = mat("#ffe14a", { glow: 1, gi: 1 });
    [-1, 1].forEach(function (s) { var e = M(new (T().ConeGeometry)(0.08, 0.12, 3), glow); e.rotation.x = Math.PI / 2; at(e, s * 0.15, -0.32, 0.5); add(g, e); });
    add(g, at(M(new (T().BoxGeometry)(0.36, 0.08, 0.02), glow), 0, -0.56, 0.5));
    return { obj: g };
  };
  B.halo = function (p) {
    var g = grp(), rings = [];
    var r = torus(0.34, 0.05, p.c, { glow: 1, gi: 1 }); r.rotation.x = Math.PI / 2; at(r, 0, 0.3, 0); add(g, r); rings.push(r);
    if (p.double) { var r2 = torus(0.45, 0.035, "#ffe14a", { glow: 1, gi: 1 }); r2.rotation.x = Math.PI / 2; at(r2, 0, 0.42, 0); add(g, r2); rings.push(r2); }
    return { obj: g, tick: function (t) { rings.forEach(function (x, i) { x.position.y = 0.3 + i * 0.12 + Math.sin(t * 2 + i) * 0.04; x.rotation.z = t * (i ? -1 : 1); }); } };
  };
  B.flamecrown = function () {
    var c = B.crown({ c: "#ffcc33", g: "#ff3a1a" }), g = c.obj, flames = [];
    for (var i = 0; i < 8; i++) { var f = M(new (T().OctahedronGeometry)(0.1, 0), new (T().MeshStandardMaterial)(matOpts("#ff8a1a", { glow: 1, gi: 1, op: 0.9 }))); var a = i / 8 * Math.PI * 2; f.userData.a = a; flames.push(f); add(g, f); }
    return { obj: g, tick: function (t, dt) {
      c.tick(t, dt);
      flames.forEach(function (f, i) { var ph = (t * 1.6 + i * 0.37) % 1; at(f, Math.sin(f.userData.a) * 0.42, 0.35 + ph * 0.45, Math.cos(f.userData.a) * 0.42); f.scale.setScalar(1 - ph * 0.8); f.material.color.setHSL(0.08 - ph * 0.06, 1, 0.55); f.material.emissive.copy(f.material.color); });
    } };
  };
  // ----- face (same head frame) -----
  var EYE_Y = -0.34, FZ = 0.42;
  B.shades = function (p) {
    var o = p.metal ? { metal: 0.35, rough: 0.25, glow: 1, gi: 0.3 } : { rough: 0.2 };
    var g = grp(); [-1, 1].forEach(function (s) { add(g, at(box(0.26, 0.15, 0.04, p.c, o), s * 0.17, EYE_Y, FZ)); });
    add(g, at(box(0.82, 0.04, 0.03, p.metal ? p.c : "#111111", o), 0, EYE_Y + 0.07, FZ));
    [-1, 1].forEach(function (s) { add(g, at(box(0.03, 0.03, 0.4, "#111111"), s * 0.41, EYE_Y + 0.07, 0.22)); });
    return { obj: g };
  };
  B.moustache = function (p) {
    var g = grp(); [-1, 1].forEach(function (s) { var m = box(0.22, 0.07, 0.05, p.c, { rough: 1 }); m.rotation.z = s * 0.25; at(m, s * 0.1, -0.56, FZ + 0.01); add(g, m); var tip = ball(0.045, p.c, { rough: 1 }); at(tip, s * 0.22, -0.52, FZ); add(g, tip); });
    return { obj: g };
  };
  B.nose = function () { var g = grp(); add(g, at(ball(0.09, "#ff2a2a", { rough: 0.2, glow: 1, gi: 0.2 }), 0, -0.47, FZ + 0.06)); return { obj: g }; };
  B.nerd = function () {
    var g = grp(), o = { rough: 0.3 };
    [-1, 1].forEach(function (s) { var r = torus(0.1, 0.025, "#1a1a22", o); at(r, s * 0.17, EYE_Y, FZ + 0.02); add(g, r, at(cyl(0.09, 0.09, 0.01, "#bff8ff", 16, { op: 0.35 }), s * 0.17, EYE_Y, FZ + 0.02)); g.children[g.children.length - 1].rotation.x = Math.PI / 2; });
    add(g, at(box(0.12, 0.03, 0.03, "#1a1a22"), 0, EYE_Y, FZ + 0.02), at(box(0.1, 0.03, 0.02, "#ffffff"), 0, EYE_Y - 0.03, FZ + 0.04));
    return { obj: g };
  };
  B.eyepatch = function () {
    var g = grp(), strap = box(0.86, 0.035, 0.86, "#111111"); strap.rotation.z = 0.35; at(strap, 0, -0.3, 0);
    add(g, strap, at(box(0.2, 0.17, 0.04, "#111111"), 0.17, EYE_Y, FZ + 0.01));
    return { obj: g };
  };
  B.mask = function (p) {
    var g = grp(), m = box(0.6, 0.3, 0.06, p.c, { rough: 1 }); at(m, 0, -0.58, FZ + 0.01);
    add(g, m, at(box(0.6, 0.02, 0.02, "#ffffff"), 0, -0.48, FZ + 0.05), at(box(0.6, 0.02, 0.02, "#ffffff"), 0, -0.58, FZ + 0.05), at(box(0.6, 0.02, 0.02, "#ffffff"), 0, -0.68, FZ + 0.05));
    [-1, 1].forEach(function (s) { add(g, at(box(0.02, 0.02, 0.35, "#ffffff"), s * 0.41, -0.52, 0.25)); });
    return { obj: g };
  };
  B.glasses3d = function () {
    var g = grp(); add(g, at(box(0.82, 0.2, 0.03, "#ffffff"), 0, EYE_Y, FZ), at(box(0.24, 0.13, 0.02, "#ff2a3a", { op: 0.75, glow: 1, gi: 0.3 }), -0.17, EYE_Y, FZ + 0.02), at(box(0.24, 0.13, 0.02, "#2ac8ff", { op: 0.75, glow: 1, gi: 0.3 }), 0.17, EYE_Y, FZ + 0.02));
    return { obj: g };
  };
  B.heartglasses = function (p) {
    var g = grp(), hs = [];
    [-1, 1].forEach(function (s) { var h = M(shape2("heart"), own(box(1, 1, 1, p.c, { glow: 1, gi: 0.4 })).material); h.scale.setScalar(0.13); at(h, s * 0.17, EYE_Y, FZ + 0.03); hs.push(h); add(g, h); });
    add(g, at(box(0.1, 0.03, 0.03, p.c), 0, EYE_Y + 0.03, FZ + 0.02));
    return { obj: g, tick: function (t) { var s = 0.13 + 0.015 * Math.sin(t * 7); hs.forEach(function (h) { h.scale.setScalar(s); }); } };
  };
  B.starglasses = function (p) {
    var g = grp(), ss = [];
    [-1, 1].forEach(function (s) { var h = M(shape2("star"), own(box(1, 1, 1, p.c, { glow: 1, gi: p.glow ? 0.9 : 0.35, metal: 0.3 })).material); h.scale.setScalar(0.14); at(h, s * 0.18, EYE_Y, FZ + 0.03); ss.push(h); add(g, h); });
    return { obj: g, tick: p.glow ? function (t) { ss.forEach(function (h, i) { h.material.emissiveIntensity = 0.5 + 0.5 * Math.sin(t * 4 + i * 3); h.rotation.z = Math.sin(t * 2) * 0.2; }); } : null };
  };
  B.monocle = function () {
    var g = grp(), r = torus(0.11, 0.022, "#ffcc33", { metal: 0.8, rough: 0.2 }); at(r, 0.17, EYE_Y, FZ + 0.03);
    var chain = box(0.015, 0.3, 0.015, "#ffcc33", { metal: 0.8 }); at(chain, 0.26, EYE_Y - 0.24, FZ + 0.02);
    add(g, r, chain, at(box(0.18, 0.02, 0.02, "#2a1a10"), -0.17, EYE_Y + 0.12, FZ + 0.02));
    return { obj: g };
  };
  B.beard = function (p) {
    var g = grp(), o = { rough: 1 };
    add(g, at(box(0.82, 0.28, 0.12, p.c, o), 0, -0.66, FZ), at(box(0.6, 0.22, 0.12, p.c, o), 0, -0.85, FZ - 0.02), at(box(0.3, 0.16, 0.1, p.c, o), 0, -1.0, FZ - 0.04));
    [-1, 1].forEach(function (s) { add(g, at(box(0.1, 0.4, 0.3, p.c, o), s * 0.41, -0.55, 0.28)); });
    return { obj: g };
  };
  B.ninja = function (p) {
    var g = grp(), m = box(0.86, 0.36, 0.86, p.c, { rough: 0.9 }); at(m, 0, -0.62, 0);
    var band = box(0.87, 0.1, 0.87, p.b); at(band, 0, -0.14, 0);
    var tails = grp(); [0.08, -0.08].forEach(function (y, i) { var t = box(0.08, 0.04, 0.4, p.b); at(t, 0.05 * (i ? -1 : 1), y, -0.2); t.rotation.x = 0.3; add(tails, t); }); at(tails, 0, -0.14, -0.43);
    add(g, m, band, tails);
    return { obj: g, tick: function (t) { tails.rotation.y = Math.sin(t * 5) * 0.3; } };
  };
  B.goggles = function (p) {
    var g = grp(), lens = box(0.7, 0.2, 0.08, p.c, { op: 0.8, rough: 0.05, glow: 1, gi: 0.35, metal: 0.3 }); at(lens, 0, EYE_Y, FZ + 0.03);
    var frame = box(0.76, 0.26, 0.06, "#1a1a22"); at(frame, 0, EYE_Y, FZ);
    var strap = box(0.86, 0.1, 0.86, "#1a1a22"); at(strap, 0, EYE_Y, 0);
    add(g, strap, frame, lens);
    return { obj: g };
  };
  B.vr = function () {
    var g = grp(), b = box(0.72, 0.3, 0.24, "#1a1a22", { rough: 0.3 }); at(b, 0, EYE_Y, FZ + 0.1);
    var front = box(0.6, 0.18, 0.02, "#3d8bff", { glow: 1, gi: 0.6 }); own(front); at(front, 0, EYE_Y, FZ + 0.225);
    add(g, at(box(0.86, 0.08, 0.86, "#333333"), 0, EYE_Y, 0), b, front);
    return { obj: g, tick: function (t) { front.material.color.setHSL((t * 0.1) % 1, 0.8, 0.55); front.material.emissive.copy(front.material.color); } };
  };
  B.visor = function (p) {
    var g = grp(), v = box(0.9, 0.16, 0.1, p.c, { glow: 1, gi: 0.9, op: 0.9 }); own(v); at(v, 0, EYE_Y, FZ + 0.04);
    var scan = box(0.12, 0.17, 0.11, "#ffffff", { glow: 1, gi: 1 }); at(scan, 0, EYE_Y, FZ + 0.05);
    add(g, at(box(0.84, 0.06, 0.84, "#2a2a3a", { metal: 0.5 }), 0, EYE_Y + 0.1, 0), v, scan);
    return { obj: g, tick: function (t) { scan.position.x = Math.sin(t * 2.5) * 0.36; v.material.emissiveIntensity = 0.6 + 0.3 * Math.sin(t * 8); } };
  };
  B.laser = function (p) {
    var g = grp(), beams = [], m = new (T().MeshStandardMaterial)(matOpts(p.c, { glow: 1, gi: 1, op: 0.85 }));
    [-1, 1].forEach(function (s) {
      add(g, at(M(new (T().SphereGeometry)(0.07, 12, 8), m), s * 0.17, EYE_Y, FZ + 0.01));
      var b = M(new (T().CylinderGeometry)(0.025, 0.025, 1, 8), m); b.rotation.x = Math.PI / 2; at(b, s * 0.17, EYE_Y, FZ + 0.5); beams.push(b); add(g, b);
    });
    return { obj: g, tick: function (t) { var on = Math.sin(t * 2.2) > 0.2; beams.forEach(function (b) { b.visible = on; b.scale.y = 1 + 0.4 * Math.sin(t * 20); }); } };
  };
  // ----- backs (body frame) -----
  var BZ = -0.3, SH = 2.15;
  B.cape = function (p) {
    var g = grp(), segs = [], N = 6, H = 1.7 / N;
    var piv = grp(); at(piv, 0, SH, BZ - 0.03); add(g, piv);
    var parent = piv;
    for (var i = 0; i < N; i++) {
      var s = grp(), panel = box(1.0 + i * 0.06, H, 0.04, p.c, { rough: 0.8, double: true });
      at(panel, 0, -H / 2, 0); add(s, panel);
      if (p.t && i === N - 1) add(s, at(box(1.0 + i * 0.06, 0.08, 0.05, p.t, { metal: 0.6 }), 0, -H, 0));
      if (i) at(s, 0, -H, 0); add(parent, s); segs.push(s); parent = s;
    }
    if (p.t) add(piv, at(box(1.05, 0.08, 0.06, p.t, { metal: 0.6 }), 0, 0, 0));
    var speed = 0;
    return { obj: g, tick: function (t, dt, motion) {
      speed += ((motion || 0) - speed) * Math.min(1, dt * 4);
      var lift = Math.min(1, speed * 0.25);
      segs.forEach(function (s, i) { s.rotation.x = -(0.06 + lift * 0.22) - Math.sin(t * 3 + i * 0.8) * (0.03 + lift * 0.05) * (i + 1) * 0.5; });
    } };
  };
  B.backpack = function (p) {
    var g = grp(); add(g, at(box(0.75, 0.85, 0.32, p.c), 0, 1.7, BZ - 0.16), at(box(0.55, 0.35, 0.12, "#ffd23f"), 0, 1.45, BZ - 0.36), at(box(0.1, 0.9, 0.04, "#1a1a22"), -0.25, 1.75, BZ + 0.01), at(box(0.1, 0.9, 0.04, "#1a1a22"), 0.25, 1.75, BZ + 0.01));
    return { obj: g };
  };
  B.bat = function () {
    var g = grp(), b = grp();
    add(b, at(box(0.32, 1.1, 0.12, "#e8c88a"), 0, 0, 0), at(cyl(0.05, 0.05, 0.5, "#2a1a10"), 0, 0.8, 0), at(ball(0.07, "#2a1a10"), 0, 1.06, 0));
    b.rotation.z = 0.6; at(b, 0, 1.6, BZ - 0.1); add(g, b);
    return { obj: g };
  };
  B.sword = function () {
    var g = grp(), s = grp(), o = { metal: 0.8, rough: 0.2 };
    add(s, at(box(0.14, 1.4, 0.04, "#d8e0e8", o), 0, 0.2, 0), at(box(0.5, 0.08, 0.1, "#ffcc33", o), 0, -0.52, 0), at(cyl(0.05, 0.05, 0.3, "#5a2a10"), 0, -0.7, 0), at(ball(0.07, "#e8423a", { glow: 1, gi: 0.4 }), 0, -0.88, 0));
    s.rotation.z = Math.PI + 0.5; at(s, 0.05, 1.65, BZ - 0.08); add(g, s);
    return { obj: g };
  };
  B.shell = function () {
    var g = grp(), s = ball(0.62, "#3a8a3a", { rough: 0.7, flat: true }, 8, 6); s.scale.set(1, 1.1, 0.5); at(s, 0, 1.6, BZ - 0.05);
    add(g, s, at(cyl(0.64, 0.64, 0.1, "#e8d88a", 20), 0, 1.6, BZ + 0.02)); g.children[1].rotation.x = Math.PI / 2; g.children[1].scale.y = 1;
    return { obj: g };
  };
  B.guitar = function (p) {
    var g = grp(), gt = grp();
    var body = cyl(0.36, 0.36, 0.12, p.c, 20); body.rotation.x = Math.PI / 2; var body2 = cyl(0.27, 0.27, 0.12, p.c, 20); body2.rotation.x = Math.PI / 2;
    add(gt, at(body, 0, -0.35, 0), at(body2, 0, 0.05, 0), at(box(0.08, 0.9, 0.05, "#3a2210"), 0, 0.6, 0.03), at(box(0.16, 0.2, 0.05, "#1a1a22"), 0, 1.1, 0.03), at(cyl(0.09, 0.09, 0.13, "#111", 16), 0, -0.25, 0.01));
    gt.children[4].rotation.x = Math.PI / 2;
    gt.rotation.z = -0.7; at(gt, 0, 1.55, BZ - 0.1); add(g, gt);
    return { obj: g };
  };
  B.shield = function () {
    var g = grp(), s = cyl(0.55, 0.55, 0.08, "#2a5ad8", 6, { metal: 0.3 }); s.rotation.x = Math.PI / 2; s.scale.set(1, 1, 1.2);
    add(g, at(s, 0, 1.65, BZ - 0.08), at(box(0.12, 0.9, 0.03, "#ffcc33", { metal: 0.7 }), 0, 1.65, BZ - 0.13), at(box(0.7, 0.12, 0.03, "#ffcc33", { metal: 0.7 }), 0, 1.75, BZ - 0.13));
    return { obj: g };
  };
  B.jetpack = function () {
    var g = grp(), o = { metal: 0.6, rough: 0.3 }, flames = [];
    [-1, 1].forEach(function (s) {
      add(g, at(cyl(0.17, 0.17, 0.8, "#9aa4b2", 16, o), s * 0.2, 1.7, BZ - 0.2), at(cone(0.17, 0.2, "#e8423a", 16), s * 0.2, 2.2, BZ - 0.2), at(cyl(0.12, 0.08, 0.12, "#333", 12), s * 0.2, 1.25, BZ - 0.2));
      var f = M(new (T().ConeGeometry)(0.11, 0.5, 10), new (T().MeshStandardMaterial)(matOpts("#ff8a1a", { glow: 1, gi: 1, op: 0.85 }))); f.rotation.x = Math.PI; at(f, s * 0.2, 0.95, BZ - 0.2); flames.push(f); add(g, f);
    });
    add(g, at(box(0.3, 0.6, 0.1, "#5a6470", o), 0, 1.7, BZ - 0.08));
    return { obj: g, tick: function (t) { flames.forEach(function (f, i) { f.scale.y = 0.7 + 0.5 * Math.abs(Math.sin(t * 25 + i)); f.position.y = 1.2 - f.scale.y * 0.25; }); } };
  };
  B.wings = function (p) {
    var g = grp(), L = [], R = [], all = [];
    var o = { glow: p.glow ? 1 : 0, gi: 0.5, metal: p.metal ? 0.7 : 0, rough: p.metal ? 0.25 : 0.6, op: p.op || (p.kind === "fairy" ? 0.55 : undefined), double: true };
    function feather(len, col) { var m = box(len, 0.16, 0.04, col, o); own(m); all.push(m); return m; }
    [-1, 1].forEach(function (s) {
      var w = grp(); at(w, s * 0.12, SH - 0.15, BZ - 0.08);
      if (p.kind === "feather" || p.kind === "robot") {
        for (var i = 0; i < 6; i++) {
          var col = p.rainbow ? "#ffffff" : p.kind === "robot" ? (i % 2 ? p.c : "#6a7480") : p.c;
          var f = feather(0.7 + i * 0.12 + (i < 3 ? 0.15 : 0), col);
          f.position.set(s * (0.35 + i * 0.06), 0.25 - i * 0.16, 0); f.rotation.z = s * (0.5 - i * 0.18);
          add(w, f);
          if (p.kind === "robot") { var gl = box(0.6, 0.03, 0.05, p.g, { glow: 1, gi: 1 }); own(gl); gl.position.set(s * (0.35 + i * 0.06), 0.25 - i * 0.16 - 0.07, 0.01); gl.rotation.z = f.rotation.z; add(w, gl); }
        }
      } else if (p.kind === "bat") {
        var arm = box(1.1, 0.06, 0.06, p.g || "#111111", { glow: p.g ? 1 : 0, gi: 0.6 }); arm.position.set(s * 0.55, 0.3, 0); arm.rotation.z = s * 0.35; add(w, arm);
        for (var k = 0; k < 4; k++) { var mem = box(0.36, 0.7 - k * 0.08, 0.02, p.c, o); own(mem); all.push(mem); mem.position.set(s * (0.25 + k * 0.28), 0.05 - k * 0.04, 0); mem.rotation.z = s * (0.15 + k * 0.08); add(w, mem); }
      } else { // butterfly / fairy
        var up = ball(0.5, p.c, o, 14, 10); own(up); all.push(up); up.scale.set(1, 0.85, 0.06); up.position.set(s * 0.5, 0.3, 0);
        var dn = ball(0.35, p.c2 || p.c, o, 14, 10); own(dn); all.push(dn); dn.scale.set(1, 1, 0.06); dn.position.set(s * 0.38, -0.32, 0);
        add(w, up, dn);
        if (p.kind === "butterfly") { var spot = ball(0.12, "#ffffff", {}, 10, 8); spot.scale.z = 0.08; spot.position.set(s * 0.6, 0.35, -0.03); add(w, spot); }
      }
      (s < 0 ? L : R).push(w); add(g, w);
    });
    var fire = [];
    if (p.fire) for (var j = 0; j < 10; j++) { var fp = particle("fire", "#ff8a1a"); fp.scale.setScalar(0.08); fire.push(fp); add(g, fp); }
    var flap = p.kind === "butterfly" || p.kind === "fairy" ? 6 : 2.4;
    return { obj: g, tick: function (t, dt, motion) {
      var a = Math.sin(t * flap) * (0.18 + Math.min(0.25, (motion || 0) * 0.05));
      L.forEach(function (w) { w.rotation.y = 0.35 + a; }); R.forEach(function (w) { w.rotation.y = -0.35 - a; });
      if (p.rainbow) all.forEach(function (m, i) { m.material.color.setHSL(((t * 0.2 + (i % 6) / 6) % 1), 0.9, 0.6); m.material.emissive.copy(m.material.color).multiplyScalar(0.4); });
      if (p.glow && !p.rainbow) all.forEach(function (m, i) { m.material.emissiveIntensity = 0.35 + 0.25 * Math.sin(t * 3 + i * 0.4); });
      fire.forEach(function (f, i) { var ph = (t * 0.8 + i / fire.length) % 1, s = i % 2 ? 1 : -1; at(f, s * (0.3 + ph * 1.1), SH + 0.1 - ph * 0.9, BZ - 0.15); f.scale.setScalar(0.1 * (1 - ph)); f.material.color.setHSL(0.1 - ph * 0.08, 1, 0.55); f.material.emissive.copy(f.material.color); });
    } };
  };
  // ----- auras (body frame) -----
  B.ring = function (p) {
    var g = grp(), rings = [], n = p.n || 1;
    for (var i = 0; i < n; i++) { var r = torus(0.95 + i * 0.12, 0.04, p.c || "#ffffff", { glow: 1, gi: 1, op: 0.85 }); own(r); r.rotation.x = Math.PI / 2; rings.push(r); add(g, r); }
    var hole = null;
    if (p.hole) { hole = ball(0.25, "#000000", { rough: 1 }, 16, 12); at(hole, 0, 3.6, 0); add(g, hole); }
    return { obj: g, tick: function (t) {
      rings.forEach(function (r, i) {
        var ph = (t * 0.35 + i / n) % 1;
        r.position.y = p.hole ? 3.6 : 0.1 + ph * 2.8; r.rotation.x = Math.PI / 2 + (p.hole ? 0.6 + i * 0.3 : Math.sin(t + i) * 0.15); r.rotation.y = p.hole ? t * (1 + i * 0.4) : 0;
        if (p.hole) r.scale.setScalar(0.4 + 0.12 * i); else r.scale.setScalar(1 - Math.abs(ph - 0.5) * 0.4);
        r.material.opacity = p.hole ? 0.9 : 0.9 - Math.abs(ph - 0.5);
        if (p.rainbow) { r.material.color.setHSL((t * 0.3 + i / n) % 1, 1, 0.6); r.material.emissive.copy(r.material.color); }
      });
    } };
  };
  B.orbit = function (p) {
    var g = grp(), bits = [], n = p.n || 6;
    for (var i = 0; i < n; i++) { var b = particle(p.shape, p.c); b.scale.setScalar(p.shape === "coin" ? 0.13 : 0.16); bits.push(b); add(g, b); }
    var shell = null;
    if (p.shellc) { shell = ball(1.25, p.shellc, { op: 0.16, glow: 1, gi: 0.8 }, 20, 14); shell.scale.y = 1.4; at(shell, 0, 1.5, 0); add(g, shell); }
    return { obj: g, tick: function (t) {
      bits.forEach(function (b, i) { var a = t * 1.2 + i / n * Math.PI * 2, r = 0.95 + 0.1 * Math.sin(t * 2 + i); at(b, Math.cos(a) * r, 1.3 + Math.sin(t * 1.5 + i * 1.7) * 0.9, Math.sin(a) * r); b.rotation.y = -a; b.rotation.z = Math.sin(t * 3 + i) * 0.4; });
      if (shell) shell.material.opacity = 0.12 + 0.06 * Math.sin(t * 2);
    } };
  };
  B.rise = function (p) {
    var g = grp(), bits = [], n = 16;
    for (var i = 0; i < n; i++) { var b = particle(p.shape, p.c); bits.push(b); b.userData.a = Math.random() * 7; b.userData.r = 0.55 + Math.random() * 0.45; add(g, b); }
    return { obj: g, tick: function (t) {
      bits.forEach(function (b, i) {
        var ph = (t * 0.45 + i / n) % 1, a = b.userData.a + t * 0.4;
        at(b, Math.cos(a) * b.userData.r, ph * 3.2, Math.sin(a) * b.userData.r);
        var s = (p.shape === "fire" ? 0.2 : 0.11) * (1 - ph * 0.7); b.scale.setScalar(s); b.rotation.y = t * 2 + i;
        if (p.shape === "fire") { b.material.color.setHSL(0.11 - ph * 0.1, 1, 0.55); b.material.emissive.copy(b.material.color); }
      });
    } };
  };
  B.glowshell = function (p) {
    var g = grp(), sh = ball(1.1, p.c, { op: p.dark ? 0.35 : 0.22, glow: 1, gi: 0.9 }, 22, 16); own(sh); sh.scale.y = 1.55; at(sh, 0, 1.55, 0);
    var bub = [];
    for (var i = 0; i < 10; i++) { var b = ball(0.12, p.dark ? "#1a0040" : p.c, { op: 0.7, glow: 1, gi: 0.7 }, 10, 8); own(b); b.userData.a = i * 0.63; bub.push(b); add(g, b); }
    add(g, sh);
    return { obj: g, tick: function (t) {
      sh.scale.set(1 + 0.05 * Math.sin(t * 3), 1.55 + 0.07 * Math.sin(t * 2.3), 1 + 0.05 * Math.cos(t * 3));
      bub.forEach(function (b, i) { var ph = (t * 0.3 + i / 10) % 1, a = b.userData.a + t; at(b, Math.cos(a) * 1.05, 0.2 + ph * 2.8, Math.sin(a) * 1.05); b.scale.setScalar(1 - ph * 0.6); b.material.opacity = 0.75 * (1 - ph); });
    } };
  };
  B.bolt = function (p) {
    var g = grp(), bolts = [];
    for (var i = 0; i < 6; i++) { var b = M(shape2("bolt"), new (T().MeshStandardMaterial)(matOpts(p.c, { glow: 1, gi: 1 }))); b.scale.setScalar(0.32); bolts.push(b); add(g, b); }
    var sh = ball(1.1, p.c, { op: 0.1, glow: 1, gi: 1 }, 18, 12); own(sh); sh.scale.y = 1.5; at(sh, 0, 1.5, 0); add(g, sh);
    var next = 0;
    return { obj: g, tick: function (t) {
      if (t > next) { next = t + 0.08 + Math.random() * 0.15; bolts.forEach(function (b) { b.visible = Math.random() < 0.45; var a = Math.random() * 7; at(b, Math.cos(a) * 0.95, 0.4 + Math.random() * 2.4, Math.sin(a) * 0.95); b.rotation.set(0, -a + Math.PI / 2, (Math.random() - 0.5) * 0.8); }); sh.material.opacity = 0.05 + Math.random() * 0.12; }
    } };
  };
  // ----- trails: a spawner the dress loop calls; obj is empty -----
  B.trail = function (p) { return { obj: grp(), trail: p }; };
  // ----- bodies: material changers -----
  function bodyMat(it, t) {
    var p = it.p, THREE = T();
    if (it.t === "mat") return new THREE.MeshStandardMaterial({ color: p.c, metalness: p.metal || 0.05, roughness: p.rough != null ? p.rough : 0.5, transparent: p.op != null, opacity: p.op != null ? p.op : 1, emissive: p.glow || "#000000", emissiveIntensity: 1, flatShading: !!p.flat, depthWrite: !(p.op != null && p.op < 0.6) });
    if (it.t === "tex") {
      var tx = tex(p.tex);
      var m = new THREE.MeshStandardMaterial({ map: tx, roughness: p.tex === "marble" ? 0.25 : 0.6, metalness: 0.05 });
      if (p.tex === "lava") { m.emissiveMap = tx; m.emissive = new THREE.Color("#ff8a3a"); m.emissiveIntensity = 1.1; }
      if (p.tex === "galaxy") { m.emissiveMap = tx; m.emissive = new THREE.Color("#ffffff"); m.emissiveIntensity = 0.45; }
      return m;
    }
    return new THREE.MeshStandardMaterial({ color: "#ffffff", roughness: 0.35, metalness: 0.2, emissive: "#000000" });
  }
  function buildItem(it) {
    var fn = it.slot === "aura" && it.t === "shell" ? B.glowshell : B[it.t];
    if (!fn) return null;
    try { return fn(it.p); } catch (e) { return null; }
  }

  /* ================= dressing a character ================= */
  var dressed = [];
  var V = null;
  function measure(obj, inRoot) {
    var THREE = T();
    obj.updateMatrixWorld(true);
    var inv = new THREE.Matrix4().copy((inRoot || obj).matrixWorld).invert();
    var box3 = new THREE.Box3(), tmp = new THREE.Box3();
    obj.traverse(function (o) {
      if (o.userData && o.userData.gear) return;
      if (o.isMesh && o.geometry && o.visible !== false) {
        if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
        tmp.copy(o.geometry.boundingBox).applyMatrix4(o.matrixWorld).applyMatrix4(inv);
        box3.union(tmp);
      }
    });
    return box3.isEmpty() ? null : box3;
  }
  var ROT = { z: 0, "-z": Math.PI, x: Math.PI / 2, "-x": -Math.PI / 2 };
  function undress(root) {
    for (var i = dressed.length - 1; i >= 0; i--) if (dressed[i].root === root) { strip(dressed[i]); dressed.splice(i, 1); }
  }
  function strip(d) {
    (d.frames || []).forEach(function (f) { if (f.parent) f.parent.remove(f); });
    d.frames = []; d.ticks = []; d.trail = null;
    (d.repainted || []).forEach(function (r) { r.mesh.material = r.orig; });
    d.repainted = [];
    (d.puffs || []).forEach(function (p) { if (p.parent) p.parent.remove(p); });
    d.puffs = [];
  }
  function build(d) {
    strip(d);
    if (!T()) return;
    var root = d.root, o = d.opts, on = o.look || wearing(), slots = o.slots || {};
    var box3 = (o.height && o.feet != null) ? null : measure(root);
    var height = o.height || (box3 ? box3.max.y - box3.min.y : 3);
    var feet = o.feet != null ? o.feet : (box3 ? box3.min.y : 0);
    var cx = o.cx != null ? o.cx : (box3 ? (box3.min.x + box3.max.x) / 2 : 0), cz = o.cz != null ? o.cz : (box3 ? (box3.min.z + box3.max.z) / 2 : 0);
    var ry = ROT[o.forward || "z"] || 0;
    d.scale = height / 3;
    // body frame
    var bodyF = grp(); bodyF.position.set(cx, feet, cz); bodyF.rotation.y = ry; bodyF.scale.setScalar(height / 3);
    if (o.torso) {
      var tb = measure(o.torso), tsc = tb ? Math.max(0.01, (tb.max.y - tb.min.y) / 1.0) : 1;
      // torso is 1 unit tall in the mannequin; feet sit 1.2 below the torso bottom
      bodyF = grp(); bodyF.scale.setScalar(tsc); bodyF.rotation.y = ry;
      if (tb) bodyF.position.set((tb.min.x + tb.max.x) / 2, tb.min.y - 1.2 * tsc, (tb.min.z + tb.max.z) / 2);
      o.torso.add(bodyF);
    } else root.add(bodyF);
    // head frame
    var headF = grp(); headF.rotation.y = ry;
    if (o.head) {
      var hb = measure(o.head), hs = hb ? Math.max(hb.max.x - hb.min.x, hb.max.z - hb.min.z, (hb.max.y - hb.min.y) * 0.8) : 0.8;
      if (o.headSize) hs = o.headSize;
      headF.scale.setScalar(hs / 0.8);
      if (hb) headF.position.set((hb.min.x + hb.max.x) / 2, hb.max.y, (hb.min.z + hb.max.z) / 2);
      o.head.add(headF);
    } else {
      var hsz = o.headSize || height * 0.8 / 3;
      headF.scale.setScalar(hsz / 0.8);
      headF.position.set(cx, o.headTop != null ? o.headTop : feet + height, cz);
      if (o.headZ) headF.position.add(new (T().Vector3)(Math.sin(ry) * o.headZ, 0, Math.cos(ry) * o.headZ));
      root.add(headF);
    }
    d.frames = [bodyF, headF];
    d.ticks = [];
    SLOTS.forEach(function (s) {
      if (slots[s.id] === false) return;
      var it = BY[on[s.id]]; if (!it) return;
      if (s.id === "body") {
        var list = o.body === "all" ? allMeshes(root) : (o.body || []);
        var m = bodyMat(it);
        list.forEach(function (mesh) { if (!mesh || !mesh.isMesh || (mesh.userData && mesh.userData.gear)) return; d.repainted.push({ mesh: mesh, orig: mesh.material }); mesh.material = m; });
        if (it.t === "rainbow") d.ticks.push(function (t) { m.color.setHSL((t * 0.15) % 1, 0.85, 0.55); m.emissive.copy(m.color).multiplyScalar(0.25); });
        if (it.t === "glitch") { var nx = 0; d.ticks.push(function (t) { if (t > nx) { nx = t + 0.05 + Math.random() * 0.18; m.color.setHSL(Math.random(), 1, 0.5); m.emissive.copy(m.color).multiplyScalar(Math.random() * 0.8); m.wireframe = Math.random() < 0.2; } }); }
        return;
      }
      var b = buildItem(it); if (!b) return;
      (s.id === "hat" || s.id === "face" ? headF : bodyF).add(b.obj);
      b.obj.traverse(function (x) { x.userData.gear = true; x.castShadow = !!x.isMesh && s.id !== "aura"; });
      if (b.tick) d.ticks.push(b.tick);
      if (b.trail) d.trail = b.trail;
    });
    d.last = null;
  }
  function allMeshes(root) {
    var out = [];
    root.traverse(function (x) { if (x.isMesh && !(x.userData && x.userData.gear) && !(x.userData && x.userData.noGear)) out.push(x); });
    return out;
  }
  function sceneOf(o) { while (o && o.parent) o = o.parent; return o && o.isScene ? o : null; }
  function dress(root, opts) {
    if (!root || !T()) return { refresh: function () {}, remove: function () {} };
    undress(root);
    var d = { root: root, opts: opts || {}, frames: [], ticks: [], repainted: [], puffs: [], t0: now() };
    dressed.push(d);
    build(d);
    startLoop();
    return { refresh: function () { build(d); }, remove: function () { undress(root); } };
  }
  function redressAll() { dressed.forEach(function (d) { if (!d.opts.look) build(d); }); }
  function now() { return (window.performance ? performance.now() : Date.now()) / 1000; }
  var running = false, lastT = 0, tmpV = null;
  function startLoop() {
    if (running) return; running = true; lastT = now();
    tmpV = new (T().Vector3)();
    (function f() {
      var t = now(), dt = Math.min(0.05, t - lastT); lastT = t;
      for (var i = dressed.length - 1; i >= 0; i--) {
        var d = dressed[i];
        if (!d.root.parent && !d.opts.preview) continue; // off the scene for now (dead, respawning): keep it, just skip
        var motion = 0;
        d.root.getWorldPosition(tmpV);
        if (d.last) { var dx = tmpV.x - d.last.x, dy = tmpV.y - d.last.y, dz = tmpV.z - d.last.z; motion = Math.sqrt(dx * dx + dy * dy + dz * dz) / Math.max(dt, 1e-3) / Math.max(0.01, d.scale || 1); }
        for (var k = 0; k < d.ticks.length; k++) { try { d.ticks[k](t, dt, motion); } catch (e) {} }
        if (d.trail) trailStep(d, t, dt, motion);
        d.last = d.last || new (T().Vector3)(); d.last.copy(tmpV);
      }
      requestAnimationFrame(f);
    })();
  }
  function trailStep(d, t, dt, motion) {
    var p = d.trail, sc = sceneOf(d.root) || (d.opts.preview ? d.root : null); if (!sc) return;
    d.acc = (d.acc || 0) + dt;
    var gap = p.big ? 0.04 : 0.06;
    var moving = motion > 0.8 || d.opts.preview;
    if (moving && d.acc > gap && d.puffs.length < 70) {
      d.acc = 0;
      var b = particle(p.shape, p.rainbow ? "#ffffff" : p.c, p);
      var s = (d.scale || 1) * (p.big ? 0.22 : 0.16) * (p.shape === "cube" ? 1.2 : 1);
      b.scale.setScalar(s);
      if (d.opts.preview) { at(b, (Math.random() - 0.5) * 0.4, 0.4 + Math.random() * 0.5, -0.4); d.root.add(b); }
      else { var w = new (T().Vector3)(); d.root.getWorldPosition(w); w.y += (d.scale || 1) * (0.5 + Math.random() * 0.6); w.x += (Math.random() - 0.5) * 0.3 * (d.scale || 1); w.z += (Math.random() - 0.5) * 0.3 * (d.scale || 1); b.position.copy(w); sc.add(b); }
      b.userData = { gear: true, born: t, s: s, spin: Math.random() * 4 - 2, hue: Math.random() };
      if (b.material && p.rainbow) { b.material.color.setHSL((t * 0.5) % 1, 1, 0.6); b.material.emissive.copy(b.material.color).multiplyScalar(0.6); }
      d.puffs.push(b);
    } else if (!moving) d.acc = 0;
    for (var i = d.puffs.length - 1; i >= 0; i--) {
      var q = d.puffs[i], age = t - q.userData.born, life = 0.9;
      if (age > life) { if (q.parent) q.parent.remove(q); d.puffs.splice(i, 1); continue; }
      var k = 1 - age / life;
      q.scale.setScalar(q.userData.s * k);
      q.rotation.y += q.userData.spin * dt; q.rotation.z += q.userData.spin * dt * 0.5;
      if (d.opts.preview) q.position.z -= dt * 1.4;
      q.position.y += dt * (p.shape === "bubble" || p.shape === "fire" ? 0.6 : 0.12) * (d.scale || 1);
    }
  }

  /* ================= the mannequin, for the Changing Room ================= */
  function mannequin(skin) {
    var g = grp(), body = [];
    g.userData.gear = false;
    function part(w, h, dd, c, x, y, z) { var m = new (T().Mesh)(new (T().BoxGeometry)(w, h, dd), mat(c)); m.position.set(x, y, z); m.castShadow = true; g.add(m); body.push(m); return m; }
    var legL = part(0.46, 1.2, 0.5, "#2a5ad8", -0.25, 0.6, 0), legR = part(0.46, 1.2, 0.5, "#2a5ad8", 0.25, 0.6, 0);
    var torsoM = part(1.0, 1.0, 0.6, skin || "#e8423a", 0, 1.7, 0);
    var armL = part(0.4, 1.0, 0.5, "#ffcc99", -0.72, 1.7, 0), armR = part(0.4, 1.0, 0.5, "#ffcc99", 0.72, 1.7, 0);
    var head = part(0.8, 0.8, 0.8, "#ffcc99", 0, 2.6, 0);
    var face = grp();
    [-1, 1].forEach(function (s) { var e = new (T().Mesh)(new (T().BoxGeometry)(0.1, 0.13, 0.02), mat("#1a1a22")); e.position.set(s * 0.16, 0.06, 0.41); face.add(e); });
    var smile = new (T().Mesh)(new (T().TorusGeometry)(0.13, 0.025, 6, 16, Math.PI), mat("#1a1a22")); smile.rotation.z = Math.PI; smile.position.set(0, -0.1, 0.41); face.add(smile);
    face.position.copy(head.position); face.userData.noGear = true; face.children.forEach(function (c) { c.userData.noGear = true; }); g.add(face);
    return { group: g, body: body, head: head, torso: torsoM, arms: [armL, armR], legs: [legL, legR] };
  }

  // a live, spinnable 3D preview inside an element
  function preview(el, o) {
    o = o || {};
    if (!T() || !el) return null;
    var THREE = T(), r;
    try { r = new THREE.WebGLRenderer({ antialias: true, alpha: true }); } catch (e) { return null; }
    r.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    if (THREE.sRGBEncoding) r.outputEncoding = THREE.sRGBEncoding;
    r.domElement.style.cssText = "width:100%;height:100%;display:block;touch-action:none;cursor:grab";
    el.appendChild(r.domElement);
    var sc = new THREE.Scene(), cam = new THREE.PerspectiveCamera(32, 1, 0.1, 100);
    sc.add(new THREE.HemisphereLight(0xffffff, 0x445566, 0.95));
    var dl = new THREE.DirectionalLight(0xffffff, 0.9); dl.position.set(3, 6, 5); sc.add(dl);
    var plat = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.6, 0.18, 40), new THREE.MeshStandardMaterial({ color: o.floor || "#2a3a6a", roughness: 0.6 })); plat.position.y = -0.09; sc.add(plat);
    var holder = new THREE.Group(); sc.add(holder);
    var man = mannequin(o.skin); holder.add(man.group);
    var opts = { forward: "z", height: 3, feet: 0, cx: 0, cz: 0, head: man.head, body: man.body, preview: true };
    var h = dress(man.group, opts);
    var spin = o.spin == null ? 0.5 : o.spin, ang = 0.5, dragging = false, lx = 0, vel = 0, focus = o.focus || "body";
    r.domElement.addEventListener("pointerdown", function (e) { dragging = true; lx = e.clientX; vel = 0; r.domElement.setPointerCapture && r.domElement.setPointerCapture(e.pointerId); });
    r.domElement.addEventListener("pointermove", function (e) { if (!dragging) return; var dx = e.clientX - lx; lx = e.clientX; ang += dx * 0.012; vel = dx * 0.012; });
    ["pointerup", "pointercancel", "pointerleave"].forEach(function (ev) { r.domElement.addEventListener(ev, function () { dragging = false; }); });
    function size() { var w = el.clientWidth || 300, hh = el.clientHeight || 300; r.setSize(w, hh, false); cam.aspect = w / hh; cam.updateProjectionMatrix(); }
    size(); window.addEventListener("resize", size);
    var alive = true, lt = now();
    (function loop() {
      if (!alive) return;
      var t = now(), dt = Math.min(0.05, t - lt); lt = t;
      if (!dragging) { vel *= 0.94; ang += vel + spin * dt; }
      holder.rotation.y = ang;
      var tgt = focus === "head" ? [0, 2.75, 3.4, 2.65] : focus === "back" ? [0, 1.9, 6.6, 1.6] : [0, 2.1, 9.4, 1.7];
      cam.position.set(Math.sin(0) * tgt[2], tgt[1], tgt[2]); cam.lookAt(0, tgt[3], 0);
      if (el.isConnected === false) { alive = false; return; }
      r.render(sc, cam);
      requestAnimationFrame(loop);
    })();
    return {
      setLook: function (look) { opts.look = look; h.refresh(); },
      setFocus: function (f) { focus = f; },
      wearMine: function () { delete opts.look; h.refresh(); },
      setSpin: function (s) { spin = s; },
      destroy: function () { alive = false; h.remove(); r.dispose(); if (r.domElement.parentNode) r.domElement.parentNode.removeChild(r.domElement); }
    };
  }

  // a still picture of one item (cached), for shop cards
  var thumbR = null, thumbS = null, thumbC = null, thumbMan = null, thumbCache = {};
  function thumb(id, px) {
    px = px || 160;
    var key = id + "@" + px;
    if (thumbCache[key]) return thumbCache[key];
    var it = BY[id]; if (!it || !T()) return "";
    var THREE = T();
    try {
      if (!thumbR) {
        thumbR = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
        if (THREE.sRGBEncoding) thumbR.outputEncoding = THREE.sRGBEncoding;
        thumbS = new THREE.Scene(); thumbS.add(new THREE.HemisphereLight(0xffffff, 0x556677, 1.0));
        var dl = new THREE.DirectionalLight(0xffffff, 0.8); dl.position.set(3, 5, 6); thumbS.add(dl);
        thumbC = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
        thumbMan = mannequin(); thumbS.add(thumbMan.group);
      }
      thumbR.setSize(px, px, false);
      var look = {}; look[it.slot] = id;
      var d = { root: thumbMan.group, opts: { look: look, height: 3, feet: 0, cx: 0, cz: 0, head: thumbMan.head, body: thumbMan.body, forward: "z" }, frames: [], ticks: [], repainted: [], puffs: [] };
      build(d);
      var tt = 1.3;
      d.ticks.forEach(function (f) { try { f(tt, 0.016, 0); } catch (e) {} });
      if (it.slot === "trail") {
        for (var i = 0; i < 6; i++) { var b = particle(it.p.shape, it.p.rainbow ? "#ffffff" : it.p.c, it.p); b.scale.setScalar(0.28 - i * 0.03); if (it.p.rainbow && b.material) { b.material.color.setHSL(i / 6, 1, 0.6); b.material.emissive.copy(b.material.color).multiplyScalar(0.5); } at(b, 0.9 + i * 0.25, 0.9 + Math.sin(i) * 0.25, -0.8 - i * 0.55); b.rotation.y = i; thumbMan.group.add(b); d.puffs.push(b); }
      }
      var f = it.slot === "hat" ? [1.1, 3.6, 3.7, 3.05] : it.slot === "face" ? [0.5, 2.6, 2.2, 2.55] : it.slot === "back" ? [-2.6, 2.4, -5.0, 1.65] : it.slot === "trail" ? [5.0, 2.6, 4.8, 1.2] : it.slot === "aura" ? [2.2, 2.3, 5.2, 1.55] : [3.2, 2.4, 7.4, 1.5];
      thumbC.position.set(f[0], f[1], f[2]); thumbC.lookAt(0, f[3], 0);
      thumbR.render(thumbS, thumbC);
      var url = thumbR.domElement.toDataURL("image/png");
      strip(d);
      return (thumbCache[key] = url);
    } catch (e) { return ""; }
  }

  /* ================= public ================= */
  window.Gear = {
    RAR: RAR, SLOTS: SLOTS, CRATES: CRATES, items: ITEMS, item: function (id) { return BY[id] || null; },
    state: function () { return S; }, on: wearing, refresh: refresh, onChange: function (f) { listeners.push(f); },
    buy: buy, crate: crate, equip: equip, claimQuest: claimQuest, claimBonus: claimBonus,
    owns: function (id) { var it = BY[id]; return !!it && S.owned.indexOf(id) >= 0; },
    dress: dress, undress: undress, preview: preview, thumb: thumb, mannequin: mannequin,
    toast: toast,
    _dressed: function () { return dressed.filter(function (d) { return !d.opts.preview; }).map(function (d) { return { slots: d.frames.length, ticks: d.ticks.length, trail: !!d.trail, onScene: !!sceneOf(d.root), scale: d.scale }; }); }
  };

  // keep in step with logging in and out, and refresh when the page opens
  var lastTok = token();
  setInterval(function () { var t = token(); if (t !== lastTok) { lastTok = t; refresh(); } }, 1500);
  if (token()) setTimeout(refresh, 600);
})();
