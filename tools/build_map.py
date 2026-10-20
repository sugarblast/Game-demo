#!/usr/bin/env python3
"""
Builds assets/map/world.js: real country borders, grouped into the game's 45 regions.

Run from the project folder (needs internet once, Python 3.7+, nothing to install):

    python tools/build_map.py

Then open index.html. The game picks the file up by itself. To go back to the built-in shapes, delete the contents of
assets/map/world.js and put back the one-line stub (see assets/map/README.md).

Options:
    --res 50|110     Natural Earth detail. 50 (default) looks best, 110 is smaller and blockier.
    --tol 0.06       simplification in degrees (bigger = smaller file, rougher coastlines)
    --file PATH      use a GeoJSON file you downloaded yourself instead of downloading
    --out PATH       output file (default assets/map/world.js)

Data: Natural Earth (naturalearthdata.com), public domain. No credit needed, but it is nice to give one.
"""
import argparse, json, math, os, sys, urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)

SOURCES = {
    '50': [
        'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_50m_admin_0_countries.geojson',
        'https://cdn.jsdelivr.net/gh/nvkelso/natural-earth-vector@master/geojson/ne_50m_admin_0_countries.geojson',
        'https://github.com/nvkelso/natural-earth-vector/raw/master/geojson/ne_50m_admin_0_countries.geojson',
    ],
    '110': [
        'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_110m_admin_0_countries.geojson',
        'https://cdn.jsdelivr.net/gh/nvkelso/natural-earth-vector@master/geojson/ne_110m_admin_0_countries.geojson',
        'https://raw.githubusercontent.com/johan/world.geo.json/master/countries.geo.json',
        'https://cdn.jsdelivr.net/gh/johan/world.geo.json@master/countries.geo.json',
    ],
}

# Which countries belong to which game region. Codes are ISO 3166 alpha-3 plus the few Natural Earth uses
# instead (SDS South Sudan, PSX Palestine, SAH Western Sahara, KOS Kosovo, SOL Somaliland, CYN Northern Cyprus).
# Anything not listed here is attached to the nearest region (the script prints what it did).
REGION_COUNTRIES = {
    'usa': 'USA',
    'can': 'CAN',
    'mex': 'MEX',
    'cam': 'GTM BLZ HND SLV NIC CRI PAN CUB JAM HTI DOM BHS PRI TTO BRB ATG DMA GRD LCA VCT KNA ABW CUW SXM CYM TCA VGB VIR AIA BMU MSR BLM MAF',
    'col': 'COL VEN GUY SUR',
    'bra': 'BRA',
    'and': 'PER ECU BOL PRY',
    'sco': 'ARG CHL URY FLK',
    'grl': 'GRL',
    'isl': 'ISL',
    'gbr': 'GBR IRL IMN JEY GGY',
    'ibe': 'ESP PRT AND GIB',
    'fra': 'FRA MCO',
    'ger': 'DEU NLD BEL LUX CHE AUT LIE',
    'ita': 'ITA SMR VAT MLT',
    'eeu': 'POL CZE SVK HUN ROU BGR UKR BLR MDA SRB HRV SVN BIH MNE MKD ALB KOS XKX GRC EST LVA LTU',
    'sca': 'SWE NOR FIN DNK SJM',
    'rus': 'RUS',
    'tur': 'TUR GEO ARM AZE CYP CYN',
    'mea': 'SAU YEM OMN ARE QAT KWT BHR IRQ SYR JOR LBN ISR PSE PSX',
    'irn': 'IRN',
    'cas': 'KAZ UZB TKM KGZ TJK',
    'pak': 'PAK AFG',
    'ind': 'IND BGD NPL BTN LKA MDV',
    'chn': 'CHN TWN HKG MAC',
    'mon': 'MNG',
    'kor': 'KOR PRK',
    'jpn': 'JPN',
    'sea': 'MMR THA LAO KHM VNM MYS SGP BRN',
    'idn': 'IDN TLS PNG',
    'phl': 'PHL',
    'aus': 'AUS FJI SLB VUT NCL',
    'nzl': 'NZL',
    'mgh': 'MAR DZA TUN ESH SAH',
    'lby': 'LBY',
    'egy': 'EGY',
    'sud': 'SDN SSD SDS',
    'sah': 'MRT MLI NER TCD BFA',
    'waf': 'NGA GHA CIV SEN GIN BEN TGO SLE LBR GNB GMB CPV',
    'cen': 'COD COG GAB GNQ CMR CAF STP',
    'eaf': 'KEN TZA UGA RWA BDI',
    'hrn': 'ETH ERI DJI SOM SOL',
    'saf': 'AGO ZMB ZWE MWI MOZ NAM BWA',
    'zaf': 'ZAF LSO SWZ',
    'mdg': 'MDG MUS COM SYC REU MYT',
}
CODE_TO_REGION = {code: rid for rid, codes in REGION_COUNTRIES.items() for code in codes.split()}

# Region centres [lon, lat]. Must match src/data.js (test/maptest.js checks that). Used for the nearest-region fallback.
CENTERS = {
    'usa': (-98, 39), 'can': (-100, 58), 'mex': (-102, 23), 'cam': (-86, 13), 'col': (-70, 6), 'bra': (-52, -12),
    'and': (-70, -12), 'sco': (-66, -35), 'grl': (-42, 72), 'isl': (-19, 64.8), 'gbr': (-1.5, 52.5), 'ibe': (-4, 40),
    'fra': (2.5, 47), 'ger': (9, 51), 'ita': (12.5, 42.5), 'eeu': (24, 49), 'sca': (15, 63), 'rus': (60, 60),
    'tur': (35, 39), 'mea': (45, 26), 'irn': (53, 32), 'cas': (65, 44), 'pak': (69, 31), 'ind': (79, 23),
    'chn': (103, 34), 'mon': (103, 47), 'kor': (127, 37), 'jpn': (138, 36), 'sea': (102, 16), 'idn': (110, -5),
    'phl': (122, 13), 'aus': (134, -25), 'nzl': (174, -39), 'mgh': (3, 30), 'lby': (17, 27), 'egy': (30, 26),
    'sud': (30, 14), 'sah': (2, 17), 'waf': (3, 8), 'cen': (20, 2), 'eaf': (36, -1), 'hrn': (41, 8),
    'saf': (26, -15), 'zaf': (25, -30), 'mdg': (47, -19),
}

SKIP = {'ATA', 'ATF', 'HMD', 'SGS'}  # Antarctica and sub-Antarctic specks: the map stops at 60 degrees south


# ---------- small geometry helpers ----------
def ring_area(r):
    a = 0.0
    for i in range(len(r)):
        x1, y1 = r[i]
        x2, y2 = r[(i + 1) % len(r)]
        a += x1 * y2 - x2 * y1
    return abs(a) / 2.0


def ring_centroid(r):
    n = len(r)
    return (sum(p[0] for p in r) / n, sum(p[1] for p in r) / n)


def dist(a, b):
    # degrees, with longitude squeezed toward the poles so Siberia is not "far" from itself
    dx = abs(a[0] - b[0])
    dx = min(dx, 360 - dx) * math.cos(math.radians((a[1] + b[1]) / 2))
    return math.hypot(dx, a[1] - b[1])


def nearest_region(pt, exclude=None):
    best, bd = None, 1e9
    for rid, c in CENTERS.items():
        if rid == exclude:
            continue
        d = dist(pt, c)
        if d < bd:
            best, bd = rid, d
    return best


def simplify(pts, tol):
    """Douglas-Peucker, iterative (no recursion limit trouble)."""
    if tol <= 0 or len(pts) < 4:
        return pts
    keep = [False] * len(pts)
    keep[0] = keep[-1] = True
    stack = [(0, len(pts) - 1)]
    while stack:
        a, b = stack.pop()
        ax, ay = pts[a]
        bx, by = pts[b]
        dx, dy = bx - ax, by - ay
        L = dx * dx + dy * dy
        best, bi = -1.0, -1
        for i in range(a + 1, b):
            px, py = pts[i]
            if L == 0:
                d = math.hypot(px - ax, py - ay)
            else:
                t = max(0.0, min(1.0, ((px - ax) * dx + (py - ay) * dy) / L))
                d = math.hypot(px - (ax + t * dx), py - (ay + t * dy))
            if d > best:
                best, bi = d, i
        if best > tol:
            keep[bi] = True
            stack.append((a, bi))
            stack.append((bi, b))
    return [p for p, k in zip(pts, keep) if k]


def clean_ring(coords, tol):
    pts = [(float(c[0]), float(c[1])) for c in coords]
    if len(pts) > 1 and pts[0] == pts[-1]:
        pts.pop()  # GeoJSON repeats the first point at the end
    if len(pts) < 3:
        return None
    # Douglas-Peucker needs an open line: anchor it on the two points furthest apart
    out = simplify(pts + [pts[0]], tol)[:-1]
    out = [(round(x, 2), round(y, 2)) for x, y in out]
    dedup = [out[0]]
    for p in out[1:]:
        if p != dedup[-1]:
            dedup.append(p)
    if len(dedup) > 1 and dedup[0] == dedup[-1]:
        dedup.pop()
    return dedup if len(dedup) >= 3 else None


# ---------- reading the data ----------
def download(urls):
    errors = []
    for url in urls:
        try:
            print('Downloading', url)
            req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0 (outbreak-protocol map builder)'})
            with urllib.request.urlopen(req, timeout=90) as r:
                raw = r.read()
            data = json.loads(raw.decode('utf-8'))
            if data.get('features'):
                print('  got %.1f MB, %d features' % (len(raw) / 1e6, len(data['features'])))
                return data
            errors.append(url + ': no features in file')
        except Exception as e:  # network, SSL, JSON...
            errors.append('%s: %s' % (url, e))
            print('  failed:', e)
    msg = ['', 'Could not download the map data automatically:'] + ['  ' + e for e in errors] + [
        '',
        'Do this instead: open the first link above in your browser, press Ctrl+S (Cmd+S on a Mac) to save the page',
        'as a .geojson file (Downloads is fine), then run:',
        '    python tools/build_map.py --file "C:/path/to/ne_%sm_admin_0_countries.geojson"' % ARGS.res,
        '(On a Mac, if you see CERTIFICATE_VERIFY_FAILED, run "Install Certificates.command" from your Python folder once.)',
    ]
    sys.exit('\n'.join(msg))


def props_of(feature):
    p = {str(k).lower(): v for k, v in (feature.get('properties') or {}).items()}
    if feature.get('id') is not None:
        p.setdefault('id', feature.get('id'))
    return p


def pick_code(p):
    """First usable code that we know. Natural Earth sometimes has -99 as ISO_A3, so try several fields."""
    for key in ('adm0_a3', 'iso_a3', 'iso_a3_eh', 'su_a3', 'gu_a3', 'sov_a3', 'id'):
        v = p.get(key)
        if isinstance(v, str) and v.upper() in CODE_TO_REGION:
            return v.upper()
    return None


def polygons_of(geom):
    if not geom:
        return []
    if geom['type'] == 'Polygon':
        return [geom['coordinates']]
    if geom['type'] == 'MultiPolygon':
        return geom['coordinates']
    return []


def build(data, tol, min_area):
    countries = []          # {n, r, p}
    notes = []              # human-readable report lines
    for f in data['features']:
        p = props_of(f)
        name = str(p.get('name') or p.get('admin') or p.get('name_long') or p.get('sovereignt') or '?')
        a3 = str(p.get('adm0_a3') or p.get('iso_a3') or p.get('id') or '').upper()
        if a3 in SKIP:
            continue
        polys = [pl for pl in polygons_of(f.get('geometry')) if pl and pl[0] and len(pl[0]) >= 3]
        if not polys:
            continue
        code = pick_code(p)
        home = CODE_TO_REGION.get(code) if code else None
        # biggest piece decides where an unknown country goes
        big = max(polys, key=lambda pl: ring_area(pl[0]))
        if home is None:
            home = nearest_region(ring_centroid(big[0]))
            notes.append('  %-32s not in the table, attached to %s' % (name + ' (' + a3 + ')', home))
        buckets = {}
        for pl in polys:
            region = home
            if code == 'FRA':  # France includes its overseas departments in this data set: send them to their neighbours
                cx, cy = ring_centroid(pl[0])
                if not (-12 < cx < 12 and 40 < cy < 52):
                    region = 'col' if (-62 < cx < -50 and cy < 8) else nearest_region((cx, cy), exclude='fra')
                    notes.append('  France overseas part at (%.0f, %.0f) goes to %s' % (cx, cy, region))
            elif ring_area(pl[0]) < 1e-9:
                continue
            buckets.setdefault(region, []).append(pl)
        for region, pls in buckets.items():
            kept = []
            areas = [ring_area(pl[0]) for pl in pls]
            biggest = max(areas)
            for pl, ar in zip(pls, areas):
                if ar < min_area and ar < biggest:
                    continue  # tiny island: drop (but never drop a country's main piece)
                rings = []
                for k, ring in enumerate(pl):
                    r = clean_ring(ring, tol)
                    if r is None:
                        if k == 0:
                            rings = []
                            break
                        continue
                    if k > 0 and ring_area(r) < min_area:
                        continue  # tiny lake or hole
                    rings.append([[x, y] for x, y in r])
                if rings:
                    kept.append(rings)
            if kept:
                countries.append({'n': name, 'r': region, 'p': kept})
    return countries, notes


def point_in_ring(x, y, ring):
    c = False
    j = len(ring) - 1
    for i in range(len(ring)):
        a, b = ring[i], ring[j]
        if (a[1] > y) != (b[1] > y) and x < (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]) + a[0]:
            c = not c
        j = i
    return c


def main():
    global ARGS
    ap = argparse.ArgumentParser(description='Build assets/map/world.js from Natural Earth country borders.')
    ap.add_argument('--res', choices=['50', '110'], default='50')
    ap.add_argument('--tol', type=float, default=None)
    ap.add_argument('--file')
    ap.add_argument('--out', default=os.path.join(ROOT, 'assets', 'map', 'world.js'))
    ARGS = ap.parse_args()
    tol = ARGS.tol if ARGS.tol is not None else (0.06 if ARGS.res == '50' else 0.02)
    min_area = 0.04 if ARGS.res == '50' else 0.0

    if ARGS.file:
        with open(ARGS.file, encoding='utf-8') as fh:
            data = json.load(fh)
        print('Read', ARGS.file)
    else:
        data = download(SOURCES[ARGS.res])

    countries, notes = build(data, tol, min_area)
    by_region = {}
    for c in countries:
        by_region.setdefault(c['r'], []).append(c)

    missing = [rid for rid in CENTERS if rid not in by_region]
    pts = sum(len(r) for c in countries for pl in c['p'] for r in pl)

    out = {'v': 1, 'res': ARGS.res + 'm', 'src': 'Natural Earth (public domain), simplified', 'countries': countries}
    text = '// Real country borders, made by tools/build_map.py from Natural Earth (public domain). Do not edit by hand.\n' \
           'window.OUTBREAK_MAP = ' + json.dumps(out, separators=(',', ':')) + ';\n'
    os.makedirs(os.path.dirname(ARGS.out), exist_ok=True)
    with open(ARGS.out, 'w', encoding='utf-8') as fh:
        fh.write(text)

    print()
    print('Wrote %s  (%.0f KB, %d countries, %d points)' % (ARGS.out, len(text.encode('utf-8')) / 1024, len(countries), pts))
    if notes:
        print('\nNotes (%d):' % len(notes))
        for n in notes[:40]:
            print(n)
        if len(notes) > 40:
            print('  ... and %d more' % (len(notes) - 40))
    if missing:
        print('\nWARNING: no shapes for these regions, the game keeps its built-in shapes there:', ', '.join(missing))
    # sanity: each region marker should sit on land
    off = []
    for rid, (cx, cy) in CENTERS.items():
        rings = [pl[0] for c in by_region.get(rid, []) for pl in c['p']]
        if rings and not any(point_in_ring(cx, cy, r) for r in rings):
            off.append(rid)
    if off:
        print('\nFor %s the old marker position is not on the new land; the game moves it automatically.' % ', '.join(off))
    print('\nDone. Open index.html and check the map. Run  python tools/check_map.py  for a full check.')


ARGS = None
if __name__ == '__main__':
    main()
