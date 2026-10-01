/* GH Games homepage: the console-style hero, its game rail, and the type filters.
   Everything is read from the game tiles in the grid, so adding a tile to index.html
   puts the game in the rail and the filters automatically. */
(function () {
  var tiles = [].slice.call(document.querySelectorAll("#grid .tile"));
  if (!tiles.length) return;
  var $ = function (id) { return document.getElementById(id); };
  var hero = $("hero"), rail = $("rail");
  var reduce = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
  var uid = 0;

  // Copy a tile's cover art. Ids inside SVGs (gradients) are renamed so copies never clash.
  function art(tile) {
    var svg = tile.querySelector(".art svg").cloneNode(true);
    var n = "c" + (++uid) + "_";
    var ids = [].slice.call(svg.querySelectorAll("[id]"));
    if (ids.length) {
      var map = {};
      ids.forEach(function (el) { map[el.id] = n + el.id; el.id = n + el.id; });
      [].slice.call(svg.querySelectorAll("*")).forEach(function (el) {
        [].slice.call(el.attributes).forEach(function (a) {
          var v = a.value;
          if (v.indexOf("#") < 0) return;
          var nv = v.replace(/url\(#([^)]+)\)/g, function (m, id) { return map[id] ? "url(#" + map[id] + ")" : m; });
          if ((a.name === "href" || a.name === "xlink:href") && map[v.slice(1)]) nv = "#" + map[v.slice(1)];
          if (nv !== v) el.setAttribute(a.name, nv);
        });
      });
    }
    svg.removeAttribute("aria-hidden");
    svg.setAttribute("aria-hidden", "true");
    return svg;
  }

  function info(tile) {
    return {
      href: tile.getAttribute("href"),
      title: tile.querySelector("h3").textContent,
      desc: tile.querySelector(".meta p").textContent,
      tags: [].slice.call(tile.querySelectorAll(".tags span")).map(function (s) { return s.textContent; }),
      glow: tile.style.getPropertyValue("--glow"),
      isNew: !!tile.querySelector(".badge.new")
    };
  }

  // ---- rail ----
  var thumbs = tiles.map(function (tile, i) {
    var g = info(tile);
    var b = document.createElement("button");
    b.type = "button";
    b.className = "thumb";
    b.setAttribute("role", "tab");
    b.setAttribute("aria-label", g.title);
    b.style.setProperty("--glow", g.glow);
    b.appendChild(art(tile));
    var l = document.createElement("span");
    l.className = "thumb-name";
    l.textContent = g.title;
    b.appendChild(l);
    b.addEventListener("click", function () {
      stopAuto();
      if (cur === i) { location.href = g.href; return; }
      show(i, true);
    });
    rail.appendChild(b);
    return b;
  });

  var cur = -1;
  function show(i, user) {
    if (i === cur) return;
    cur = i;
    var tile = tiles[i], g = info(tile);
    hero.style.setProperty("--glow", g.glow);
    var copy = $("heroCopy"), card = $("heroCard"), bloom = $("heroBloom");
    hero.classList.remove("swap"); void hero.offsetWidth; if (!reduce) hero.classList.add("swap");
    $("heroTitle").textContent = g.title;
    $("heroDesc").textContent = g.desc;
    $("heroTags").innerHTML = g.tags.map(function (t) { return "<span>" + t + "</span>"; }).join("");
    $("heroFlag").hidden = !g.isNew;
    $("heroPlay").href = g.href;
    $("heroPlay").setAttribute("aria-label", "Play " + g.title);
    card.href = g.href;
    card.setAttribute("aria-label", "Play " + g.title);
    card.replaceChildren(art(tile));
    bloom.replaceChildren(art(tile));
    thumbs.forEach(function (b, k) {
      b.classList.toggle("on", k === i);
      b.setAttribute("aria-selected", k === i ? "true" : "false");
      b.tabIndex = k === i ? 0 : -1;
    });
    var t = thumbs[i];
    var left = t.offsetLeft - (rail.clientWidth - t.offsetWidth) / 2;
    rail.scrollTo({ left: Math.max(0, left), behavior: user && !reduce ? "smooth" : "auto" });
    if (window.gtag && user) window.gtag("event", "hero_pick", { game: g.title });
  }

  // arrow keys move along the rail
  rail.addEventListener("keydown", function (e) {
    var d = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
    if (!d) return;
    e.preventDefault(); stopAuto();
    var n = (cur + d + tiles.length) % tiles.length;
    show(n, true); thumbs[n].focus();
  });

  // gentle auto-advance until someone touches the rail
  var timer = null;
  function stopAuto() { if (timer) { clearInterval(timer); timer = null; } hero.classList.remove("auto"); }
  if (!reduce) {
    hero.classList.add("auto");
    timer = setInterval(function () { show((cur + 1) % tiles.length, false); }, 7000);
    hero.addEventListener("pointerenter", function (e) { if (e.pointerType === "mouse") stopAuto(); });
  }

  show(0, false);

  // ---- filters ----
  var count = {};
  tiles.forEach(function (t) { (t.dataset.tags || "").split(" ").forEach(function (x) { if (x) count[x] = (count[x] || 0) + 1; }); });
  var types = Object.keys(count).filter(function (k) { return count[k] > 1; }).sort(function (a, b) { return count[b] - count[a]; });
  var box = $("filters");
  ["All"].concat(types).forEach(function (t, i) {
    var b = document.createElement("button");
    b.type = "button";
    b.className = "chip" + (i ? "" : " on");
    b.setAttribute("aria-pressed", i ? "false" : "true");
    b.innerHTML = t + " <b>" + (i ? count[t] : tiles.length) + "</b>";
    b.addEventListener("click", function () {
      [].forEach.call(box.children, function (c) { c.classList.toggle("on", c === b); c.setAttribute("aria-pressed", c === b ? "true" : "false"); });
      var shown = 0;
      tiles.forEach(function (tile) {
        var ok = t === "All" || (" " + tile.dataset.tags + " ").indexOf(" " + t + " ") >= 0;
        tile.hidden = !ok; if (ok) shown++;
      });
      $("empty").hidden = shown > 0;
    });
    box.appendChild(b);
  });
})();
