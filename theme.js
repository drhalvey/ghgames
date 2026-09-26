/* GH Games themes + the 67 easter egg.
   Loaded in <head> so the saved theme applies before the page paints.
   Themes only change colours (see site.css). */
(function () {
  var KEY = "ghgames_theme";
  var THEMES = [
    { id: "classic", name: "Classic", swatch: "#ffcc33" },
    { id: "67", name: "Six Seven", swatch: "#b8ff3c" },
    { id: "lava", name: "Lava", swatch: "#ff7a2f" },
    { id: "ocean", name: "Ocean", swatch: "#37e2d5" }
  ];
  function get() { try { return localStorage.getItem(KEY) || "classic"; } catch (e) { return "classic"; } }
  function set(t) { try { localStorage.setItem(KEY, t); } catch (e) {} }
  function apply(t) {
    if (t === "classic") document.documentElement.removeAttribute("data-theme");
    else document.documentElement.setAttribute("data-theme", t);
  }
  apply(get());

  function track(name, params) { if (window.gtag) window.gtag("event", name, params || {}); }

  // 67 rain: a burst of falling 6 7s
  function rain() {
    var n = 67;
    for (var i = 0; i < n; i++) {
      var d = document.createElement("div");
      d.className = "rain67";
      d.textContent = Math.random() < 0.5 ? "67" : "6 7";
      d.style.left = Math.random() * 100 + "vw";
      d.style.fontSize = 22 + Math.random() * 46 + "px";
      d.style.animationDuration = 1.6 + Math.random() * 2.2 + "s";
      d.style.animationDelay = Math.random() * 1.2 + "s";
      d.style.setProperty("--spin", (Math.random() * 720 - 360) + "deg");
      d.addEventListener("animationend", function () { this.remove(); });
      document.body.appendChild(d);
    }
    track("six_seven");
  }
  window.ghRain67 = rain;

  document.addEventListener("DOMContentLoaded", function () {
    // theme picker in the top bar
    var nav = document.querySelector(".topbar nav");
    if (nav) {
      var wrap = document.createElement("div");
      wrap.className = "theme-wrap";
      wrap.innerHTML = '<button class="theme-btn" type="button" aria-label="Change theme" aria-haspopup="true"><span></span></button>'
        + '<div class="theme-menu" role="menu"><p>Theme</p>'
        + THEMES.map(function (t) {
            return '<button type="button" role="menuitemradio" data-t="' + t.id + '"><i style="background:' + t.swatch + '"></i>' + t.name + "</button>";
          }).join("")
        + "</div>";
      var slot = document.getElementById("gh-account");
      nav.insertBefore(wrap, slot || null);
      var btn = wrap.querySelector(".theme-btn"), menu = wrap.querySelector(".theme-menu");
      function mark() {
        var cur = get();
        menu.querySelectorAll("button").forEach(function (b) { b.classList.toggle("on", b.dataset.t === cur); });
      }
      mark();
      btn.addEventListener("click", function (e) { e.stopPropagation(); menu.classList.toggle("open"); });
      document.addEventListener("click", function () { menu.classList.remove("open"); });
      menu.addEventListener("click", function (e) {
        var b = e.target.closest("button[data-t]"); if (!b) return;
        set(b.dataset.t); apply(b.dataset.t); mark(); menu.classList.remove("open");
        track("theme_change", { theme: b.dataset.t });
        if (b.dataset.t === "67") rain();
      });
    }

    // the 6 7 button (shows in the Six Seven theme)
    document.querySelectorAll(".btn-67").forEach(function (b) { b.addEventListener("click", rain); });

    // type 6 then 7 anywhere (not in a text box) for 67 rain
    var last = "";
    document.addEventListener("keydown", function (e) {
      var tag = (e.target.tagName || "").toLowerCase();
      if (tag === "input" || tag === "textarea") return;
      if (last === "6" && e.key === "7") rain();
      last = e.key;
    });
  });
})();
