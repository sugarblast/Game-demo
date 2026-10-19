#!/usr/bin/env python3
"""Rebuilds index.html from src/ (same as build.js, for people without Node). Run: python build.py"""
import os
root = os.path.dirname(os.path.abspath(__file__))
rd = lambda f: open(os.path.join(root, "src", f), encoding="utf-8").read()
js = "\n;\n".join(rd(f) for f in ["data.js", "news.js", "sim.js", "trophies.js", "audio.js", "map.js", "ui.js"])
assert "</script" not in js, "JS contains </script"
html = rd("template.html").replace("/*CSS*/", rd("style.css")).replace("/*JS*/", js)
open(os.path.join(root, "index.html"), "w", encoding="utf-8").write(html)
print("index.html %.1f KB" % (len(html.encode("utf-8")) / 1024))
