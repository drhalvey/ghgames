#!/usr/bin/env python3
"""Build stand-alone copies of GH Games for game portals (itch.io, Newgrounds, CrazyGames).

    python3 tools/portal-build.py over-the-top culloden ...   -> ../portal/<slug>/ and ../portal/<slug>.zip

Each copy is the game page as index.html plus the local files it needs, with the
online parts swapped for offline stubs (tools/portal-stubs.js):
  - no GH Games accounts, PhatCoin, Gear or online leaderboards (saves stay on the device)
  - no Supabase, no Google Analytics, no service worker
  - no links back to ghgames.au or to other games (portals do not allow outbound links)
  --crazygames adds the CrazyGames SDK v3 with loading/gameplay events.
"""
import os, re, shutil, sys, zipfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(os.path.dirname(ROOT), "portal")
SHARED = {"account.js", "phatcoin.js", "gear.js", "leaderboard.js", "analytics.js"}

def build(slug, crazy=False):
    src = open(os.path.join(ROOT, slug + ".html"), encoding="utf-8").read()
    dest = os.path.join(OUT, ("cg-" if crazy else "") + slug)
    shutil.rmtree(dest, ignore_errors=True); os.makedirs(dest)
    s = src
    # online libraries -> one offline stub
    stub_done = False
    def repl(m):
        nonlocal stub_done
        if stub_done: return ""
        stub_done = True
        return '<script src="portal-stubs.js"></script>'
    s = re.sub(r'<script src="(?:%s)"[^>]*></script>' % "|".join(re.escape(x) for x in SHARED), repl, s)
    s = re.sub(r'<script src="https://cdn\.jsdelivr\.net/npm/@supabase[^"]*"></script>\s*', "", s)
    s = re.sub(r'<link rel="(?:manifest|canonical)"[^>]*>\s*', "", s)
    s = re.sub(r'<meta property="og:url"[^>]*>\s*', "", s)
    # links to the arcade or other games: hide them
    s = re.sub(r'<a ([^>]*)href="(?!#)([^"]*)"', lambda m: '<a %shref="%s" data-portal-hide="1"' % (m.group(1), m.group(2))
               if (m.group(2).endswith(".html") or "ghgames" in m.group(2) or m.group(2).startswith("http")) else m.group(0), s)
    # sentences that point players to GH Games accounts or the arcade
    s = re.sub(r'[^.>!]*GH Games account[^.<!]*[.!]', '', s)
    css = '<style>[data-portal-hide]{display:none!important}</style>'
    head_add = css
    if crazy:
        head_add += '<script src="https://sdk.crazygames.com/crazygames-sdk-v3.js"></script>'
    s = s.replace("</head>", head_add + "\n</head>", 1)
    open(os.path.join(dest, "index.html"), "w", encoding="utf-8").write(s)
    stub = open(os.path.join(ROOT, "tools", "portal-stubs.js"), encoding="utf-8").read()
    if crazy: stub = "window.GH_CRAZY = true;\n" + stub
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
    z = dest + ".zip"
    with zipfile.ZipFile(z, "w", zipfile.ZIP_DEFLATED) as zf:
        for d, _, fs in os.walk(dest):
            for f in fs:
                full = os.path.join(d, f); zf.write(full, os.path.relpath(full, dest))
    return dest, z

if __name__ == "__main__":
    crazy = "--crazygames" in sys.argv
    for slug in [a for a in sys.argv[1:] if not a.startswith("--")]:
        d, z = build(slug, crazy)
        print(slug, "->", z, os.path.getsize(z) // 1024, "KB")
