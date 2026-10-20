// Tests the real-map pipeline with a stand-in Natural Earth file (no internet needed):
//   fixture -> tools/build_map.py -> tools/check_map.py -> loaded by the game in Chromium (if Playwright is installed).
// Usage: node test/maptest.js [screenshot-dir]
const fs = require('fs'), path = require('path'), os = require('os'), cp = require('child_process');
const ROOT = path.resolve(__dirname, '..'), TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'op-map-')), SHOTS = process.argv[2] || TMP;
let pass = 0, fail = 0;
const ok = (c, m, extra) => { if (c) pass++; else { fail++; process.exitCode = 1; } console.log((c ? 'PASS ' : 'FAIL ') + m + (extra !== undefined ? '  ' + JSON.stringify(extra) : '')); };
const read = f => fs.readFileSync(path.join(ROOT, 'src', f), 'utf8');
const G = new Function(read('data.js') + '; return {REGIONS, REGION_INDEX};')();
const { REGIONS } = G;
const PY = ['python3', 'python'].find(p => { try { cp.execSync(p + ' --version', { stdio: 'ignore' }); return true; } catch (e) { return false; } });
const py = args => cp.spawnSync(PY, args, { encoding: 'utf8', cwd: ROOT });

// ---- static checks on the build script's tables ----
const bm = fs.readFileSync(path.join(ROOT, 'tools/build_map.py'), 'utf8');
{
  const ids = REGIONS.map(r => r.id);
  const table = {}; for (const m of bm.matchAll(/^\s+'(\w+)':\s+'([A-Z ]+)',?$/gm)) table[m[1]] = m[2].split(/\s+/);
  ok(ids.every(id => table[id] && table[id].length), 'every one of the 45 regions has countries in the build script', ids.filter(id => !table[id]));
  const seen = {}, dup = []; for (const id in table) for (const c of table[id]) { if (seen[c] && seen[c] !== id) dup.push(c); seen[c] = id; }
  ok(dup.length === 0, 'no country code is assigned to two regions', dup);
  const centers = {}; for (const m of bm.matchAll(/'(\w+)':\s*\((-?[\d.]+),\s*(-?[\d.]+)\)/g)) centers[m[1]] = [+m[2], +m[3]];
  const bad = REGIONS.filter(r => !centers[r.id] || centers[r.id][0] !== r.c[0] || centers[r.id][1] !== r.c[1]).map(r => r.id);
  ok(bad.length === 0, 'region centres in build_map.py match src/data.js', bad);
  // a few well-known assignments
  const where = c => Object.keys(table).find(id => table[id].includes(c));
  ok(where('DEU') === 'ger' && where('JPN') === 'jpn' && where('NGA') === 'waf' && where('SSD') === 'sud' && where('SDS') === 'sud' && where('PSX') === 'mea' && where('KOS') === 'eeu' && where('TWN') === 'chn', 'spot-check of country assignments');
}

// ---- fixture: a Natural-Earth-shaped GeoJSON built from the hand-drawn shapes ----
const CODES = {}; for (const m of bm.matchAll(/^\s+'(\w+)':\s+'([A-Z ]+)',?$/gm)) CODES[m[1]] = m[2].split(/\s+/);
const sq = (x, y, r) => [[x - r, y - r], [x + r, y - r], [x + r, y + r], [x - r, y + r], [x - r, y - r]];
const close = ring => ring.concat([ring[0]]);
function dense(ring, n, amp) { // subdivide every edge into n points with a little noise, like a real coastline
  const out = []; let s = 12345; const rnd = () => (s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296 - 0.5;
  for (let i = 0; i < ring.length; i++) { const a = ring[i], b = ring[(i + 1) % ring.length]; for (let k = 0; k < n; k++) { const t = k / n; out.push([a[0] + (b[0] - a[0]) * t + (k ? rnd() * amp : 0), a[1] + (b[1] - a[1]) * t + (k ? rnd() * amp : 0)]); } }
  return out;
}
function fixture(opts) {
  const feats = [];
  for (const r of REGIONS) {
    const codes = CODES[r.id], rings = r.polys.map(p => close(opts.dense ? dense(p, 110, 0.16) : p));
    const lower = r.i % 2 === 1; // half the features use lowercase property names, like older Natural Earth files
    const props = (name, a3) => lower ? { name, adm0_a3: a3, iso_a3: a3 } : { NAME: name, ADMIN: name, ADM0_A3: a3, ISO_A3: a3 };
    const main = codes[0];
    const f = { type: 'Feature', properties: props(r.name, main), geometry: rings.length === 1 ? { type: 'Polygon', coordinates: [rings[0]] } : { type: 'MultiPolygon', coordinates: rings.map(x => [x]) } };
    if (main === 'FRA') { f.properties.ISO_A3 = '-99'; f.geometry = { type: 'MultiPolygon', coordinates: [[rings[0]], [close(sq(-53, 4, 1.5))], [close(sq(55.5, -21, 0.4))]] }; } // France + Guiana + Reunion
    if (main === 'ITA') f.geometry = { type: 'MultiPolygon', coordinates: [[rings[0]], [close(sq(10, 36, 0.01))]] }; // plus a tiny islet to be dropped
    if (main === 'RUS') f.geometry = { type: 'Polygon', coordinates: [rings[0], close(sq(55, 55, 2)).reverse()] }; // with a hole
    feats.push(f);
    if (codes[1]) feats.push({ type: 'Feature', properties: props(r.name + ' 2', codes[1]), geometry: { type: 'Polygon', coordinates: [close(sq(r.c[0], r.c[1], 0.8))] } }); // a second member country
  }
  feats.push({ type: 'Feature', properties: { NAME: 'Nowhere Land', ADM0_A3: 'XXX', ISO_A3: '-99' }, geometry: { type: 'Polygon', coordinates: [close(sq(134, -22, 2))] } }); // unknown: should join Australia
  feats.push({ type: 'Feature', properties: { NAME: 'Antarctica', ADM0_A3: 'ATA' }, geometry: { type: 'Polygon', coordinates: [close([[-180, -90], [180, -90], [180, -65], [-180, -65]])] } });
  return { type: 'FeatureCollection', features: feats };
}
const fx = path.join(TMP, 'fixture.geojson'), fxd = path.join(TMP, 'fixture-dense.geojson');
fs.writeFileSync(fx, JSON.stringify(fixture({}))); fs.writeFileSync(fxd, JSON.stringify(fixture({ dense: true })));

// ---- build + check ----
const out = path.join(TMP, 'world.js'), outD = path.join(TMP, 'world-dense.js');
if (!PY) { ok(false, 'python is available'); process.exit(1); }
let b = py(['tools/build_map.py', '--file', fx, '--out', out, '--res', '50']);
ok(b.status === 0 && fs.existsSync(out), 'build_map.py runs on the stand-in file', b.status ? b.stderr || b.stdout : undefined);
const text = fs.readFileSync(out, 'utf8'), M = JSON.parse(text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1));
const regionOf = n => (M.countries.find(c => c.n === n) || {}).r;
ok(M.countries.length >= 45, 'countries written', M.countries.length);
ok(new Set(M.countries.map(c => c.r)).size === 45, 'all 45 regions have shapes');
ok(regionOf('Nowhere Land') === 'aus', 'a country missing from the table is attached to the nearest region', regionOf('Nowhere Land'));
ok(!M.countries.some(c => /Antarctica/.test(c.n)), 'Antarctica is left out');
const fra = M.countries.filter(c => /France/.test(c.n));
ok(fra.some(c => c.r === 'fra') && fra.some(c => c.r === 'col') && fra.some(c => c.r === 'mdg'), 'France overseas parts go to their neighbours (Guiana to col, Reunion to mdg)', fra.map(c => c.r));
const frMain = fra.find(c => c.r === 'fra'); ok(frMain && frMain.p.length === 1, 'France itself keeps only its European piece');
const ita = M.countries.find(c => c.n === 'Italy'); ok(ita && ita.p.length === 1, 'tiny islet is dropped but the main piece stays', ita && ita.p.length);
const rus = M.countries.find(c => c.n === 'Russia'); ok(rus && rus.p[0].length === 2, 'holes (lakes) are kept as extra rings', rus && rus.p[0].length);
ok(M.countries.every(c => c.p.every(pl => pl.every(r => r.every(pt => pt.length === 2 && Math.abs(pt[0]) <= 180 && Math.abs(pt[1]) <= 90)))), 'all coordinates are valid');
ok(/^[-\d.]+$/.test(String(M.countries[0].p[0][0][0][0])) && !/\.\d{3,}/.test(JSON.stringify(M.countries[0].p)), 'coordinates are rounded to 2 decimals');
let c = py(['tools/check_map.py', out]); ok(c.status === 0 && /OK/.test(c.stdout), 'check_map.py says OK', c.stdout.trim().split('\n').pop());
// dense file: size and point count come down after simplification
b = py(['tools/build_map.py', '--file', fxd, '--out', outD, '--res', '50']);
const rawPts = JSON.parse(fs.readFileSync(fxd, 'utf8')).features.reduce((a, f) => a + JSON.stringify(f.geometry).split('],[').length, 0);
const dtext = fs.readFileSync(outD, 'utf8'), dM = JSON.parse(dtext.slice(dtext.indexOf('{'), dtext.lastIndexOf('}') + 1)), dPts = dM.countries.reduce((a, c) => a + c.p.reduce((a2, pl) => a2 + pl.reduce((a3, r) => a3 + r.length, 0), 0), 0);
ok(b.status === 0 && dPts < rawPts * 0.75 && dPts > 3000, 'simplification cuts a dense file down', { raw: rawPts, kept: dPts, kb: Math.round(dtext.length / 1024) });
c = py(['tools/check_map.py', outD]); ok(c.status === 0, 'check_map.py accepts the simplified dense file');
const outH = path.join(TMP, 'world-huge.js'); b = py(['tools/build_map.py', '--file', fxd, '--out', outH, '--res', '50', '--tol', '0']);
const htext = fs.readFileSync(outH, 'utf8'), hPts = JSON.parse(htext.slice(htext.indexOf('{'), htext.lastIndexOf('}') + 1)).countries.reduce((a, c) => a + c.p.reduce((a2, pl) => a2 + pl.reduce((a3, r) => a3 + r.length, 0), 0), 0);
// checker catches broken files
const badFile = path.join(TMP, 'bad.js');
fs.writeFileSync(badFile, 'window.OUTBREAK_MAP = ' + JSON.stringify({ countries: [{ n: 'x', r: 'zzz', p: [[[[1, 2], [3, 4], [5, 6]]]] }, { n: 'y', r: 'usa', p: [[[[1, 2], [999, 4], [5, 6]]]] }] }) + ';');
c = py(['tools/check_map.py', badFile]); ok(c.status !== 0 && /unknown region|bad coordinate/.test(c.stdout), 'check_map.py flags unknown regions and bad coordinates');
fs.writeFileSync(badFile, 'window.OUTBREAK_MAP = {not json};'); c = py(['tools/check_map.py', badFile]); ok(c.status !== 0, 'check_map.py flags invalid JSON');
fs.writeFileSync(badFile, 'window.OUTBREAK_MAP = null;'); c = py(['tools/check_map.py', badFile]); ok(c.status === 0 && /Stub/.test(c.stdout), 'check_map.py accepts the stub');

// ---- in the browser ----
(async () => {
  let pw = null; try { pw = require('/opt/npm-tools/node_modules/playwright'); } catch (e) { try { pw = require('playwright'); } catch (e2) {} }
  if (!pw) { console.log('SKIP browser checks (Playwright not installed)'); return done(); }
  const site = path.join(TMP, 'site'); fs.mkdirSync(path.join(site, 'assets/map'), { recursive: true }); fs.mkdirSync(path.join(site, 'assets/audio'), { recursive: true }); fs.mkdirSync(path.join(site, 'assets/content'), { recursive: true });
  fs.copyFileSync(path.join(ROOT, 'index.html'), path.join(site, 'index.html'));
  for (const f of ['assets/audio/manifest.js', 'assets/content/extra.js']) fs.copyFileSync(path.join(ROOT, f), path.join(site, f));
  const browser = await pw.chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  async function open(worldJs, shot) {
    fs.writeFileSync(path.join(site, 'assets/map/world.js'), worldJs);
    const page = await browser.newPage({ viewport: { width: 1280, height: 780 } }), errs = [];
    page.on('pageerror', e => errs.push(e.message)); page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
    await page.goto('file://' + path.join(site, 'index.html')); await page.waitForSelector('#goBtn');
    return { page, errs };
  }
  // 1) real shapes load and play
  let { page, errs } = await open(text);
  let info = await page.evaluate(() => ({ real: REGIONS.filter(r => r.countries).length, countries: REGIONS.reduce((a, r) => a + (r.countries ? r.countries.length : 0), 0), ruRings: REGIONS[REGION_INDEX.rus].polys.length, fraC: REGIONS[REGION_INDEX.fra].countries.map(c => c.n) }));
  ok(info.real === 45 && info.countries >= 45, 'game loads real shapes for all 45 regions', info);
  await page.selectOption('#pStart', 'rus'); await page.click('#goBtn'); await page.waitForTimeout(300);
  await page.evaluate(() => { const g = window.__game; g.st.pts = 200; ['cough', 'sneeze', 'air', 'water', 'cold1', 'cold2'].forEach(id => buyUpgrade(g.st, id)); for (let i = 0; i < 120; i++) { g.step(); if (g.st.brk) g.closeBreak(); } g.setSpeed(0); });
  await page.waitForTimeout(300);
  const t0 = await page.evaluate(() => { const t = performance.now(); for (let i = 0; i < 30; i++) { MapView.draw(window.__game.st); document.getElementById('map').getContext('2d').getImageData(0, 0, 1, 1); } return (performance.now() - t) / 30; });
  ok(t0 < 25, 'a frame draws quickly with real shapes', Math.round(t0 * 10) / 10 + ' ms');
  const box = await page.locator('#map').boundingBox();
  const hit = await page.evaluate(() => { const [x, y] = MapView.toScreen(103, 34); return MapView.hitTest(x, y); }); // middle of China
  ok(hit === (await page.evaluate(() => REGION_INDEX.chn)), 'clicking a country finds the right region', hit);
  const [gx, gy] = await page.evaluate(() => MapView.toScreen(2.5, 47)); // France
  await page.mouse.move(box.x + gx, box.y + gy); await page.waitForTimeout(250);
  ok(/France/.test(await page.locator('#tip').innerText()), 'hover tooltip names the region under the cursor');
  const bub = await page.evaluate(() => { const g = window.__game; return g.st.bubbles.length ? MapView.bubbleXY(g.st.bubbles[0]) : null; });
  ok(!bub || (bub[0] > 0 && bub[0] < 1280 && bub[1] > 50 && bub[1] < 740), 'DNA bubbles still appear on the map', bub);
  await page.screenshot({ path: path.join(SHOTS, '30-real-map-fixture.png') });
  ok(errs.length === 0, 'no errors with real shapes loaded', errs);
  await page.close();
  // 2) dense (realistic point count) data
  ({ page, errs } = await open(dtext));
  await page.selectOption('#pStart', 'ind'); await page.click('#goBtn'); await page.waitForTimeout(300);
  await page.evaluate(() => { const g = window.__game; g.st.pts = 300; ['cough', 'sneeze', 'air', 'water'].forEach(id => buyUpgrade(g.st, id)); for (let i = 0; i < 150; i++) { g.step(); if (g.st.brk) g.closeBreak(); } g.setSpeed(0); });
  const t1 = await page.evaluate(() => { const t = performance.now(); for (let i = 0; i < 30; i++) { MapView.draw(window.__game.st); document.getElementById('map').getContext('2d').getImageData(0, 0, 1, 1); } return (performance.now() - t) / 30; });
  ok(t1 < 40, 'dense data (' + dPts + ' points) still draws fast', Math.round(t1 * 10) / 10 + ' ms per frame');
  await page.screenshot({ path: path.join(SHOTS, '31-real-map-dense.png') }); await page.close();
  ({ page, errs } = await open(htext));
  await page.selectOption('#pStart', 'ind'); await page.click('#goBtn'); await page.waitForTimeout(300);
  await page.evaluate(() => { const g = window.__game; g.st.pts = 300; ['cough', 'sneeze', 'air', 'water'].forEach(id => buyUpgrade(g.st, id)); for (let i = 0; i < 150; i++) { g.step(); if (g.st.brk) g.closeBreak(); } g.setSpeed(0); });
  const t2 = await page.evaluate(() => { const t = performance.now(); for (let i = 0; i < 20; i++) { MapView.draw(window.__game.st); document.getElementById('map').getContext('2d').getImageData(0, 0, 1, 1); } return (performance.now() - t) / 20; });
  ok(t2 < 60, 'worst case, unsimplified (' + hPts + ' points) still draws acceptably', Math.round(t2 * 10) / 10 + ' ms per frame');
  const hov = await page.evaluate(() => { const t = performance.now(); for (let i = 0; i < 50; i++) MapView.hitTest(500 + i, 300); return (performance.now() - t) / 50; });
  ok(hov < 5, 'hover hit-testing stays cheap on the huge map', Math.round(hov * 100) / 100 + ' ms');
  await page.close();
  // 3) broken or odd files must never break the game: it falls back to the hand-drawn shapes
  const cases = {
    'stub (null)': 'window.OUTBREAK_MAP = null;',
    'countries is not a list': 'window.OUTBREAK_MAP = { countries: 5 };',
    'garbage coordinates': 'window.OUTBREAK_MAP = { countries: [{ n: "x", r: "usa", p: [[[["a", "b"], [1, 2], [3, 4]]]] }, { n: "y", r: "nope", p: [] }, null, 7] };',
    'syntax error': 'window.OUTBREAK_MAP = {{{',
    'file missing content': '',
  };
  for (const name in cases) {
    ({ page, errs } = await open(cases[name]));
    const r = await page.evaluate(() => ({ real: REGIONS.filter(x => x.countries).length, polys: REGIONS[0].polys.length }));
    await page.click('#goBtn'); await page.waitForTimeout(250);
    const day = await page.evaluate(() => { window.__game.step(); return window.__game.st.day; });
    ok(r.real === 0 && r.polys > 0 && day === 1, 'falls back to the built-in map and still plays: ' + name, r);
    await page.close();
  }
  // 4) partial file: one good region, the rest keep their built-in shape
  ({ page, errs } = await open('window.OUTBREAK_MAP = { countries: [{ n: "Testland", r: "jpn", p: [[[[130,31],[140,31],[140,40],[130,40]]]] }] };'));
  const part = await page.evaluate(() => ({ jpn: !!REGIONS[REGION_INDEX.jpn].countries, usa: !!REGIONS[REGION_INDEX.usa].countries, usaPolys: REGIONS[REGION_INDEX.usa].polys.length }));
  ok(part.jpn && !part.usa && part.usaPolys > 0, 'a partial file only replaces the regions it covers', part);
  await page.close();
  await browser.close(); done();
})();
function done() { console.log(fail ? 'map tests: ' + fail + ' FAILED, ' + pass + ' passed' : 'map tests: all ' + pass + ' passed'); }
