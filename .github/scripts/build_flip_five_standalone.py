#!/usr/bin/env python3
"""Build flip-five-standalone.html: Flip Five as ONE self-contained file.

The game itself stays in flip-five/index.html (edit only that). This script copies it and
  - embeds three.js (lib/three.module.min.js) so the 3D board works with no other files,
  - embeds the Latin Barlow / Barlow Condensed fonts (fetched from Google Fonts; if that fails the
    normal font link is kept, so the page still works but may use fallback fonts offline),
  - embeds the app icon (flip-five/icon.png),
  - points the daily Wordle lookup at the live site, since wordle.json is not alongside the file.
Run by .github/workflows/flip-five-standalone.yml on every change to the game; safe to run by hand.
"""
import base64, re, sys, urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / "flip-five" / "index.html"
OUT = ROOT / "flip-five-standalone.html"
SITE = "https://voodoovid.github.io/flip-five/"
UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36"

def get(url):
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=30) as r:
        return r.read()

def b64(data):
    return base64.b64encode(data).decode("ascii")

def inline_fonts(html):
    m = re.search(r'<link rel="stylesheet" href="(https://fonts\.googleapis\.com/[^"]+)">', html)
    if not m:
        return html, False
    try:
        css = get(m.group(1)).decode("utf-8")
        faces = []
        for comment, block in re.findall(r"/\*\s*([\w-]+)\s*\*/\s*(@font-face\s*\{[^}]*\})", css):
            if comment != "latin":      # the Latin subset is all this game uses
                continue
            url = re.search(r"url\((https://[^)]+)\)", block).group(1)
            block = block.replace(url, "data:font/woff2;base64," + b64(get(url)))
            faces.append(block)
        if not faces:
            raise RuntimeError("no latin font faces found")
    except Exception as e:
        print("fonts not embedded (%s); keeping the Google Fonts link" % e, file=sys.stderr)
        return html, False
    html = html.replace(m.group(0), "<style>\n" + "\n".join(faces) + "\n</style>")
    html = re.sub(r'<link rel="preconnect" href="https://fonts\.g[^>]*>\n?', "", html)
    return html, True

def main():
    html = SRC.read_text(encoding="utf-8")

    imp = 'import * as THREE from "../lib/three.module.min.js";'
    assert html.count(imp) == 1, "three.js import line not found"
    three = (ROOT / "lib" / "three.module.min.js").read_bytes()
    html = html.replace(imp, 'import * as THREE from "data:text/javascript;base64,%s";' % b64(three))

    old = 'fetch("wordle.json?"'
    assert html.count(old) == 1, "wordle.json fetch not found"
    html = html.replace(old, 'fetch("%swordle.json?"' % SITE)

    icon = 'href="icon.png"'
    assert html.count(icon) == 2, "icon links not found"
    html = html.replace(icon, 'href="data:image/png;base64,%s"' % b64((ROOT / "flip-five" / "icon.png").read_bytes()))

    html, _ = inline_fonts(html)

    banner = ("<!-- GENERATED FILE: a single-file copy of flip-five/index.html with three.js and fonts embedded. "
              "Do not edit; change flip-five/index.html and this is rebuilt automatically. -->\n")
    html = html.replace("<!doctype html>\n", "<!doctype html>\n" + banner, 1)
    OUT.write_text(html, encoding="utf-8")
    print("wrote %s (%d KB)" % (OUT.name, OUT.stat().st_size // 1024))

main()
