// Canvas map renderer: equirectangular projection, pan/zoom, region shading, travel effects.
const MapView = (() => {
  const cv = document.getElementById('map');
  const ctx = cv.getContext('2d');
  const LON0 = -180, LAT0 = 84, W = 360, H = 144; // world units are degrees
  const view = { k: 1, tx: 0, ty: 0 };
  let cw = 0, ch = 0, dpr = 1, baseK = 1, fitted = true;
  let hover = -1, selected = -1, hoverBub = 0, pal = null, anims = [], pops = [], icons = [];
  // The land (fills, borders, lockdown tint) only changes when the view or the numbers change, so it is painted into an
  // off-screen layer and copied each frame. A frame is then one drawImage plus the highlights, markers and bubbles.
  const layer = document.createElement('canvas'), lctx = layer.getContext('2d');
  let layerSig = '';
  // Each region is drawn as one or more "parts": one per country when real borders are loaded (assets/map/world.js),
  // otherwise a single part made from the hand-drawn polygons. A part has its own slight shade so neighbours stay distinct.
  const hash = s => { let h = 7; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return h; };
  const shadeOf = s => (((hash(s) % 1000) + 1000) % 1000 / 1000 - 0.5) * 0.17; // -0.085 .. +0.085
  const rings = polys => polys.map(poly => Array.isArray(poly[0][0]) ? poly : [poly]); // hand-drawn polys are a single ring
  const parts = REGIONS.map(r => {
    const list = r.countries || [{ n: r.id, polys: rings(r.polys) }];
    return list.map(c => {
      const p = new Path2D();
      for (const poly of c.polys) for (const ring of poly) {
        ring.forEach(([lo, la], i) => { const x = lo - LON0, y = LAT0 - la; i ? p.lineTo(x, y) : p.moveTo(x, y); });
        p.closePath();
      }
      return { path: p, shade: shadeOf(c.n), rule: r.countries ? 'evenodd' : 'nonzero' };
    });
  });
  const paths = parts.map(list => { const p = new Path2D(); list.forEach(c => p.addPath(c.path)); return p; }); // whole-region outline
  const wpolys = REGIONS.map(r => r.polys.map(poly => poly.map(([lo, la]) => [lo - LON0, LAT0 - la])));

  // Earth tones by climate zone. Infection mixes toward red on top of these.
  const LAND = { temperate: [98, 130, 84], hot: [186, 156, 102], cold: [150, 163, 158] };
  const landOf = (i, shade) => { const b = LAND[REGIONS[i].climate] || LAND.temperate, k = 1 + shade; return b.map(v => Math.max(0, Math.min(255, Math.round(v * k)))); };

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
    layer.width = cv.width; layer.height = cv.height; layerSig = '';
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

  // base = the region's own land colour; infection mixes it toward red, deaths toward purple.
  function colorFor(st, i, base) {
    const r = REGIONS[i], pop = r.pop * 1e6, I = st.I[i], D = st.D[i];
    if (I < 1 && D < 1) return base;
    const f = (I + D) / pop;
    const t = Math.max(0.22, Math.min(1, (Math.log10(Math.max(f, 1e-12)) + 9) / 8.6));
    let c = mix(base, pal.inf, 0.30 + 0.70 * (t - 0.22) / 0.78);
    const ds = D / (I + D + 1e-9);
    if (ds > 0.05) c = mix(c, pal.dead, Math.min(0.85, ds * 0.9));
    return c;
  }

  function addFx(from, to, mode) { anims.push({ a: from, b: to, mode, t0: performance.now(), dur: mode === 'by air' ? 1100 : mode === 'by sea' ? 1700 : 700 }); if (anims.length > 60) anims.shift(); }

  function bubbleXY(b) {
    const r = REGIONS[b.r], poly = r.polys[0], v = poly[b.vi % poly.length];
    return toScreen(r.c[0] + (v[0] - r.c[0]) * b.t, r.c[1] + (v[1] - r.c[1]) * b.t);
  }
  // The bubble nearest the pointer within reach (generous: the drawn bubble is ~14px, you can be 28px off and still get it).
  function hitBubble(sx, sy, st) {
    if (!st || !st.bubbles) return 0;
    let best = 0, bd = 28 * 28;
    for (let k = st.bubbles.length - 1; k >= 0; k--) {
      const b = st.bubbles[k], [x, y] = bubbleXY(b), dx = sx - x, dy = sy - y, d = dx * dx + dy * dy;
      if (d <= bd) { bd = d; best = b.id; }
    }
    return best;
  }
  function addPop(txt, x, y, col) { pops.push({ txt, x, y, col: col || '#38d6a0', t0: performance.now() }); }
  function drawBubbles(st, now) {
    for (const b of st.bubbles) {
      const [x, y] = bubbleXY(b);
      if (x < -40 || x > cw + 40 || y < -40 || y > ch + 40) continue;
      const left = b.life - (st.day - b.born), frac = Math.max(0, Math.min(1, left / b.life));
      const R = (b.gold ? 17 : 14) * (1 + 0.08 * Math.sin(now / 180 + b.id)) * (b.id === hoverBub ? 1.18 : 1);
      const col = b.gold ? '#ffc933' : (pal.goodHex || '#38d6a0');
      ctx.globalAlpha = left <= 4 && Math.floor(now / 160) % 2 === 0 ? 0.35 : 1;
      const grd = ctx.createRadialGradient(x, y, R * 0.2, x, y, R * 2); grd.addColorStop(0, col + 'aa'); grd.addColorStop(1, col + '00');
      ctx.fillStyle = grd; ctx.beginPath(); ctx.arc(x, y, R * 2, 0, 6.283); ctx.fill();
      ctx.beginPath(); ctx.arc(x, y, R, 0, 6.283); ctx.fillStyle = '#08141d'; ctx.fill();
      ctx.lineWidth = 2; ctx.strokeStyle = col; ctx.stroke();
      ctx.beginPath(); ctx.arc(x, y, R + 4, -Math.PI / 2, -Math.PI / 2 + 6.283 * frac); ctx.lineWidth = 2.5; ctx.strokeStyle = col; ctx.stroke();
      ctx.fillStyle = col; ctx.font = '800 11px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('+' + b.val, x, y + 0.5); ctx.textBaseline = 'alphabetic'; ctx.globalAlpha = 1;
      if (b.id === hoverBub) { ctx.beginPath(); ctx.arc(x, y, R + 8, 0, 6.283); ctx.lineWidth = 2; ctx.strokeStyle = '#ffffff'; ctx.stroke(); } // "click me" ring
    }
  }

  // Travelling icons: an airplane for "by air" and a ship for "by sea" (land spread stays a dot). Both are drawn pointing along +x.
  const PLANE = new Path2D('M7 0 L5.4 -1.1 L1.6 -1.3 L-2 -6.6 L-3.7 -6.6 L-2.7 -1.3 L-5 -1.1 L-6 -3.1 L-7.3 -3.1 L-6.9 0 L-7.3 3.1 L-6 3.1 L-5 1.1 L-2.7 1.3 L-3.7 6.6 L-2 6.6 L1.6 1.3 L5.4 1.1 Z');
  const SHIP = new Path2D('M-7.5 0.5 L7.5 0.5 L5 4.6 L-5 4.6 Z M-3.2 0.5 L-3.2 -3.2 L3.6 -3.2 L3.6 0.5 Z M-0.9 -3.2 L-0.9 -6.4 L1.5 -6.4 L1.5 -3.2 Z');
  function drawIcon(path, x, y, ang, flip, scale, fill) {
    ctx.save(); ctx.translate(x, y); if (ang) ctx.rotate(ang); if (flip) ctx.scale(-1, 1); ctx.scale(scale, scale);
    ctx.lineJoin = 'round'; ctx.lineWidth = 1.5 / scale; ctx.strokeStyle = 'rgba(8,16,22,0.9)'; ctx.stroke(path);
    ctx.fillStyle = fill; ctx.fill(path); ctx.restore();
  }
  function drawPops(now) {
    pops = pops.filter(p => now - p.t0 < 900);
    ctx.textAlign = 'center'; ctx.font = '800 17px system-ui, sans-serif';
    for (const p of pops) { const t = (now - p.t0) / 900; ctx.globalAlpha = 1 - t; ctx.fillStyle = p.col; ctx.fillText(p.txt, p.x, p.y - 8 - 42 * t); }
    ctx.globalAlpha = 1;
  }

  // Paints the land into `c` (the cached layer). World transform is set here.
  function paintLand(c, st) {
    c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, layer.width, layer.height);
    c.setTransform(dpr * view.k, 0, 0, dpr * view.k, dpr * view.tx, dpr * view.ty);
    const px = 1 / view.k;
    // graticule
    c.lineWidth = px * 0.6; c.strokeStyle = 'rgba(200,230,250,0.10)'; c.beginPath();
    for (let lo = -180; lo <= 180; lo += 30) { c.moveTo(lo - LON0, 0); c.lineTo(lo - LON0, H); }
    for (let la = -60; la <= 80; la += 20) { c.moveTo(0, LAT0 - la); c.lineTo(W, LAT0 - la); }
    c.stroke();
    // regions: fills, then thin borders. (Wide strokes are very slow on big maps, so only thin ones are used.)
    c.lineJoin = 'round';
    for (let i = 0; i < REGIONS.length; i++) {
      for (const p of parts[i]) {
        const base = landOf(i, p.shade);
        c.fillStyle = rgb(st ? colorFor(st, i, base) : base);
        c.fill(p.path, p.rule);
      }
    }
    c.lineWidth = px * 0.6; c.strokeStyle = 'rgba(22,30,22,0.55)';
    for (const list of parts) for (const p of list) c.stroke(p.path);
    if (st) {
      // lockdown: blue tint plus a thin blue outline
      for (let i = 0; i < REGIONS.length; i++) {
        if (!st.lock[i]) continue;
        c.fillStyle = 'rgba(76,195,255,0.24)'; for (const p of parts[i]) c.fill(p.path, p.rule);
        c.lineWidth = px * 0.9; c.strokeStyle = 'rgba(76,195,255,0.95)'; c.stroke(paths[i]);
      }
    }
  }
  // Everything the land layer depends on, as one string. If it is unchanged, the cached layer is still right.
  function landSig(st) {
    let s = cw + 'x' + ch + '@' + dpr + '|' + view.k.toFixed(5) + ',' + view.tx.toFixed(2) + ',' + view.ty.toFixed(2) + '|';
    if (!st) return s + 'start';
    for (let i = 0; i < REGIONS.length; i++) s += rgb(colorFor(st, i, landOf(i, 0))) + (st.lock[i] ? 'L' : '') + ';';
    return s;
  }

  function draw(st) {
    if (!pal) readPalette();
    const sig = landSig(st);
    if (sig !== layerSig) { paintLand(lctx, st); layerSig = sig; }
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, cv.width, cv.height); ctx.drawImage(layer, 0, 0);
    ctx.setTransform(dpr * view.k, 0, 0, dpr * view.k, dpr * view.tx, dpr * view.ty);
    const px = 1 / view.k;
    // pointer highlight, then the selected region on top of it
    if (hover >= 0 && hover !== selected) {
      ctx.fillStyle = 'rgba(255,255,255,0.12)'; for (const c of parts[hover]) ctx.fill(c.path, c.rule);
      ctx.lineWidth = px * 1.6; ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.stroke(paths[hover]);
    }
    if (selected >= 0) {
      ctx.fillStyle = 'rgba(255,255,255,0.16)'; for (const c of parts[selected]) ctx.fill(c.path, c.rule);
      ctx.lineWidth = px * 2.2; ctx.strokeStyle = '#ffffff'; ctx.stroke(paths[selected]);
    }
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
      icons = [];
      for (const a of anims) {
        const t = (now - a.t0) / a.dur, A = REGIONS[a.a].c, B = REGIONS[a.b].c;
        const [x1, y1] = toScreen(A[0], A[1]), [x2, y2] = toScreen(B[0], B[1]);
        const dist = Math.hypot(x2 - x1, y2 - y1), lift = a.mode === 'by air' ? dist * 0.22 : a.mode === 'by sea' ? dist * 0.05 : 0;
        const mx = (x1 + x2) / 2, my = (y1 + y2) / 2 - lift;
        const bx = (1 - t) * (1 - t) * x1 + 2 * (1 - t) * t * mx + t * t * x2, by = (1 - t) * (1 - t) * y1 + 2 * (1 - t) * t * my + t * t * y2;
        ctx.globalAlpha = 0.35 * (1 - t); ctx.lineWidth = 1; ctx.strokeStyle = a.mode === 'by sea' ? '#7fd1ff' : '#fff';
        ctx.beginPath(); ctx.moveTo(x1, y1); ctx.quadraticCurveTo(mx, my, x2, y2); ctx.stroke();
        ctx.globalAlpha = 1;
        if (a.mode === 'by air' || a.mode === 'by sea') {
          // heading = slope of the curve at t; the plane turns with it, the ship only faces left or right
          const tx = 2 * (1 - t) * (mx - x1) + 2 * t * (x2 - mx), ty = 2 * (1 - t) * (my - y1) + 2 * t * (y2 - my);
          if (a.mode === 'by air') drawIcon(PLANE, bx, by, Math.atan2(ty, tx), false, 1.75, '#ffffff');
          else drawIcon(SHIP, bx, by, 0, tx < 0, 1.6, '#9fdcff');
          icons.push([bx, by, a.mode]);
        } else {
          ctx.fillStyle = '#ff9aa5'; ctx.beginPath(); ctx.arc(bx, by, 2.2, 0, 6.283); ctx.fill();
        }
        if (t > 0.9) { ctx.globalAlpha = (1 - t) * 6; ctx.beginPath(); ctx.arc(x2, y2, 4 + (t - 0.9) * 120, 0, 6.283); ctx.strokeStyle = '#ff3b4e'; ctx.lineWidth = 1.5; ctx.stroke(); ctx.globalAlpha = 1; }
      }
    }
    // labels first, so DNA bubbles are always drawn on top of them
    if (view.k > baseK * 1.5 || hover >= 0 || selected >= 0) {
      ctx.font = '700 11px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.lineJoin = 'round'; ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(8,16,22,0.75)'; ctx.fillStyle = '#f2f6fa';
      for (let i = 0; i < REGIONS.length; i++) {
        if (!(view.k > baseK * 1.5 || i === hover || i === selected)) continue;
        const [sx, sy] = toScreen(REGIONS[i].c[0], REGIONS[i].c[1]);
        if (sx < -50 || sx > cw + 50 || sy < -20 || sy > ch + 20) continue;
        ctx.strokeText(REGIONS[i].name, sx, sy - 10); ctx.fillText(REGIONS[i].name, sx, sy - 10);
      }
    }
    if (st && st.bubbles) drawBubbles(st, performance.now());
    drawPops(performance.now());
  }

  return {
    resize, fit, zoomAt, pan, hitTest, draw, addFx, toScreen, hitBubble, bubbleXY, addPop,
    refreshPalette() { pal = null; layerSig = ''; },
    setHover(i) { hover = i; }, setSelected(i) { selected = i; }, setHoverBubble(id) { hoverBub = id; },
    get icons() { return icons; }, // screen positions of the plane/ship icons drawn last frame (used by tests)
    get selected() { return selected; }, get hover() { return hover; },
    get size() { return [cw, ch]; }, get baseK() { return baseK; }, get k() { return view.k; },
  };
})();
