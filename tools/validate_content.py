#!/usr/bin/env python3
"""Checks assets/content/extra.js. Run from the project folder: python tools/validate_content.py"""
import json, os, random, re, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PATH = os.path.join(ROOT, "assets", "content", "extra.js")

TICKER = {  # key -> allowed tokens
    "zero": "pr", "air": "pr", "sea": "pr", "land": "pr", "death": "pr", "detect": "pr",
    "closeB": "pr", "closeA": "pr", "closeS": "pr", "lock": "pr",
    "cure25": "p", "cure50": "p", "cure75": "p", "sab": "p",
    "hintCold": "pr", "hintHot": "pr", "winEnd": "p", "loseEnd": "p", "burnEnd": "p",
}
BREAKING = {
    "detect1": "pr", "death1": "pr", "close1": "pr", "inf_100k": "p", "inf_1b": "p",
    "dead_1m": "p", "dead_100m": "p", "dead_1b": "p", "cure25": "p", "cure50": "p", "cure75": "p",
    "regions25": "p", "sab1": "p", "random": "p",
}
MAX_TICKER, MAX_H, MAX_S = 110, 80, 160
errors, warns = [], []

def err(m): errors.append(m)
def warn(m): warns.append(m)

def load():
    txt = open(PATH, encoding="utf-8").read()
    m = re.search(r"window\.OUTBREAK_CONTENT\s*=\s*(\{.*\})\s*;?\s*$", txt, re.S)
    if not m:
        err("extra.js must contain exactly: window.OUTBREAK_CONTENT = { ... };")
        return None
    body = re.sub(r"^\s*//.*$", "", m.group(1), flags=re.M)
    try:
        return json.loads(body)
    except json.JSONDecodeError as e:
        err("the object is not strict JSON (use double quotes, no trailing commas, no comments): %s" % e)
        return None

def check_tokens(s, allowed, where):
    for t in re.findall(r"\{(\w+)\}", s):
        if t not in allowed:
            err("%s: token {%s} not allowed here: %r" % (where, t, s[:60]))
    if re.search(r"[{}]", re.sub(r"\{\w+\}", "", s)):
        err("%s: stray brace in %r" % (where, s[:60]))

def main():
    if not os.path.exists(PATH):
        print("missing", PATH); sys.exit(1)
    data = load()
    counts = {}
    seen = set()
    if data is not None:
        for top in data:
            if top not in ("ticker", "breaking"):
                err("unknown top-level key %r (only ticker and breaking)" % top)
        for key, lines in (data.get("ticker") or {}).items():
            if key not in TICKER:
                err("unknown ticker key %r" % key); continue
            if not isinstance(lines, list): err("ticker.%s must be a list" % key); continue
            counts["ticker." + key] = len(lines)
            for s in lines:
                if not isinstance(s, str): err("ticker.%s has a non-string entry" % key); continue
                if len(s) > MAX_TICKER: err("ticker.%s too long (%d>%d): %r" % (key, len(s), MAX_TICKER, s[:50]))
                check_tokens(s, TICKER[key], "ticker." + key)
                k = s.strip().lower()
                if k in seen: err("duplicate line: %r" % s[:60])
                seen.add(k)
        for key, items in (data.get("breaking") or {}).items():
            if key not in BREAKING:
                err("unknown breaking key %r" % key); continue
            if not isinstance(items, list): err("breaking.%s must be a list" % key); continue
            counts["breaking." + key] = len(items)
            for o in items:
                if not (isinstance(o, dict) and isinstance(o.get("h"), str) and isinstance(o.get("s"), str)):
                    err("breaking.%s entries must be {\"h\":..., \"s\":...}" % key); continue
                if len(o["h"]) > MAX_H: err("breaking.%s headline too long (%d>%d): %r" % (key, len(o["h"]), MAX_H, o["h"][:50]))
                if len(o["s"]) > MAX_S: err("breaking.%s subline too long (%d>%d): %r" % (key, len(o["s"]), MAX_S, o["s"][:50]))
                check_tokens(o["h"], BREAKING[key], "breaking.%s.h" % key)
                check_tokens(o["s"], BREAKING[key], "breaking.%s.s" % key)
                k = (o["h"] + "|" + o["s"]).strip().lower()
                if k in seen: err("duplicate: %r" % o["h"][:60])
                seen.add(k)
    total = sum(counts.values())
    print("Lines found: %d" % total)
    for k in sorted(counts): print("  %-22s %d" % (k, counts[k]))
    for k in list(TICKER) :
        if counts.get("ticker." + k, 0) == 0: warn("no extra lines for ticker.%s" % k)
    if data is not None and counts.get("breaking.random", 0) < 100: warn("breaking.random has fewer than 100 extra lines")
    if data is not None and total:
        pool = []
        for key, lines in (data.get("ticker") or {}).items():
            pool += [("ticker." + key, s) for s in lines if isinstance(s, str)]
        for key, items in (data.get("breaking") or {}).items():
            pool += [("breaking." + key, "%s -- %s" % (o.get("h"), o.get("s"))) for o in items if isinstance(o, dict)]
        print("\nRandom sample:")
        for k, s in random.sample(pool, min(6, len(pool))): print("  [%s] %s" % (k, s))
    for w in warns: print("WARN ", w)
    for e in errors: print("ERROR", e)
    print("\n%s" % ("FAILED: %d error(s)" % len(errors) if errors else "OK"))
    sys.exit(1 if errors else 0)

if __name__ == "__main__":
    main()
