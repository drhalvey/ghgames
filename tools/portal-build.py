#!/usr/bin/env python3
"""Build stand-alone copies of GH Games for game portals (itch.io, Newgrounds, CrazyGames).

    python3 tools/portal-build.py over-the-top culloden ...   -> ../portal/<slug>/ and ../portal/<slug>.zip

Each copy is the game page as index.html plus the local files it needs, with the
online parts swapped for offline stubs (tools/portal-stubs.js):
  - no GH Games accounts, PhatCoin, Gear or online leaderboards (saves stay on the device)
  - no Supabase, no Google Analytics, no service worker
  - no links back to ghgames.au or to other games (portals do not allow outbound links)
  --crazygames adds the CrazyGames SDK v3, --poki the Poki SDK, --gd the GameDistribution SDK
  (--gd-id=<game id from the GameDistribution dashboard>). Each gets loading/gameplay events and
  ad breaks before the buttons listed in BREAKS (see GHPortal in tools/portal-stubs.js).
  Poki and GameDistribution builds bundle the fonts (tools/portal-fonts) so nothing loads from outside.
"""
import json, os, re, shutil, sys, zipfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(os.path.dirname(ROOT), "portal")
SHARED = {"account.js", "phatcoin.js", "gear.js", "leaderboard.js", "analytics.js"}
SDK = {
    "crazygames": '<script src="https://sdk.crazygames.com/crazygames-sdk-v3.js"></script>',
    "poki": '<script src="https://game-cdn.poki.com/scripts/v2/poki-sdk.js"></script>',
    "gd": '',  # loaded by portal-stubs.js after GD_OPTIONS is set
}
PREFIX = {"crazygames": "cg-", "poki": "poki-", "gd": "gd-"}
# Buttons that start a level, round or rematch: a portal ad break runs before they act.
BREAKS = {
    "rugby-kicker-pro": ["#btnPlay", "#btnNext", "#btnRetry", "#levelList .lv:not(.lock)"],
    "parry-panic": ["#bPlay", "#bNext", "#oAgain"],
    "over-the-top": ["#startBtn", "#againBtn"],
}

def build(slug, target=None, gd_id=""):
    crazy = bool(target)  # any ad portal gets the portal app mode below
    src = open(os.path.join(ROOT, slug + ".html"), encoding="utf-8").read()
    dest = os.path.join(OUT, PREFIX.get(target, "") + slug)
    shutil.rmtree(dest, ignore_errors=True); os.makedirs(dest)
    s = src
    # SEO "About this game" block from the site: not wanted on portals
    s = re.sub(r'\s*<section class="gh-about".*?</section>', '', s, flags=re.S)
    # online libraries -> one offline stub
    stub_done = False
    def repl(m):
        nonlocal stub_done
        if stub_done: return ""
        stub_done = True
        return '<script src="portal-stubs.js"></script>'
    s = re.sub(r'<script src="(?:%s)"[^>]*></script>' % "|".join(re.escape(x) for x in SHARED), repl, s)
    s = re.sub(r'<script src="(?:https://cdn\.jsdelivr\.net/npm/@supabase|vendor/supabase-)[^"]*"></script>\s*', "", s)
    s = re.sub(r'<link rel="(?:manifest|canonical)"[^>]*>\s*', "", s)
    s = re.sub(r'<meta property="og:url"[^>]*>\s*', "", s)
    # links to the arcade or other games: hide them
    s = re.sub(r'<a ([^>]*)href="(?!#)([^"]*)"', lambda m: '<a %shref="%s" data-portal-hide="1"' % (m.group(1), m.group(2))
               if (m.group(2).endswith(".html") or "ghgames" in m.group(2) or m.group(2).startswith("http")) else m.group(0), s)
    # sentences that point players to GH Games accounts or the arcade
    s = re.sub(r'[^.>!]*GH Games account[^.<!]*[.!]', '', s)
    css = '<style>[data-portal-hide]{display:none!important}</style>'
    head_add = css
    if target:
        head_add += SDK[target]
    if target in ("poki", "gd"):
        # bundled fonts instead of Google Fonts (Poki blocks outside requests)
        s = re.sub(r'<link rel="preconnect"[^>]*fonts\.g[^>]*>\s*', '', s)
        s = re.sub(r'<link rel="stylesheet" href="https://fonts\.googleapis\.com[^"]*">', '<link rel="stylesheet" href="fonts.css">', s)
    s = s.replace("</head>", head_add + "\n</head>", 1)
    if crazy:
        # portal app mode: full-window game, shop drawer, first-play tips (tools/portal-app/<slug>.css/.js)
        app = os.path.join(ROOT, "tools", "portal-app", slug)
        if os.path.isfile(app + ".css"):
            s = s.replace("</head>", "<style>\n" + open(app + ".css", encoding="utf-8").read() + "\n</style>\n</head>", 1)
        if os.path.isfile(app + ".js"):
            i = s.rfind("</body>")
            s = s[:i] + "<script>\n" + open(app + ".js", encoding="utf-8").read() + "\n</script>\n" + s[i:]
        # no mentions of the Classic version on portals
        s = re.sub(r'<li>Same save[^\n]*?</li>\s*', '', s)
        s = re.sub(r"This device can't run the 3D version\. Play (?:Rugby Kicker )?(?:the )?Classic(?: version)? instead[^\"<]*", "This device can't run the 3D version. Try a newer browser or device.", s)
        s = re.sub(r'(?<=[.!>])\s*[^.<>]*(?:<[^>]*>[^<.]*)*?<a [^>]*data-portal-hide="1"[^>]*>Classic version</a>\.', '', s)
    open(os.path.join(dest, "index.html"), "w", encoding="utf-8").write(s)
    stub = open(os.path.join(ROOT, "tools", "portal-stubs.js"), encoding="utf-8").read()
    if target:
        stub = "window.GH_TARGET = %r; window.GH_GD_ID = %r;%s\n" % (target, gd_id, " window.GH_CRAZY = true;" if target == "crazygames" else "") + stub
        if slug in BREAKS:
            stub += "\nwindow.GHPortal && GHPortal.breakOn(%s);\n" % json.dumps(BREAKS[slug])
    open(os.path.join(dest, "portal-stubs.js"), "w", encoding="utf-8").write(stub)
    # local assets the page references
    for ref in sorted(set(re.findall(r'(?:src|href)="([^":#?]+\.(?:js|css|svg|png|jpg|mp3|ogg|wav|json))"', s))):
        if ref in SHARED or ref == "portal-stubs.js": continue
        p = os.path.join(ROOT, ref)
        if os.path.isfile(p):
            os.makedirs(os.path.dirname(os.path.join(dest, ref)) or dest, exist_ok=True)
            shutil.copy(p, os.path.join(dest, ref))
    for ref in re.findall(r'["\'](vendor/[^"\']+|arcade3d\.(?:js|css)|sounds?/[^"\']+)["\']', s):
        p = os.path.join(ROOT, ref)
        if os.path.isfile(p) and not os.path.exists(os.path.join(dest, ref)):
            os.makedirs(os.path.dirname(os.path.join(dest, ref)), exist_ok=True); shutil.copy(p, os.path.join(dest, ref))
    if crazy:
        # CrazyGames takes loose files only (no zips, no folders): flatten
        for d, _, fs in list(os.walk(dest)):
            if d == dest: continue
            for f in fs:
                rel = os.path.relpath(os.path.join(d, f), dest).replace(os.sep, "/")
                shutil.move(os.path.join(d, f), os.path.join(dest, f))
                h = os.path.join(dest, "index.html"); t = open(h, encoding="utf-8").read()
                t = re.sub(r'([\'"(])(?:\./)?' + re.escape(rel), r'\g<1>' + f, t); open(h, "w", encoding="utf-8").write(t)
        for d, ds, _ in list(os.walk(dest, topdown=False)):
            if d != dest: shutil.rmtree(d, ignore_errors=True)
    if target in ("poki", "gd"):
        fd = os.path.join(ROOT, "tools", "portal-fonts")
        for f in os.listdir(fd): shutil.copy(os.path.join(fd, f), os.path.join(dest, f))
    # anything still loading from outside the build (Poki blocks all of it)
    allowed = ("sdk.crazygames.com", "game-cdn.poki.com", "html5.api.gamedistribution.com")
    for d, _, fs in os.walk(dest):
        for f in fs:
            if not f.endswith((".html", ".js", ".css")): continue
            t = open(os.path.join(d, f), encoding="utf-8", errors="ignore").read()
            for u in sorted(set(re.findall(r'(?:src|href)\s*=\s*["\'](https?://[^"\']+)', t) + re.findall(r'url\(["\']?(https?://[^)"\']+)', t) + re.findall(r'["\'](https://cdn\.jsdelivr\.net/[^"\']+)', t))):
                if not any(a in u for a in allowed):
                    print("  outside request in %s: %s" % (f, u))
    z = dest + ".zip"
    with zipfile.ZipFile(z, "w", zipfile.ZIP_DEFLATED) as zf:
        for d, _, fs in os.walk(dest):
            for f in fs:
                full = os.path.join(d, f); zf.write(full, os.path.relpath(full, dest))
    return dest, z

if __name__ == "__main__":
    target = "crazygames" if "--crazygames" in sys.argv else "poki" if "--poki" in sys.argv else "gd" if "--gd" in sys.argv else None
    gd_id = next((a.split("=", 1)[1] for a in sys.argv if a.startswith("--gd-id=")), "")
    for slug in [a for a in sys.argv[1:] if not a.startswith("--")]:
        d, z = build(slug, target, gd_id)
        print(slug, "->", z, os.path.getsize(z) // 1024, "KB")
