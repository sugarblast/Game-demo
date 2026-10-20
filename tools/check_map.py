#!/usr/bin/env python3
"""Checks assets/map/world.js (made by tools/build_map.py). Prints OK, or a list of problems.

    python tools/check_map.py [path/to/world.js]
"""
import json, os, re, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
REGIONS = ('usa can mex cam col bra and sco grl isl gbr ibe fra ger ita eeu sca rus tur mea irn cas pak ind chn mon kor jpn sea '
           'idn phl aus nzl mgh lby egy sud sah waf cen eaf hrn saf zaf mdg').split()
MAX_KB = 1500


def main():
    path = sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, 'assets', 'map', 'world.js')
    if not os.path.exists(path):
        sys.exit('PROBLEM: %s not found' % path)
    text = open(path, encoding='utf-8').read()
    kb = len(text.encode('utf-8')) / 1024
    m = re.search(r'window\.OUTBREAK_MAP\s*=\s*(.*?);?\s*$', text, re.S)
    if not m:
        sys.exit('PROBLEM: no "window.OUTBREAK_MAP = ..." assignment found')
    body = m.group(1).strip()
    if body in ('null', ''):
        print('Stub only (window.OUTBREAK_MAP = null): the game uses its built-in shapes. Run  python tools/build_map.py  for real borders.')
        return
    try:
        data = json.loads(body)
    except ValueError as e:
        sys.exit('PROBLEM: the data is not valid JSON (%s)' % e)

    problems, warnings = [], []
    countries = data.get('countries')
    if not isinstance(countries, list) or not countries:
        sys.exit('PROBLEM: "countries" is missing or empty')
    per_region, points = {}, 0
    for i, c in enumerate(countries):
        where = 'countries[%d] (%s)' % (i, c.get('n') if isinstance(c, dict) else '?')
        if not isinstance(c, dict) or c.get('r') not in REGIONS:
            problems.append('%s: unknown region id %r' % (where, c.get('r') if isinstance(c, dict) else c))
            continue
        polys = c.get('p')
        if not isinstance(polys, list) or not polys:
            problems.append('%s: no polygons' % where)
            continue
        per_region.setdefault(c['r'], 0)
        for pl in polys:
            if not isinstance(pl, list) or not pl:
                problems.append('%s: empty polygon' % where)
                continue
            per_region[c['r']] += 1
            for ring in pl:
                if not isinstance(ring, list) or len(ring) < 3:
                    problems.append('%s: ring with fewer than 3 points' % where)
                    continue
                points += len(ring)
                for pt in ring:
                    if (not isinstance(pt, list) or len(pt) != 2 or not all(isinstance(v, (int, float)) for v in pt)
                            or abs(pt[0]) > 180.5 or abs(pt[1]) > 90.5):
                        problems.append('%s: bad coordinate %r' % (where, pt))
                        break
    missing = [r for r in REGIONS if r not in per_region]
    if missing:
        warnings.append('no shapes for %s (the game keeps its built-in shape for these)' % ', '.join(missing))
    if kb > MAX_KB:
        problems.append('file is %.0f KB, over the %d KB limit: rebuild with a larger --tol or --res 110' % (kb, MAX_KB))
    if points > 60000:
        warnings.append('%d points is a lot; the map may feel slow on old phones (try --tol 0.08)' % points)

    print('%d countries in %d of 45 regions, %d points, %.0f KB, detail %s' % (len(countries), len(per_region), points, kb, data.get('res', '?')))
    for w in warnings:
        print('WARNING:', w)
    if problems:
        for p in problems[:30]:
            print('PROBLEM:', p)
        sys.exit(1)
    print('OK')


if __name__ == '__main__':
    main()
