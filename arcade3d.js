/* GH Games: arcade3d.js, the small shared kit for the 3D arcade classics
   ------------------------------------------------------------------
   Load order in <head>/<body> (see cube-merge.html for a full example):
     <script src="account.js" data-game="SLUG"></script>
     <script src="phatcoin.js" data-game="SLUG" data-pill="none"></script>
     ... page markup ...
     <script src="leaderboard.js"></script>
     <script src="vendor/three.min.js"></script>
     <script src="arcade3d.js"></script>
     <script> your game </script>

   What it gives a game (all on window.A3):
     A3.save(key, defaults)        -> object loaded from localStorage, merged over defaults
     A3.store(key, obj)            -> write it back (call after every change that matters)
     A3.view(stageEl, opts)        -> { renderer, scene, camera, resize() }  or null if no WebGL
                                       opts: { fov, near, far, sky:[top,bottom], fog:[color,near,far],
                                               shadows:true, ortho:false, lights:true }
     A3.loop(fn)                   -> calls fn(dt, t) every frame (dt in seconds, capped at 0.05)
     A3.sfx(name)                  -> "click","pop","coin","jump","hit","boom","win","lose","whoosh","tick"
     A3.toast(msg, ms)             -> message at the top of the stage (needs <div class="toast" id="toast">)
     A3.fmt(n)                     -> George's big numbers: 1.2K 3.4M ... Dc, UDc ... Vg
     A3.win(n, why)                -> PhatCoin for a win (server caps at 5, one per 8 s)
     A3.best(value, opts)          -> submits a score to the leaderboard (opts.dir "desc"|"asc")
     A3.mat(color, opts)           -> MeshStandardMaterial, cached per colour
     A3.box(w,h,d,color)           -> Mesh, casts and receives shadows
     A3.ball(r,color)              -> Mesh
     A3.cyl(rt,rb,h,color,seg)     -> Mesh
     A3.label(text, opts)          -> Sprite with crisp canvas text (opts: size, color, bg, font)
     A3.ground(size, color, color2)-> big checker ground plane (studded Roblox feel)
     A3.particles(scene)           -> { burst(pos, color, n, speed), update(dt) }
     A3.keys                       -> live set of pressed keys (lower-case: "arrowleft","a"," ")
     A3.swipe(el, fn)              -> fn("left"|"right"|"up"|"down"|"tap", event)
     A3.ray(event, camera, el)     -> THREE.Raycaster aimed through the pointer
     A3.fullscreen(btn, stageEl)   -> wires a full-screen button
     A3.show(id) / A3.hide(id)     -> overlays (class="ov")
*/
(function () {
  "use strict";
  var A3 = {};
  var lsGet = function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } };
  var lsSet = function (k, v) { try { localStorage.setItem(k, v); } catch (e) {} };

  /* ---------- saves ---------- */
  A3.save = function (key, defaults) {
    var out = JSON.parse(JSON.stringify(defaults || {}));
    try {
      var raw = JSON.parse(lsGet(key) || "null");
      if (raw && typeof raw === "object") for (var k in raw) out[k] = raw[k];
    } catch (e) {}
    return out;
  };
  A3.store = function (key, obj) { lsSet(key, JSON.stringify(obj)); };

  /* ---------- George's number names ---------- */
  var SMALL = ["K","M","B","T","Qa","Qi","Sx","Sp","Oc","No"];
  var NU = ["","U","D","T","Qa","Qi","Sx","Sp","Oc","No"];
  var NT = ["","Dc","Vg","Tg","Qag","Qig","Sxg","Spg","Ocg","Nog"];
  function illion(N) { return N < 10 ? SMALL[N] : NU[N % 10] + NT[Math.floor(N / 10) % 10]; }
  A3.fmt = function (n) {
    if (!isFinite(n)) return "MAX";
    var neg = n < 0; n = Math.abs(n);
    var s;
    if (n < 1000) s = String(Math.floor(n));
    else if (n < 1e6) s = Math.floor(n).toLocaleString();
    else {
      var e = Math.floor(Math.log10(n) / 3 + 1e-9);
      var v = n / Math.pow(10, e * 3);
      s = (v >= 100 ? Math.floor(v) : v.toFixed(1)) + illion(e - 1);
    }
    return (neg ? "-" : "") + s;
  };

  /* ---------- PhatCoin + leaderboard ---------- */
  A3.win = function (n, why) {
    try { if (window.PhatCoin) window.PhatCoin.earn("win", Math.max(1, Math.min(5, n | 0)), why || "a win"); } catch (e) {}
  };
  A3.best = function (value) {
    try {
      if (window.Leaderboard && window.Leaderboard.getName() && value > 0) window.Leaderboard.submit(value);
    } catch (e) {}
  };

  /* ---------- sound (tiny synth, no files) ---------- */
  var actx = null, muted = lsGet("gh3d_mute") === "1";
  function ctx() {
    if (!actx) { try { actx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { actx = null; } }
    if (actx && actx.state === "suspended") actx.resume();
    return actx;
  }
  ["pointerdown", "keydown", "touchstart"].forEach(function (ev) { window.addEventListener(ev, function () { ctx(); }, { once: true, passive: true }); });
  function tone(f0, f1, dur, type, vol, delay) {
    var c = ctx(); if (!c || muted) return;
    var t = c.currentTime + (delay || 0);
    var o = c.createOscillator(), g = c.createGain();
    o.type = type || "sine"; o.frequency.setValueAtTime(f0, t);
    if (f1) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    g.gain.setValueAtTime(vol || 0.15, t); g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
    o.connect(g); g.connect(c.destination); o.start(t); o.stop(t + dur + 0.02);
  }
  function noise(dur, vol, hp) {
    var c = ctx(); if (!c || muted) return;
    var n = Math.floor(c.sampleRate * dur), b = c.createBuffer(1, n, c.sampleRate), d = b.getChannelData(0);
    for (var i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
    var s = c.createBufferSource(), g = c.createGain(), f = c.createBiquadFilter();
    f.type = "lowpass"; f.frequency.value = hp || 1200;
    s.buffer = b; g.gain.value = vol || 0.3; s.connect(f); f.connect(g); g.connect(c.destination); s.start();
  }
  A3.sfx = function (name) {
    switch (name) {
      case "click": tone(700, 500, 0.06, "square", 0.06); break;
      case "pop": tone(420, 880, 0.09, "sine", 0.18); break;
      case "coin": tone(988, 0, 0.07, "square", 0.08); tone(1319, 0, 0.16, "square", 0.08, 0.07); break;
      case "jump": tone(300, 700, 0.14, "triangle", 0.15); break;
      case "hit": tone(200, 60, 0.15, "sawtooth", 0.14); noise(0.08, 0.15, 900); break;
      case "boom": noise(0.5, 0.45, 500); tone(120, 40, 0.4, "sine", 0.3); break;
      case "win": [523, 659, 784, 1047].forEach(function (f, i) { tone(f, 0, 0.18, "triangle", 0.14, i * 0.11); }); break;
      case "lose": [392, 330, 262, 196].forEach(function (f, i) { tone(f, 0, 0.22, "triangle", 0.13, i * 0.14); }); break;
      case "whoosh": noise(0.22, 0.2, 2600); break;
      case "tick": tone(1500, 0, 0.03, "square", 0.04); break;
      default: tone(600, 0, 0.05, "sine", 0.08);
    }
  };
  A3.mute = function (v) { if (v !== undefined) { muted = !!v; lsSet("gh3d_mute", muted ? "1" : "0"); } return muted; };

  /* ---------- overlays + toast ---------- */
  A3.show = function (id) { var e = document.getElementById(id); if (e) e.hidden = false; };
  A3.hide = function (id) { var e = document.getElementById(id); if (e) e.hidden = true; };
  var toastT = 0;
  A3.toast = function (msg, ms) {
    var t = document.getElementById("toast"); if (!t) return;
    t.textContent = msg; t.classList.add("on");
    clearTimeout(toastT); toastT = setTimeout(function () { t.classList.remove("on"); }, ms || 1800);
  };

  /* ---------- three.js view ---------- */
  function hasGL() {
    try { var c = document.createElement("canvas"); return !!(window.WebGLRenderingContext && (c.getContext("webgl") || c.getContext("experimental-webgl"))); }
    catch (e) { return false; }
  }
  A3.view = function (stage, o) {
    o = o || {};
    if (!window.THREE || !hasGL()) {
      var d = document.createElement("div"); d.className = "ov";
      d.innerHTML = "<h2>Oh no!</h2><p>This device can't run 3D games. Try another browser, or turn on hardware acceleration.</p><a class='btn' href='index.html'>Back to GH Games</a>";
      stage.appendChild(d); return null;
    }
    var THREE = window.THREE;
    var renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.outputEncoding = THREE.sRGBEncoding;
    if (o.shadows !== false) { renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap; }
    stage.insertBefore(renderer.domElement, stage.firstChild);
    var scene = new THREE.Scene();
    var camera;
    if (o.ortho) { camera = new THREE.OrthographicCamera(-10, 10, 10, -10, 0.1, o.far || 1000); camera.userData.size = o.ortho; }
    else camera = new THREE.PerspectiveCamera(o.fov || 55, 1, o.near || 0.1, o.far || 1000);
    var sky = o.sky || ["#5eb8ff", "#d8f1ff"];
    if (sky) scene.background = skyTexture(sky[0], sky[1]);
    if (o.fog) scene.fog = new THREE.Fog(o.fog[0], o.fog[1], o.fog[2]);
    var lights = {};
    if (o.lights !== false) {
      lights.hemi = new THREE.HemisphereLight(0xffffff, 0x8a7a66, 0.9); scene.add(lights.hemi);
      lights.sun = new THREE.DirectionalLight(0xffffff, 1.1);
      lights.sun.position.set(12, 24, 10);
      if (o.shadows !== false) {
        lights.sun.castShadow = true;
        var s = o.shadowSize || 30;
        lights.sun.shadow.mapSize.set(2048, 2048);
        lights.sun.shadow.camera.left = -s; lights.sun.shadow.camera.right = s;
        lights.sun.shadow.camera.top = s; lights.sun.shadow.camera.bottom = -s;
        lights.sun.shadow.camera.far = 120; lights.sun.shadow.bias = -0.0006;
      }
      scene.add(lights.sun); scene.add(lights.sun.target);
    }
    function resize() {
      var w = stage.clientWidth || 640, h = stage.clientHeight || 400;
      renderer.setSize(w, h, false);
      if (camera.isPerspectiveCamera) camera.aspect = w / h;
      else { var sz = camera.userData.size || 10, a = w / h; camera.left = -sz * a; camera.right = sz * a; camera.top = sz; camera.bottom = -sz; }
      camera.updateProjectionMatrix();
    }
    resize();
    window.addEventListener("resize", resize);
    if (window.ResizeObserver) new ResizeObserver(resize).observe(stage);
    return { renderer: renderer, scene: scene, camera: camera, lights: lights, resize: resize, render: function () { renderer.render(scene, camera); } };
  };
  function skyTexture(top, bottom) {
    var c = document.createElement("canvas"); c.width = 2; c.height = 256;
    var g = c.getContext("2d"), gr = g.createLinearGradient(0, 0, 0, 256);
    gr.addColorStop(0, top); gr.addColorStop(1, bottom); g.fillStyle = gr; g.fillRect(0, 0, 2, 256);
    var t = new window.THREE.CanvasTexture(c); t.encoding = window.THREE.sRGBEncoding; return t;
  }
  A3.skyTexture = skyTexture;

  /* ---------- frame loop ---------- */
  A3.loop = function (fn) {
    var last = performance.now(), t = 0, stopped = false;
    function f(now) {
      if (stopped) return;
      var dt = Math.min(0.05, Math.max(0, (now - last) / 1000)); last = now; t += dt;
      try { fn(dt, t); } catch (e) { console.error(e); }
      requestAnimationFrame(f);
    }
    requestAnimationFrame(f);
    return { stop: function () { stopped = true; } };
  };

  /* ---------- meshes ---------- */
  var matCache = {};
  A3.mat = function (color, o) {
    o = o || {};
    var key = color + JSON.stringify(o);
    if (matCache[key]) return matCache[key];
    var m = new window.THREE.MeshStandardMaterial({ color: color, roughness: o.rough != null ? o.rough : 0.6, metalness: o.metal || 0, emissive: o.emissive || 0x000000, emissiveIntensity: o.glow || 1, transparent: !!o.opacity, opacity: o.opacity || 1, flatShading: !!o.flat });
    if (o.linear !== true) { m.color.convertSRGBToLinear(); if (o.emissive) m.emissive.convertSRGBToLinear(); }
    if (!o.nocache) matCache[key] = m;
    return m;
  };
  function mesh(geo, color, o) {
    var m = new window.THREE.Mesh(geo, typeof color === "object" && color && color.isMaterial ? color : A3.mat(color, o));
    m.castShadow = true; m.receiveShadow = true; return m;
  }
  A3.box = function (w, h, d, color, o) { return mesh(new window.THREE.BoxGeometry(w, h, d), color, o); };
  A3.ball = function (r, color, o) { return mesh(new window.THREE.SphereGeometry(r, 24, 16), color, o); };
  A3.cyl = function (rt, rb, h, color, seg, o) { return mesh(new window.THREE.CylinderGeometry(rt, rb, h, seg || 20), color, o); };
  A3.rbox = function (w, h, d, r, color, o) {
    // rounded box (extruded rounded rectangle), nice for tiles and cards
    var THREE = window.THREE, s = new THREE.Shape(), x = -w / 2, y = -d / 2;
    r = Math.min(r, w / 2, d / 2);
    s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r);
    s.lineTo(x + w, y + d - r); s.quadraticCurveTo(x + w, y + d, x + w - r, y + d);
    s.lineTo(x + r, y + d); s.quadraticCurveTo(x, y + d, x, y + d - r);
    s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
    var g = new THREE.ExtrudeGeometry(s, { depth: h, bevelEnabled: true, bevelThickness: Math.min(0.08, h / 4), bevelSize: Math.min(0.08, r / 2), bevelSegments: 2, curveSegments: 6 });
    g.rotateX(-Math.PI / 2); g.translate(0, -h / 2, 0);
    return mesh(g, color, o);
  };
  A3.ground = function (size, c1, c2, tiles) {
    var THREE = window.THREE, n = tiles || Math.round(size / 2);
    var cv = document.createElement("canvas"); cv.width = cv.height = 128;
    var g = cv.getContext("2d");
    g.fillStyle = c1 || "#5fbf4a"; g.fillRect(0, 0, 128, 128);
    g.fillStyle = c2 || "#56b042"; g.fillRect(0, 0, 64, 64); g.fillRect(64, 64, 64, 64);
    g.fillStyle = "rgba(255,255,255,.10)";
    [[32, 32], [96, 32], [32, 96], [96, 96]].forEach(function (p) { g.beginPath(); g.arc(p[0], p[1], 12, 0, 7); g.fill(); });
    var tex = new THREE.CanvasTexture(cv); tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(n / 2, n / 2);
    tex.encoding = THREE.sRGBEncoding; tex.anisotropy = 4;
    var m = new THREE.Mesh(new THREE.PlaneGeometry(size, size), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9 }));
    m.rotation.x = -Math.PI / 2; m.receiveShadow = true; return m;
  };
  A3.label = function (text, o) {
    o = o || {};
    var THREE = window.THREE, px = o.px || 96, font = (o.weight || "900") + " " + px + "px " + (o.font || "Nunito, Arial Black, Arial");
    var cv = document.createElement("canvas"), g = cv.getContext("2d");
    g.font = font; var w = Math.ceil(g.measureText(text).width) + px * 0.6, h = Math.ceil(px * 1.35);
    cv.width = w; cv.height = h; g.font = font; g.textAlign = "center"; g.textBaseline = "middle";
    if (o.bg) { g.fillStyle = o.bg; var r = h * 0.3; g.beginPath(); g.moveTo(r, 0); g.arcTo(w, 0, w, h, r); g.arcTo(w, h, 0, h, r); g.arcTo(0, h, 0, 0, r); g.arcTo(0, 0, w, 0, r); g.fill(); }
    if (o.stroke) { g.lineWidth = px * 0.14; g.strokeStyle = o.stroke; g.strokeText(text, w / 2, h / 2); }
    g.fillStyle = o.color || "#fff"; g.fillText(text, w / 2, h / 2);
    var tex = new THREE.CanvasTexture(cv); tex.encoding = THREE.sRGBEncoding; tex.anisotropy = 4;
    var sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: o.depthTest !== false }));
    var size = o.size || 1; sp.scale.set(size * w / h, size, 1); return sp;
  };
  /* a flat canvas texture you draw on yourself: A3.canvasTex(256,256,(g,w,h)=>{...}) */
  A3.canvasTex = function (w, h, draw) {
    var cv = document.createElement("canvas"); cv.width = w; cv.height = h; draw(cv.getContext("2d"), w, h);
    var t = new window.THREE.CanvasTexture(cv); t.encoding = window.THREE.sRGBEncoding; t.anisotropy = 4; return t;
  };

  /* ---------- particles ---------- */
  A3.particles = function (scene) {
    var THREE = window.THREE, list = [], geo = new THREE.BoxGeometry(0.16, 0.16, 0.16);
    return {
      burst: function (pos, color, n, speed, life) {
        for (var i = 0; i < (n || 14); i++) {
          var m = new THREE.Mesh(geo, A3.mat(color || "#ffd23f"));
          m.position.copy(pos);
          var sp = speed || 4;
          m.userData = { v: new THREE.Vector3((Math.random() - 0.5) * sp, Math.random() * sp, (Math.random() - 0.5) * sp), life: (life || 0.8) * (0.6 + Math.random() * 0.6) };
          scene.add(m); list.push(m);
        }
      },
      update: function (dt) {
        for (var i = list.length - 1; i >= 0; i--) {
          var m = list[i], u = m.userData;
          u.life -= dt; u.v.y -= 9 * dt; m.position.addScaledVector(u.v, dt);
          m.rotation.x += dt * 6; m.rotation.y += dt * 5;
          var s = Math.max(0.01, Math.min(1, u.life * 2)); m.scale.setScalar(s);
          if (u.life <= 0) { scene.remove(m); list.splice(i, 1); }
        }
      },
      clear: function () { list.forEach(function (m) { scene.remove(m); }); list.length = 0; }
    };
  };

  /* ---------- input ---------- */
  A3.keys = {};
  window.addEventListener("keydown", function (e) {
    var k = (e.key || "").toLowerCase(); A3.keys[k] = true;
    if ([" ", "arrowup", "arrowdown", "arrowleft", "arrowright"].indexOf(k) >= 0 && e.target === document.body) e.preventDefault();
  });
  window.addEventListener("keyup", function (e) { A3.keys[(e.key || "").toLowerCase()] = false; });
  window.addEventListener("blur", function () { A3.keys = {}; });

  A3.swipe = function (el, fn) {
    var sx = 0, sy = 0, st = 0, on = false;
    el.addEventListener("pointerdown", function (e) { on = true; sx = e.clientX; sy = e.clientY; st = performance.now(); });
    el.addEventListener("pointerup", function (e) {
      if (!on) return; on = false;
      var dx = e.clientX - sx, dy = e.clientY - sy, ad = Math.max(Math.abs(dx), Math.abs(dy));
      if (ad < 18) fn("tap", e);
      else if (Math.abs(dx) > Math.abs(dy)) fn(dx > 0 ? "right" : "left", e);
      else fn(dy > 0 ? "down" : "up", e);
    });
    el.addEventListener("pointercancel", function () { on = false; });
  };
  A3.ray = function (e, camera, el) {
    var THREE = window.THREE, r = el.getBoundingClientRect();
    var v = new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    var rc = new THREE.Raycaster(); rc.setFromCamera(v, camera); return rc;
  };
  /* where the pointer hits the horizontal plane y = h */
  A3.floorPoint = function (e, camera, el, h) {
    var THREE = window.THREE, rc = A3.ray(e, camera, el), p = new THREE.Vector3();
    var plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -(h || 0));
    return rc.ray.intersectPlane(plane, p) ? p : null;
  };
  A3.fullscreen = function (btn, stage) {
    if (!btn) return;
    var can = stage.requestFullscreen || stage.webkitRequestFullscreen;
    if (!can) { btn.style.display = "none"; return; }
    btn.addEventListener("click", function () {
      if (document.fullscreenElement || document.webkitFullscreenElement) (document.exitFullscreen || document.webkitExitFullscreen).call(document);
      else can.call(stage);
    });
  };

  /* ---------- small maths ---------- */
  A3.lerp = function (a, b, t) { return a + (b - a) * t; };
  A3.clamp = function (v, a, b) { return v < a ? a : v > b ? b : v; };
  A3.rand = function (a, b) { return a + Math.random() * (b - a); };
  A3.pick = function (arr) { return arr[Math.floor(Math.random() * arr.length)]; };
  A3.ease = function (t) { return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; };
  A3.seeded = function (seed) { var s = seed >>> 0 || 1; return function () { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return ((s >>> 0) % 1e9) / 1e9; }; };

  window.A3 = A3;
})();
