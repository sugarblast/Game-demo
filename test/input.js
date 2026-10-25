// Input, details-card, travel-icon and lag tests, using real mouse and touch events in headless Chromium.
// Usage: node test/input.js [path/to/index.html] [screenshot-dir]
//   (pass an older index.html to see the same lag numbers for that build; assertions on new features only run for the current build)
const { chromium } = require('/opt/npm-tools/node_modules/playwright');
const path = require('path'), fs = require('fs');
const FILE = path.resolve(process.argv[2] || path.join(__dirname, '../index.html')), OUT = process.argv[3] || '/tmp';
let pass = 0, fail = 0;
const ok = (c, m, extra) => { c ? pass++ : (fail++, process.exitCode = 1); console.log((c ? 'PASS ' : 'FAIL ') + m + (extra !== undefined ? '  ' + JSON.stringify(extra) : '')); };
const q = (a, p) => { const s = a.slice().sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(p * s.length))]; };

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--autoplay-policy=no-user-gesture-required'] });
  const errors = [];
  async function open(opts) {
    const ctx = await browser.newContext(opts || { viewport: { width: 1900, height: 950 } });
    const page = await ctx.newPage();
    await page.route('https://static.cloudflareinsights.com/**', r => r.fulfill({ status: 200, contentType: 'application/javascript', headers: { 'access-control-allow-origin': '*' }, body: '' })); // tests never touch the network (analytics beacon)
    page.on('pageerror', e => errors.push('pageerror: ' + e.message));
    page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
    await page.goto('file://' + FILE); await page.waitForSelector('#goBtn');
    await page.fill('#pSeed', '77'); await page.selectOption('#pStart', 'rus'); await page.click('#goBtn'); await page.waitForTimeout(250);
    await page.evaluate(() => { const g = window.__game; g.setSpeed(0); for (let i = 0; i < 6; i++) g.step(); g.st.bubbles = []; });
    return page;
  }
  const hasNew = async page => page.evaluate(() => !!document.getElementById('tipX'));

  // =========================================================================================================================
  const page = await open();
  const NEW = await hasNew(page);
  console.log('build under test:', FILE, NEW ? '(has the click-to-open details card)' : '(OLD build: only lag numbers are compared)');
  const box = async () => page.locator('#map').boundingBox();
  const pt = async (i, dx = 0, dy = 0) => page.evaluate(([i, dx, dy]) => { const [x, y] = MapView.toScreen(REGIONS[i].c[0], REGIONS[i].c[1]); return [x + dx, y + dy]; }, [i, dx, dy]);
  const idx = id => page.evaluate(id => REGION_INDEX[id], id);
  const tipVisible = () => page.locator('#tip').isVisible();

  if (NEW) {
    // ---- A. details card: opens on click only --------------------------------------------------------------------------
    const b = await box();
    for (const id of ['usa', 'bra', 'chn', 'aus', 'ind', 'rus']) {
      const i = await idx(id), [x, y] = await pt(i, 0, 14);
      await page.mouse.move(b.x + x, b.y + y); await page.waitForTimeout(60);
      if (!(await page.evaluate(([x, y, i]) => MapView.hitTest(x, y) === i, [x, y, i]))) continue; // pointer point must be inside that region
      ok(!(await tipVisible()), 'hover over ' + id + ': no details card');
    }
    const i0 = await idx('bra'), [bx0, by0] = await pt(i0, 0, 14);
    await page.mouse.click(b.x + bx0, b.y + by0); await page.waitForTimeout(80);
    ok(await tipVisible() && /Brazil/.test(await page.locator('#tip').innerText()), 'clicking a country opens its details card');
    ok(await page.evaluate(() => MapView.selected === REGION_INDEX.bra), 'the clicked country is selected');
    await page.mouse.click(b.x + bx0, b.y + by0); await page.waitForTimeout(80);
    ok(!(await tipVisible()), 'clicking the same country again closes the card');
    await page.mouse.click(b.x + bx0, b.y + by0); await page.waitForTimeout(60);
    await page.mouse.click(b.x + 30, b.y + 200); await page.waitForTimeout(60); // open ocean
    ok(!(await tipVisible()), 'clicking open ocean closes the card');
    await page.mouse.click(b.x + bx0, b.y + by0); await page.waitForTimeout(60);
    await page.keyboard.press('Escape'); await page.waitForTimeout(60);
    ok(!(await tipVisible()) && (await page.evaluate(() => MapView.selected)) === -1, 'Escape closes the card and deselects');
    await page.mouse.click(b.x + bx0, b.y + by0); await page.waitForTimeout(60);
    await page.locator('#tipX').click(); await page.waitForTimeout(60);
    ok(!(await tipVisible()) && (await page.evaluate(() => MapView.selected)) === -1, 'the card has a working X button');
    // the X must survive a game tick while it is being pressed (the card used to be rebuilt every tick)
    await page.mouse.click(b.x + bx0, b.y + by0); await page.waitForTimeout(60);
    const xHandle = await page.evaluate(() => { const el = document.getElementById('tipX'); window.__xEl = el; window.__game.setSpeed(0); window.__game.step(); window.__game.step(); return el === document.getElementById('tipX'); });
    ok(xHandle, 'the X button element is not rebuilt by game ticks (so a click on it can never be lost)');
    await page.keyboard.press('Escape');

    // ---- B. DNA bubbles are never hidden by the card and always clickable (45 regions x 3 screen sizes) -----------------------
    const sizes = [[1900, 950], [1280, 720], [390, 780]];
    for (const [w, h] of sizes) {
      await page.setViewportSize({ width: w, height: h }); await page.waitForTimeout(250);
      const bb = await box();
      let covered = [], missed = [], underUi = [], toggled = [], clashes = [], outs = [], n = 0;
      for (let i = 0; i < 45; i++) {
        const r = await page.evaluate(i => {
          const g = window.__game, st = g.st; st.bubbles = []; st.bubbles.push({ id: ++st.bseq, r: i, vi: 100 + i * 7, t: 0.4, born: st.day, life: 18, val: 2, gold: false });
          g.select(i); return null;
        }, i);
        await page.waitForTimeout(45); // a few frames: the card re-docks if a bubble is under it
        const info = await page.evaluate(() => {
          const st = window.__game.st, b = st.bubbles[0], [x, y] = MapView.bubbleXY(b), cr = document.getElementById('map').getBoundingClientRect();
          const tr = document.getElementById('tip').getBoundingClientRect(), on = getComputedStyle(document.getElementById('tip')).display !== 'none';
          const pad = 22, over = on && x > tr.left - cr.left - pad && x < tr.right - cr.left + pad && y > tr.top - cr.top - pad && y < tr.bottom - cr.top + pad;
          const [cw, ch] = MapView.size, inView = x > 12 && x < cw - 12 && y > 12 && y < ch - 12;
          const top = document.elementFromPoint(cr.left + x, cr.top + y);
          const hit = id => { const el = document.getElementById(id); if (!el || !on || el.offsetParent === null) return false; const r = el.getBoundingClientRect(); return !(tr.right <= r.left || tr.left >= r.right || tr.bottom <= r.top || tr.top >= r.bottom); };
          const clash = ['legend', 'zoomBtns', 'news'].find(hit) || '';
          const outside = on && (tr.left < cr.left - 1 || tr.right > cr.right + 1 || tr.top < cr.top - 1 || tr.bottom > cr.bottom + 1);
          return { x, y, over, clash, outside, inView, topId: top && (top.id || top.tagName), pts: st.pts };
        });
        if (info.clash) clashes.push(i + ':' + info.clash + '@' + (info.slot || ''));
        if (info.outside) outs.push(i);
        if (!info.inView) continue;
        n++;
        if (info.over) covered.push(i);
        if (info.topId !== 'map') underUi.push(i + ':' + info.topId);
        await page.mouse.click(bb.x + info.x, bb.y + info.y); await page.waitForTimeout(25);
        const after = await page.evaluate(() => ({ pts: window.__game.st.pts, left: window.__game.st.bubbles.length, sel: MapView.selected }));
        if (after.left !== 0 || after.pts <= info.pts) missed.push(i);
        if (after.sel !== i) toggled.push(i);
      }
      ok(n >= 40, w + 'x' + h + ': ' + n + ' of 45 test bubbles are on screen');
      ok(covered.length === 0, w + 'x' + h + ': the details card never covers a DNA bubble', covered);
      ok(clashes.length === 0 && outs.length === 0, w + 'x' + h + ': the card stays on the map and never sits on the legend, zoom buttons or news bar', { clashes, outs });
      ok(underUi.length === 0, w + 'x' + h + ': no bubble sits under a button, legend or other page element', underUi);
      ok(missed.length === 0, w + 'x' + h + ': a real mouse click collects the bubble every time (with the card open)', missed);
      ok(toggled.length === 0, w + 'x' + h + ': collecting a bubble never selects or deselects the country under it', toggled);
    }
    await page.setViewportSize({ width: 1900, height: 950 }); await page.waitForTimeout(250);
    await page.evaluate(() => { window.__game.st.bubbles = []; });

    // two bubbles close together: the click takes the nearer one
    const near = await page.evaluate(() => {
      const st = window.__game.st; st.bubbles = [];
      const mk = (vi, t) => { st.bubbles.push({ id: ++st.bseq, r: REGION_INDEX.usa, vi, t, born: st.day, life: 18, val: 2, gold: false }); return st.bubbles[st.bubbles.length - 1]; };
      const a = mk(10, 0.3), c = mk(10, 0.34); const [ax, ay] = MapView.bubbleXY(a), [cx, cy] = MapView.bubbleXY(c);
      return { a: a.id, c: c.id, ax, ay, cx, cy, hit: MapView.hitBubble(ax, ay, st) };
    });
    ok(near.hit === near.a, 'overlapping bubbles: the click takes the nearest one', near);
    await page.evaluate(() => { window.__game.st.bubbles = []; window.__game.select(-1); });

    // hover ring + hand cursor over a bubble, nothing special elsewhere
    const hb = await page.evaluate(() => { const st = window.__game.st; st.bubbles = [{ id: ++st.bseq, r: REGION_INDEX.chn, vi: 40, t: 0.3, born: st.day, life: 18, val: 2, gold: false }]; const [x, y] = MapView.bubbleXY(st.bubbles[0]); return { x, y }; });
    const bb = await box();
    await page.mouse.move(bb.x + hb.x + 5, bb.y + hb.y + 4); await page.waitForTimeout(80);
    ok(await page.evaluate(() => document.getElementById('map').style.cursor === 'pointer'), 'the cursor turns into a hand over a DNA bubble');
    await page.mouse.move(bb.x + 40, bb.y + 160); await page.waitForTimeout(80);
    ok(await page.evaluate(() => document.getElementById('map').style.cursor === ''), 'and back to normal off the bubble');
    await page.evaluate(() => { window.__game.st.bubbles = []; });

    // ---- C. things that used to be able to leave the map "stuck" ------------------------------------------------------------
    const view = () => page.evaluate(() => MapView.toScreen(0, 0).map(v => Math.round(v * 10) / 10).join(','));
    await page.evaluate(() => { MapView.zoomAt(900, 400, 3); });
    const v0 = await view(); const bc = await box();
    await page.mouse.click(bc.x + 600, bc.y + 300, { button: 'right' }); await page.waitForTimeout(40);
    await page.mouse.move(bc.x + 700, bc.y + 380); await page.mouse.move(bc.x + 900, bc.y + 500); await page.waitForTimeout(60);
    ok((await view()) === v0 && !(await page.evaluate(() => document.getElementById('map').classList.contains('drag'))), 'right-click on the map does not leave a drag stuck on');
    await page.mouse.click(bc.x + 600, bc.y + 300, { button: 'middle' }); await page.mouse.move(bc.x + 650, bc.y + 330); await page.waitForTimeout(40);
    ok((await view()) === v0, 'middle-click does not start a drag either');
    // alt-tab while holding the button
    await page.mouse.move(bc.x + 500, bc.y + 300); await page.mouse.down(); await page.mouse.move(bc.x + 540, bc.y + 330, { steps: 3 });
    ok((await view()) !== v0, 'dragging pans the map');
    await page.evaluate(() => window.dispatchEvent(new Event('blur'))); const v1 = await view();
    await page.mouse.move(bc.x + 700, bc.y + 450, { steps: 4 }); await page.waitForTimeout(40);
    ok((await view()) === v1, 'losing window focus mid-drag stops the drag (map no longer follows the mouse)');
    await page.mouse.up(); await page.waitForTimeout(40);
    // mouse-up that the page never saw: a move with no button held must end the drag
    await page.mouse.move(bc.x + 500, bc.y + 300); await page.mouse.down(); await page.mouse.move(bc.x + 520, bc.y + 310, { steps: 2 });
    await page.evaluate(() => { const c = document.getElementById('map'); c.dispatchEvent(new PointerEvent('pointermove', { pointerId: 1, pointerType: 'mouse', buttons: 0, clientX: 540, clientY: 400, bubbles: true })); });
    const v2 = await view(); await page.mouse.move(bc.x + 800, bc.y + 500, { steps: 3 }); await page.waitForTimeout(40);
    ok((await view()) === v2, 'a mouse move with no button held ends a drag that never got its mouse-up');
    await page.mouse.up();
    // pan a lot then click a bubble: click collects, no pan, no selection
    await page.evaluate(() => MapView.fit());
    // wheel: pixel mode and line mode (some browsers/mice report lines)
    const k0 = await page.evaluate(() => MapView.k);
    await page.evaluate(() => { const c = document.getElementById('map'); c.dispatchEvent(new WheelEvent('wheel', { deltaY: -100, deltaMode: 0, clientX: 900, clientY: 400, bubbles: true, cancelable: true })); });
    const k1 = await page.evaluate(() => MapView.k);
    await page.evaluate(() => { const c = document.getElementById('map'); c.dispatchEvent(new WheelEvent('wheel', { deltaY: -3, deltaMode: 1, clientX: 900, clientY: 400, bubbles: true, cancelable: true })); });
    const k2 = await page.evaluate(() => MapView.k);
    ok(k1 > k0 * 1.1, 'wheel zoom (pixel mode) works', { k0, k1 });
    ok(k2 > k1 * 1.1, 'wheel zoom (line mode, e.g. Firefox) works too', { k1, k2 });
    await page.evaluate(() => MapView.fit());

    // drag that starts on empty land does not select anything; a plain click still does
    const i1 = await idx('aus'), [ax, ay] = await pt(i1, 0, 20), b1 = await box();
    await page.mouse.move(b1.x + ax, b1.y + ay); await page.mouse.down(); await page.mouse.move(b1.x + ax + 60, b1.y + ay + 10, { steps: 4 }); await page.mouse.up(); await page.waitForTimeout(40);
    ok((await page.evaluate(() => MapView.selected)) === -1, 'dragging the map does not select a country');
    await page.evaluate(() => MapView.fit());

    // ---- touch: tap a country, tap a bubble ---------------------------------------------------------------------------------
    const tp = await open({ viewport: { width: 390, height: 780 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
    const tb = await tp.locator('#map').boundingBox();
    const ti = await tp.evaluate(() => REGION_INDEX.usa), [tx, ty] = await tp.evaluate(i => MapView.toScreen(REGIONS[i].c[0], REGIONS[i].c[1]), ti);
    await tp.touchscreen.tap(tb.x + tx, tb.y + ty + 4); await tp.waitForTimeout(120);
    ok(await tp.locator('#tip').isVisible() && /United States|USA|America/i.test(await tp.locator('#tip').innerText()), 'phone: tapping a country opens its details card');
    const tbub = await tp.evaluate(() => { const st = window.__game.st; st.bubbles = [{ id: ++st.bseq, r: REGION_INDEX.chn, vi: 30, t: 0.4, born: st.day, life: 18, val: 2, gold: false }]; const [x, y] = MapView.bubbleXY(st.bubbles[0]); return { x, y, pts: st.pts }; });
    await tp.waitForTimeout(60);
    await tp.touchscreen.tap(tb.x + tbub.x, tb.y + tbub.y); await tp.waitForTimeout(100);
    ok(await tp.evaluate(() => window.__game.st.bubbles.length === 0 && window.__game.st.pts > 0), 'phone: tapping a DNA bubble collects it');
    ok(await tp.evaluate(() => MapView.selected === REGION_INDEX.usa), 'phone: collecting a bubble leaves the selected country as it was');
    await tp.context().close();

    // ---- D. travel icons ---------------------------------------------------------------------------------------------------------
    await page.evaluate(() => { const g = window.__game; g.st.bubbles = []; g.select(-1); MapView.fit(); });
    async function iconCheck(mode, a, c) {
      await page.evaluate(([mode, a, c]) => { MapView.addFx(REGION_INDEX[a], REGION_INDEX[c], mode); }, [mode, a, c]);
      await page.waitForTimeout(330);
      return page.evaluate(() => {
        const ic = MapView.icons.slice(); if (!ic.length) return { n: 0 };
        const cv = document.getElementById('map'), ctx = cv.getContext('2d'), dpr = cv.width / cv.getBoundingClientRect().width, [x, y] = ic[0];
        const d = ctx.getImageData(Math.max(0, Math.round((x - 16) * dpr)), Math.max(0, Math.round((y - 16) * dpr)), Math.round(32 * dpr), Math.round(32 * dpr)).data;
        let white = 0, blue = 0, dark = 0;
        for (let k = 0; k < d.length; k += 4) { const r = d[k], g = d[k + 1], b = d[k + 2]; if (r > 235 && g > 235 && b > 235) white++; else if (b > 220 && g > 200 && r < 190 && r > 130) blue++; else if (r < 30 && g < 40 && b < 50 && d[k + 3] > 200) dark++; }
        return { n: ic.length, mode: ic[0][2], white, blue, dark };
      });
    }
    const air = await iconCheck('by air', 'usa', 'ind');
    ok(air.n >= 1 && air.mode === 'by air' && air.white > 60, 'air spread draws an airplane icon (a big white shape, not a 5px dot)', air);
    await page.screenshot({ path: OUT + '/input-air.png', clip: { x: 0, y: 70, width: 1900, height: 800 } });
    await page.waitForTimeout(1200);
    const sea = await iconCheck('by sea', 'chn', 'aus');
    ok(sea.n >= 1 && sea.mode === 'by sea' && sea.blue > 30, 'sea spread draws a ship icon', sea);
    await page.screenshot({ path: OUT + '/input-sea.png', clip: { x: 0, y: 70, width: 1900, height: 800 } });
    await page.waitForTimeout(1900);
    await page.evaluate(() => { MapView.addFx(REGION_INDEX.usa, REGION_INDEX.can, 'by land'); });
    await page.waitForTimeout(200);
    ok((await page.evaluate(() => MapView.icons.length)) === 0, 'land spread stays a small dot (no icon)');
  }

  // ---- E. lag: frame times while hammering the map (identical for old and new builds) ---------------------------------------
  // One measuring window: hammer the map with random moves, clicks, wheel turns and drags while the game runs, and record every frame gap.
  async function stressWindow(ms) {
    await page.evaluate(() => {
      window.__ft = []; let last = performance.now(); const loop = () => { const t = performance.now(); window.__ft.push(t - last); last = t; if (window.__run) requestAnimationFrame(loop); }; window.__run = true; requestAnimationFrame(loop);
      window.__lt = []; try { new PerformanceObserver(l => l.getEntries().forEach(e => window.__lt.push(e.duration))).observe({ entryTypes: ['longtask'] }); } catch (e) {}
    });
    const b = await page.locator('#map').boundingBox(); const t0 = Date.now(); let ev = 0;
    while (Date.now() - t0 < ms) {
      const x = b.x + 30 + Math.random() * (b.width - 60), y = b.y + 30 + Math.random() * (b.height - 60);
      await page.mouse.move(x, y, { steps: 6 }); ev += 6;
      const r = Math.random();
      if (r < 0.25) { await page.mouse.click(x, y); ev += 3; }
      else if (r < 0.45) { await page.mouse.wheel(0, Math.random() < 0.5 ? -120 : 120); ev++; }
      else if (r < 0.6) { await page.mouse.down(); await page.mouse.move(x + 70, y + 40, { steps: 6 }); await page.mouse.up(); ev += 8; }
      await page.evaluate(() => { const g = window.__game; if (g.blocked) g.closeBreak(); });
    }
    const res = await page.evaluate(() => { window.__run = false; return { ft: window.__ft.slice(2), lt: window.__lt }; });
    return { p50: q(res.ft, 0.5), p95: q(res.ft, 0.95), mx: Math.max(...res.ft), lt: res.lt.length ? Math.max(...res.lt) : 0, n: res.ft.length, ev };
  }
  // A shared 2-core test machine has the odd hiccup (the old build shows them too), so judge the MEDIAN of three windows, not one.
  async function stress(label, w, h, speed) {
    await page.setViewportSize({ width: w, height: h }); await page.waitForTimeout(300);
    await page.evaluate(sp => {
      const g = window.__game; MapView.fit(); if (g.select) g.select(REGION_INDEX.rus);
      for (let i = 0; i < 90; i++) g.step(); // a bigger outbreak: more regions, bubbles, effects
      g.setSpeed(sp);
    }, speed);
    const runs = []; for (let k = 0; k < 3; k++) runs.push(await stressWindow(2500));
    await page.evaluate(() => { const g = window.__game; g.setSpeed(0); MapView.fit(); g.select && g.select(-1); });
    const p95s = runs.map(r => r.p95).sort((a, b) => a - b), p95 = p95s[1], p50 = runs.map(r => r.p50).sort((a, b) => a - b)[1], mx = Math.max(...runs.map(r => r.mx)), ev = runs.reduce((a, r) => a + r.ev, 0);
    console.log('  ' + label + ': ' + ev + ' input events over 3 windows, frame gap median p50 ' + p50.toFixed(1) + ' ms, median p95 ' + p95.toFixed(1) + ' ms (windows: ' + runs.map(r => r.p95.toFixed(0)).join(', ') + '), worst single frame ' + mx.toFixed(0) + ' ms');
    return { p50, p95, mx };
  }
  console.log('lag under heavy mouse/wheel/drag use at 3x speed:');
  const s1 = await stress('1900x950', 1900, 950, 3);
  const s2 = await stress('1280x720', 1280, 720, 3);
  ok(s1.p95 < 60 && s2.p95 < 60, 'frame gaps stay smooth (median over 3 windows: 95% of frames under 60 ms)', { p95a: +s1.p95.toFixed(1), p95b: +s2.p95.toFixed(1) });
  ok(s1.mx < 400 && s2.mx < 400, 'no frame ever freezes for more than 0.4 s', { worstA: Math.round(s1.mx), worstB: Math.round(s2.mx) });

  // ---- cost of one draw (canvas read back so the GPU/software work is really counted) --------------------------------------
  const cost = await page.evaluate(() => {
    const g = window.__game, st = g.st, cv = document.getElementById('map'), ctx = cv.getContext('2d'); MapView.fit();
    const time = (n, f) => { const t = performance.now(); for (let i = 0; i < n; i++) { f(i); MapView.draw(st); ctx.getImageData(0, 0, 1, 1); } return (performance.now() - t) / n; };
    const still = time(60, () => {});
    const panning = time(60, i => MapView.zoomAt(900, 400, i % 2 ? 1.01 : 1 / 1.01));
    MapView.fit();
    return { still: +still.toFixed(2), moving: +panning.toFixed(2) };
  });
  console.log('  one frame: ' + cost.still + ' ms when the view is still, ' + cost.moving + ' ms while zooming/panning');
  ok(cost.still < 12 && cost.moving < 40, 'per-frame draw cost is small', cost);

  // ---- a full-screen pop-up (BREAKING NEWS) must not slow the page down: it used to blur the live map behind it, dropping to ~15 fps ----
  if (await page.evaluate(() => !!window.__game.openBreak)) {
    await page.setViewportSize({ width: 1900, height: 950 }); await page.waitForTimeout(300);
    const ov = await page.evaluate(async () => {
      const g = window.__game, st = g.st; g.setSpeed(0); if (g.blocked) g.closeBreak();
      const run = ms => new Promise(res => { const ft = []; let last = performance.now(), t0 = last; const loop = () => { const t = performance.now(); ft.push(t - last); last = t; if (t - t0 < ms) requestAnimationFrame(loop); else res(ft.slice(2)); }; requestAnimationFrame(loop); });
      const med = a => a.slice().sort((x, y) => x - y)[Math.floor((a.length - 1) / 2)];
      st.brk = { type: 'random', h: 'TEST HEADLINE', s: 'Test subline.' }; g.openBreak();
      const a = med(await run(1500)), b = med(await run(1500)); g.closeBreak();
      return { open: Math.max(0, Math.min(a, b)) };
    });
    ok(ov.open < 30, 'a full-screen BREAKING NEWS card keeps the page smooth (median frame gap under 30 ms at 1900x950)', { ms: +ov.open.toFixed(1) });
  }

  ok(errors.length === 0, 'no console or page errors', errors.slice(0, 5));
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
