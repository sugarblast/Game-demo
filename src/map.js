// Canvas map renderer: equirectangular projection, pan/zoom, region shading, travel effects.
const MapView = (() => {
  const cv = document.getElementById('map');
  const ctx = cv.getContext('2d');
  const LON0 = -180, LAT0 = 84, W = 360, H = 144; // world units are degrees
  const view = { k: 1, tx: 0, ty: 0 };
  let cw = 0, ch = 0, dpr = 1, baseK = 1, fitted = true;
  let hover = -1, selected = -1, pal = null, anims = [], pops = [];
  const paths = REGIONS.map(r => {
    const p = new Path2D();
    for (const poly of r.polys) {
      poly.forEach(([lo, la], i) => { const x = lo - LON0, y = LAT0 - la; i ? p.lineTo(x, y) : p.moveTo(x, y); });
      p.closePath();
    }
    return p;
  });
  const wpolys = REGIONS.map(r => r.polys.map(poly => poly.map(([lo, la]) => [lo - LON0, LAT0 - la])));

  function readPalette() {
    const cs = getComputedStyle(document.documentElement);
    const hex = n => { const v = cs.getPropertyValue(n).trim(); const m = /^#?([0-9a-f]{6})/i.exec(v); const x = parseInt(m[1], 16); return [x >> 16, (x >> 8) & 255, x & 255]; };
    pal = { goodHex: cs.getPropertyValue('--good').trim(), land: hex('--land'), inf: hex('--inf'), dead: hex('--dead'), ocean: hex('--ocean'), inf2: hex('--inf').map(c => Math.round(c * 0.45 + 20)) };
  }
  const mix = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));
  const rgb = c => 'rgb(' + c[0] + ',' + c[1] + ',' + c[2] + ')';

  function resize() {
    const r = cv.getBoundingClientRect();
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    cw = r.width; ch = r.height;
    cv.width = Math.round(cw * dpr); cv.height = Math.round(ch * dpr);
    baseK = Math.min(cw / W, ch / H);
    if (fitted) fit(); else clamp();
  }
  function fit() { fitted = true; view.k = baseK; view.tx = (cw - W * baseK) / 2; view.ty = (ch - H * baseK) / 2; }
  function clamp() {
    view.k = Math.max(baseK * 0.98, Math.min(baseK * 14, view.k));
    const mw = W * view.k, mh = H * view.k, m = 0.25;
    view.tx = mw <= cw ? (cw - mw) / 2 : Math.min(cw * m, Math.max(cw * (1 - m) - mw, view.tx));
    view.ty = mh <= ch ? (ch - mh) / 2 : Math.min(ch * m, Math.max(ch * (1 - m) - mh, view.ty));
  }
  function zoomAt(sx, sy, f) {
    fitted = false;
    const wx = (sx - view.tx) / view.k, wy = (sy - view.ty) / view.k;
    view.k *= f; clamp();
    view.tx = sx - wx * view.k; view.ty = sy - wy * view.k; clamp();
  }
  function pan(dx, dy) { fitted = false; view.tx += dx; view.ty += dy; clamp(); }
  const toWorld = (sx, sy) => [(sx - view.tx) / view.k, (sy - view.ty) / view.k];
  const toScreen = (lon, lat) => [(lon - LON0) * view.k + view.tx, (LAT0 - lat) * view.k + view.ty];

  function inPoly(x, y, poly) {
    let c = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const a = poly[i], b = poly[j];
      if ((a[1] > y) !== (b[1] > y) && x < (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]) + a[0]) c = !c;
    }
    return c;
  }
  function hitTest(sx, sy) {
    const [x, y] = toWorld(sx, sy);
    for (let i = 0; i < wpolys.length; i++) for (const p of wpolys[i]) if (inPoly(x, y, p)) return i;
    // forgiving hit on small islands: nearest centre within a few degrees
    let best = -1, bd = 3.2 * 3.2;
    for (let i = 0; i < REGIONS.length; i++) {
      if (REGIONS[i].pop > 80) continue;
      const dx = REGIONS[i].c[0] - LON0 - x, dy = LAT0 - REGIONS[i].c[1] - y, d = dx * dx + dy * dy;
      if (d < bd) { bd = d; best = i; }
    }
    return best;
  }

  function colorFor(st, i) {
    const r = REGIONS[i], pop = r.pop * 1e6, I = st.I[i], D = st.D[i];
    if (I < 1 && D < 1) return pal.land;
    const f = (I + D) / pop;
    const t = Math.max(0.22, Math.min(1, (Math.log10(Math.max(f, 1e-12)) + 9) / 8.6));
    let c = t < 0.5 ? mix(pal.land, pal.inf2, t * 2) : mix(pal.inf2, pal.inf, (t - 0.5) * 2);
    const ds = D / (I + D + 1e-9);
    if (ds > 0.05) c = mix(c, pal.dead, Math.min(0.85, ds * 0.9));
    return c;
  }

  function addFx(from, to, mode) { anims.push({ a: from, b: to, mode, t0: performance.now(), dur: mode === 'by air' ? 1100 : mode === 'by sea' ? 1700 : 700 }); if (anims.length > 60) anims.shift(); }

  function bubbleXY(b) {
    const r = REGIONS[b.r], poly = r.polys[0], v = poly[b.vi % poly.length];
    return toScreen(r.c[0] + (v[0] - r.c[0]) * b.t, r.c[1] + (v[1] - r.c[1]) * b.t);
  }
  function hitBubble(sx, sy, st) {
    if (!st || !st.bubbles) return 0;
    for (let k = st.bubbles.length - 1; k >= 0; k--) {
      const b = st.bubbles[k], [x, y] = bubbleXY(b);
      if (Math.hypot(sx - x, sy - y) <= 26) return b.id;
    }
    return 0;
  }
  function addPop(txt, x, y, col) { pops.push({ txt, x, y, col: col || '#38d6a0', t0: performance.now() }); }
  function drawBubbles(st, now) {
    for (const b of st.bubbles) {
      const [x, y] = bubbleXY(b);
      if (x < -40 || x > cw + 40 || y < -40 || y > ch + 40) continue;
      const left = b.life - (st.day - b.born), frac = Math.max(0, Math.min(1, left / b.life));
      const R = (b.gold ? 17 : 14) * (1 + 0.08 * Math.sin(now / 180 + b.id));
      const col = b.gold ? '#ffc933' : (pal.goodHex || '#38d6a0');
      ctx.globalAlpha = left <= 4 && Math.floor(now / 160) % 2 === 0 ? 0.35 : 1;
      const grd = ctx.createRadialGradient(x, y, R * 0.2, x, y, R * 2); grd.addColorStop(0, col + 'aa'); grd.addColorStop(1, col + '00');
      ctx.fillStyle = grd; ctx.beginPath(); ctx.arc(x, y, R * 2, 0, 6.283); ctx.fill();
      ctx.beginPath(); ctx.arc(x, y, R, 0, 6.283); ctx.fillStyle = '#08141d'; ctx.fill();
      ctx.lineWidth = 2; ctx.strokeStyle = col; ctx.stroke();
      ctx.beginPath(); ctx.arc(x, y, R + 4, -Math.PI / 2, -Math.PI / 2 + 6.283 * frac); ctx.lineWidth = 2.5; ctx.strokeStyle = col; ctx.stroke();
      ctx.fillStyle = col; ctx.font = '800 11px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('+' + b.val, x, y + 0.5); ctx.textBaseline = 'alphabetic'; ctx.globalAlpha = 1;
    }
  }
  function drawPops(now) {
    pops = pops.filter(p => now - p.t0 < 900);
    ctx.textAlign = 'center'; ctx.font = '800 17px system-ui, sans-serif';
    for (const p of pops) { const t = (now - p.t0) / 900; ctx.globalAlpha = 1 - t; ctx.fillStyle = p.col; ctx.fillText(p.txt, p.x, p.y - 8 - 42 * t); }
    ctx.globalAlpha = 1;
  }

  function draw(st) {
    if (!pal) readPalette();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cw, ch);
    ctx.setTransform(dpr * view.k, 0, 0, dpr * view.k, dpr * view.tx, dpr * view.ty);
    const px = 1 / view.k;
    // graticule
    ctx.lineWidth = px * 0.6; ctx.strokeStyle = 'rgba(120,160,200,0.07)'; ctx.beginPath();
    for (let lo = -180; lo <= 180; lo += 30) { ctx.moveTo(lo - LON0, 0); ctx.lineTo(lo - LON0, H); }
    for (let la = -60; la <= 80; la += 20) { ctx.moveTo(0, LAT0 - la); ctx.lineTo(W, LAT0 - la); }
    ctx.stroke();
    // regions
    ctx.lineJoin = 'round';
    for (let i = 0; i < REGIONS.length; i++) {
      ctx.fillStyle = st ? rgb(colorFor(st, i)) : rgb(pal.land);
      ctx.fill(paths[i]);
      ctx.lineWidth = px * 1.1; ctx.strokeStyle = 'rgba(8,14,22,0.9)';
      ctx.stroke(paths[i]);
    }
    if (st) {
      // closed-border / lockdown overlays
      for (let i = 0; i < REGIONS.length; i++) {
        if (st.lock[i]) { ctx.lineWidth = px * 2; ctx.strokeStyle = 'rgba(76,195,255,0.85)'; ctx.setLineDash([px * 5, px * 3]); ctx.stroke(paths[i]); ctx.setLineDash([]); }
      }
    }
    if (selected >= 0) { ctx.lineWidth = px * 2.2; ctx.strokeStyle = '#ffffff'; ctx.stroke(paths[selected]); }
    else if (hover >= 0) { ctx.lineWidth = px * 1.8; ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.stroke(paths[hover]); }
    // markers + effects in screen space
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (st) {
      for (let i = 0; i < REGIONS.length; i++) {
        const r = REGIONS[i];
        if (st.I[i] < 1 && st.D[i] < 1) continue;
        const [sx, sy] = toScreen(r.c[0], r.c[1]);
        const sz = 2.5 + Math.min(6, Math.log10(st.I[i] + 1) * 0.9);
        ctx.beginPath(); ctx.arc(sx, sy, sz, 0, 6.283);
        ctx.fillStyle = rgb(pal.inf); ctx.globalAlpha = 0.9; ctx.fill(); ctx.globalAlpha = 1;
        if (st.aware[i] >= 0) { ctx.beginPath(); ctx.arc(sx, sy, sz + 3, 0, 6.283); ctx.lineWidth = 1.3; ctx.strokeStyle = '#ffb020'; ctx.stroke(); }
      }
      const now = performance.now();
      anims = anims.filter(a => now - a.t0 < a.dur);
      for (const a of anims) {
        const t = (now - a.t0) / a.dur, A = REGIONS[a.a].c, B = REGIONS[a.b].c;
        const [x1, y1] = toScreen(A[0], A[1]), [x2, y2] = toScreen(B[0], B[1]);
        const dist = Math.hypot(x2 - x1, y2 - y1), lift = a.mode === 'by air' ? dist * 0.22 : a.mode === 'by sea' ? dist * 0.05 : 0;
        const mx = (x1 + x2) / 2, my = (y1 + y2) / 2 - lift;
        const bx = (1 - t) * (1 - t) * x1 + 2 * (1 - t) * t * mx + t * t * x2, by = (1 - t) * (1 - t) * y1 + 2 * (1 - t) * t * my + t * t * y2;
        ctx.globalAlpha = 0.35 * (1 - t); ctx.lineWidth = 1; ctx.strokeStyle = a.mode === 'by sea' ? '#7fd1ff' : '#fff';
        ctx.beginPath(); ctx.moveTo(x1, y1); ctx.quadraticCurveTo(mx, my, x2, y2); ctx.stroke();
        ctx.globalAlpha = 1; ctx.fillStyle = a.mode === 'by sea' ? '#7fd1ff' : a.mode === 'by air' ? '#ffffff' : '#ff9aa5';
        ctx.beginPath(); ctx.arc(bx, by, a.mode === 'by air' ? 2.6 : 2.2, 0, 6.283); ctx.fill();
        if (t > 0.9) { ctx.globalAlpha = (1 - t) * 6; ctx.beginPath(); ctx.arc(x2, y2, 4 + (t - 0.9) * 120, 0, 6.283); ctx.strokeStyle = '#ff3b4e'; ctx.lineWidth = 1.5; ctx.stroke(); ctx.globalAlpha = 1; }
      }
    }
    if (st && st.bubbles) drawBubbles(st, performance.now());
    drawPops(performance.now());
    // labels
    if (view.k > baseK * 1.5 || hover >= 0 || selected >= 0) {
      ctx.font = '600 11px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = 'rgba(230,237,245,0.8)';
      for (let i = 0; i < REGIONS.length; i++) {
        if (!(view.k > baseK * 1.5 || i === hover || i === selected)) continue;
        const [sx, sy] = toScreen(REGIONS[i].c[0], REGIONS[i].c[1]);
        if (sx < -50 || sx > cw + 50 || sy < -20 || sy > ch + 20) continue;
        ctx.fillText(REGIONS[i].name, sx, sy - 10);
      }
    }
  }

  return {
    resize, fit, zoomAt, pan, hitTest, draw, addFx, toScreen, hitBubble, bubbleXY, addPop,
    refreshPalette() { pal = null; },
    setHover(i) { hover = i; }, setSelected(i) { selected = i; },
    get selected() { return selected; }, get hover() { return hover; },
    get size() { return [cw, ch]; }, get baseK() { return baseK; }, get k() { return view.k; },
  };
})();
