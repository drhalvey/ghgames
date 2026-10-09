#!/usr/bin/env python3
"""Smoke-test a GH Games page in headless Chromium (WebGL via SwiftShader).

    python3 tools/test3d.py cube-merge.html [--click "#bPlay"] [--keys "ArrowLeft,ArrowUp"] [--wait 3] [--shot out.png]

Serves the repo on a local port, opens the page, blocks outside requests
(Supabase, fonts, analytics), optionally clicks a selector and presses keys,
waits, saves a screenshot and prints every console error / page error.
Exit code 1 if the page threw an error.
"""
import argparse, functools, http.server, os, socketserver, sys, threading, time
from playwright.sync_api import sync_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

def serve():
    class Q(http.server.SimpleHTTPRequestHandler):
        def log_message(self, *a): pass
    h = functools.partial(Q, directory=ROOT)
    s = socketserver.TCPServer(("127.0.0.1", 0), h)
    threading.Thread(target=s.serve_forever, daemon=True).start()
    return s.server_address[1]

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("page")
    ap.add_argument("--click", action="append", default=[])
    ap.add_argument("--keys", default="")
    ap.add_argument("--mouse", default="", help="x,y fractions of the stage to click, ; separated")
    ap.add_argument("--wait", type=float, default=3)
    ap.add_argument("--shot", default="")
    ap.add_argument("--eval", default="", help="JS to evaluate at the end; result printed")
    ap.add_argument("--size", default="1100x900")
    a = ap.parse_args()
    port = serve()
    W, H = map(int, a.size.split("x"))
    errors = []
    with sync_playwright() as p:
        b = p.chromium.launch(args=["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--autoplay-policy=no-user-gesture-required"])
        pg = b.new_page(viewport={"width": W, "height": H})
        pg.route("**/*", lambda r: r.continue_() if r.request.url.startswith(f"http://127.0.0.1:{port}") else r.abort())
        pg.on("pageerror", lambda e: errors.append("PAGEERROR " + str(e)))
        def con(m):
            if m.type == "error" and "net::ERR_FAILED" not in m.text and "Failed to load resource" not in m.text and "leaderboard api" not in m.text and "Failed to fetch" not in m.text:
                errors.append("CONSOLE " + m.text)
        pg.on("console", con)
        pg.goto(f"http://127.0.0.1:{port}/{a.page}")
        pg.wait_for_timeout(1500)
        for sel in a.click:
            try:
                pg.click(sel, timeout=3000); pg.wait_for_timeout(500)
            except Exception as e:
                errors.append(f"CLICK {sel} failed: {e}")
        if a.mouse:
            box = pg.eval_on_selector(".stage", "e=>{const r=e.getBoundingClientRect();return [r.x,r.y,r.width,r.height]}")
            for pair in a.mouse.split(";"):
                fx, fy = map(float, pair.split(","))
                pg.mouse.click(box[0] + fx * box[2], box[1] + fy * box[3]); pg.wait_for_timeout(250)
        for k in [k for k in a.keys.split(",") if k]:
            pg.keyboard.down(k); pg.wait_for_timeout(120); pg.keyboard.up(k); pg.wait_for_timeout(200)
        pg.wait_for_timeout(int(a.wait * 1000))
        if a.eval:
            try: print("EVAL:", pg.evaluate(a.eval))
            except Exception as e: errors.append(f"EVAL failed: {e}")
        if a.shot:
            pg.screenshot(path=a.shot)
        b.close()
    for e in errors: print(e)
    print("OK" if not errors else f"{len(errors)} error(s)")
    sys.exit(1 if any(e.startswith(("PAGEERROR", "CONSOLE")) for e in errors) else 0)

if __name__ == "__main__":
    main()
