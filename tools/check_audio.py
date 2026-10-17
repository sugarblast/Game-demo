#!/usr/bin/env python3
"""Checks assets/audio/manifest.js. Run from the project folder: python tools/check_audio.py"""
import json, os, re, shutil, subprocess, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MAN = os.path.join(ROOT, "assets", "audio", "manifest.js")
SFX = {"click": 0.1, "dna": 0.3, "gold": 0.8, "buy": 0.6, "deny": 0.3, "sabotage": 1.0, "detect": 1.0, "close": 0.6,
       "death": 2.0, "spread": 0.15, "cure": 1.2, "news": 2.5, "newsClose": 0.3, "win": 4.0, "lose": 4.0}
MUSIC = ["calm", "tense", "panic"]
errors, warns = [], []

def dur(path):
    if not shutil.which("ffprobe"): return None
    try:
        out = subprocess.check_output(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", path], text=True)
        return float(out.strip())
    except Exception: return None

def main():
    txt = open(MAN, encoding="utf-8").read()
    m = re.search(r"window\.OUTBREAK_AUDIO\s*=\s*(\{.*\})\s*;?\s*$", txt, re.S)
    if not m: print("ERROR manifest.js must contain: window.OUTBREAK_AUDIO = { ... };"); sys.exit(1)
    try: data = json.loads(re.sub(r"^\s*//.*$", "", m.group(1), flags=re.M))
    except json.JSONDecodeError as e: print("ERROR manifest is not strict JSON (double quotes, no trailing commas):", e); sys.exit(1)
    total = 0; n = 0
    def check(kind, name, rel, maxkb, maxdur):
        nonlocal total, n
        p = os.path.join(ROOT, rel)
        if not os.path.exists(p): errors.append("%s.%s: file not found: %s" % (kind, name, rel)); return
        if not rel.lower().endswith((".mp3", ".ogg")): warns.append("%s.%s: use mp3 or ogg (%s)" % (kind, name, rel))
        kb = os.path.getsize(p) / 1024; total += kb; n += 1
        if kb > maxkb: warns.append("%s.%s is %.0f KB (limit %d KB)" % (kind, name, kb, maxkb))
        d = dur(p)
        if d is not None and maxdur and d > maxdur + 0.15: warns.append("%s.%s lasts %.2fs (max %.2fs)" % (kind, name, d, maxdur))
        print("  %-14s %6.0f KB%s  %s" % (kind + "." + name, kb, "  %.2fs" % d if d else "", rel))
    for name, rel in (data.get("sfx") or {}).items():
        if name not in SFX: errors.append("unknown sfx name %r (allowed: %s)" % (name, ", ".join(SFX))); continue
        check("sfx", name, rel, 60, SFX[name])
    for name, rel in (data.get("music") or {}).items():
        if name not in MUSIC: errors.append("unknown music name %r (allowed: %s)" % (name, ", ".join(MUSIC))); continue
        check("music", name, rel, 1536, 95)
    if data.get("music") and set(data["music"]) != set(MUSIC): warns.append("music: provide all three (calm, tense, panic) so crossfades work")
    missing = [s for s in SFX if s not in (data.get("sfx") or {})]
    print("\n%d file(s), %.0f KB total. Sounds still using built-in synth: %s" % (n, total, ", ".join(missing) or "none"))
    if total > 5 * 1024: warns.append("folder is over 5 MB")
    if not os.path.exists(os.path.join(ROOT, "assets", "audio", "CREDITS.md")) and n: warns.append("no assets/audio/CREDITS.md (list the source and license of every file)")
    for w in warns: print("WARN ", w)
    for e in errors: print("ERROR", e)
    print("\n%s" % ("FAILED: %d error(s)" % len(errors) if errors else "OK"))
    sys.exit(1 if errors else 0)

if __name__ == "__main__": main()
