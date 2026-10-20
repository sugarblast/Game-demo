// Game controller: loop, input, HUD, panels, save/load, breaking news, sound hooks.
(() => {
  const $ = id => document.getElementById(id);
  const SAVE_KEY = 'outbreak-protocol-save-v2', BEST_KEY = 'outbreak-protocol-best-v1', CB_KEY = 'outbreak-protocol-cb', BRK_KEY = 'outbreak-protocol-brk', PROF_KEY = 'outbreak-protocol-profile-v1';
  const BASE_MS = 700; // ms per in-game day at 1x. 2x and 3x run more ticks per interval, never different rules.
  let st = null, speed = 1, acc = 0, last = 0, userPaused = false, hiddenPaused = false;
  let tab = 'Transmission', newsShown = 0, newsTimer = 0, lastSave = 0, bubbleHinted = false, brkMode = 'all';

  const store = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} },
    del(k) { try { localStorage.removeItem(k); } catch (e) {} },
  };
  brkMode = store.get(BRK_KEY) || 'all';
  const fmt = n => n >= 1e9 ? (n / 1e9).toFixed(2) + 'B' : n >= 1e6 ? (n / 1e6).toFixed(n >= 1e8 ? 0 : 1) + 'M' : n >= 1e4 ? (n / 1e3).toFixed(n >= 1e5 ? 0 : 1) + 'K' : Math.floor(n).toLocaleString();
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const dateStr = day => new Date(Date.UTC(2027, 0, 1 + day)).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });

  // ---------- save / load ----------
  function save() {
    if (!st || st.over) return;
    const o = Object.assign({}, st); delete o.d; delete o.fx;
    store.set(SAVE_KEY, JSON.stringify(o));
  }
  function load() {
    const raw = store.get(SAVE_KEY); if (!raw) return null;
    try {
      const o = JSON.parse(raw);
      if (o.v !== 2 || o.S.length !== REGIONS.length) return null;
      o.fx = []; computeDerived(o); return o;
    } catch (e) { return null; }
  }

  // ---------- profile: ratings, trophies and records (saved in this browser, survives between games) ----------
  function loadProfile() {
    let p = null;
    try { p = cleanProfile(JSON.parse(store.get(PROF_KEY))); } catch (e) {}
    p = p || newProfile();
    const old = +store.get(BEST_KEY); // fastest win from before profiles existed
    if (!p.fastestWin && old > 0) p.fastestWin = old;
    return p;
  }
  let prof = loadProfile();
  const saveProfile = () => store.set(PROF_KEY, JSON.stringify(prof));
  const trophyCount = () => Object.keys(prof.trophies).length;
  // Records every trophy that is newly earned (re-checking, since one unlock can trigger another). Returns the new ids.
  function unlockNew(phase) {
    const out = [];
    for (let k = 0; k < 4; k++) {
      const ids = evalTrophies(st, prof, phase); if (!ids.length) break;
      ids.forEach(id => { prof.trophies[id] = { day: st.day, t: Date.now() }; out.push(id); });
    }
    return out;
  }
  const toastQ = []; let toastBusy = false;
  function toast(html) { toastQ.push(html); if (!toastBusy) nextToast(); }
  function nextToast() {
    const el = $('toast'), h = toastQ.shift();
    if (!h) { toastBusy = false; el.classList.remove('show'); return; }
    toastBusy = true; el.innerHTML = h; el.classList.add('show');
    setTimeout(() => { el.classList.remove('show'); setTimeout(nextToast, 450); }, 4200);
  }
  function checkLive() {
    const ids = unlockNew('live'); if (!ids.length) return;
    saveProfile(); Sound.play('trophy');
    ids.forEach(id => { const t = TROPHY_INDEX[id]; toast('<b>Trophy unlocked</b><span>' + t.icon + ' ' + esc(t.name) + '</span><small>' + esc(t.desc) + '</small>'); });
  }

  // ---------- speed / pause ----------
  function setSpeed(s) {
    speed = s; userPaused = s === 0;
    document.querySelectorAll('#speed button').forEach(b => b.classList.toggle('on', +b.dataset.s === s));
  }
  document.querySelectorAll('#speed button').forEach(b => b.addEventListener('click', () => setSpeed(+b.dataset.s)));
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { hiddenPaused = true; save(); } else { hiddenPaused = false; last = performance.now(); }
  });
  window.addEventListener('pagehide', save);

  // ---------- sound hooks ----------
  const unlockSound = () => Sound.unlock();
  document.addEventListener('pointerdown', unlockSound); document.addEventListener('keydown', unlockSound);
  document.addEventListener('click', e => { const b = e.target.closest && e.target.closest('button'); if (b && b.id !== 'brkX') Sound.play('click'); });
  const updSndBtn = () => { $('sndBtn').textContent = Sound.muted ? '🔇' : '🔊'; $('sndBtn').setAttribute('aria-label', Sound.muted ? 'Unmute' : 'Mute'); };
  $('sndBtn').addEventListener('click', () => { Sound.unlock(); Sound.setMuted(!Sound.muted); updSndBtn(); });

  // ---------- loop ----------
  function frame(now) {
    const dt = Math.min(200, now - (last || now)); last = now;
    if (st && !st.over && !userPaused && !hiddenPaused && !blocked()) {
      acc += dt;
      const per = BASE_MS / speed; let guard = 0;
      while (acc >= per && guard++ < 8) { acc -= per; tick(); if (st.over || blocked()) break; }
    }
    if (st && st.fx.length) { st.fx.splice(0).forEach(f => MapView.addFx(f[0], f[1], f[2])); }
    MapView.draw(st);
    requestAnimationFrame(frame);
  }
  const brkOpen = () => !$('brkOv').classList.contains('hidden');
  const trOpen = () => !$('trophyOv').classList.contains('hidden');
  function blocked() { return !$('startOv').classList.contains('hidden') || !$('menuOv').classList.contains('hidden') || trOpen() || brkOpen(); }
  function tick() {
    step(st);
    if (st.day - lastSave >= 10) { lastSave = st.day; save(); }
    hud();
    if (st.over) { st.brk = null; finish(); return; }
    checkLive();
    if (st.brk) openBreak();
  }

  // ---------- breaking news (pauses the game until the X is clicked) ----------
  function openBreak() {
    const b = st.brk; if (!b) return;
    if (brkMode === 'off' || (brkMode === 'miles' && b.type === 'random')) { st.brk = null; return; }
    const recent = st.news.slice(-4).map(n => n.text).join('   +++   ');
    st.brkSeen = (st.brkSeen || 0) + 1;
    const ov = $('brkOv'); ov.classList.remove('hidden');
    ov.innerHTML = '<div class="modal brk" role="alertdialog" aria-modal="true" aria-labelledby="brkH" aria-describedby="brkS">' +
      '<div class="brkBar"><span class="live">&#9679; LIVE</span><span class="tag">BREAKING NEWS !!</span>' +
      '<button id="brkX" class="brkX" aria-label="Dismiss breaking news">&#10005;</button></div>' +
      '<h2 id="brkH">' + esc(b.h) + '</h2><p id="brkS">' + esc(b.s) + '</p>' +
      '<div class="brkTicker" aria-hidden="true"><div class="brkMarq">' + esc(recent) + '   +++   ' + esc(recent) + '</div></div>' +
      '<small>Game paused. Cross it out to continue.</small></div>';
    Sound.play('news');
    $('brkX').onclick = closeBreak; $('brkX').focus();
  }
  function closeBreak() {
    if (!brkOpen()) return;
    st.brk = null; $('brkOv').classList.add('hidden'); Sound.play('newsClose');
    last = performance.now(); acc = 0; hud(); save();
  }

  // ---------- HUD ----------
  function flash(text, kind) {
    const el = $('news'); el.className = kind || 'info'; el.textContent = text; el.style.opacity = 1;
    clearTimeout(newsTimer); newsTimer = setTimeout(() => { el.style.opacity = 0; }, 5600);
  }
  function hud() {
    const t = totals(st);
    $('day').textContent = st.day + ' · ' + dateStr(st.day);
    $('pts').textContent = Math.floor(st.pts);
    $('dPts').textContent = Math.floor(st.pts);
    $('cInf').lastElementChild.textContent = fmt(t.I);
    $('cDead').lastElementChild.textContent = fmt(t.D);
    $('cHealthy').lastElementChild.textContent = fmt(Math.max(0, t.S));
    $('cureBar').style.width = st.cure.toFixed(1) + '%';
    $('cureTxt').textContent = st.cure.toFixed(1) + '%' + (st.sabLeft > 0 ? ' (slowed)' : '');
    const sab = $('sab');
    sab.disabled = !canSabotage(st);
    $('sabTxt').textContent = st.sabCd > 0 ? 'Sabotage · ' + st.sabCd + 'd' : 'Sabotage cure · ' + SAB_COST + ' DNA';
    $('sabCd').style.width = (st.sabCd > 0 ? st.sabCd / SAB_COOLDOWN * 100 : 0) + '%';
    const afford = UPGRADES.some(u => canBuy(st, u.id));
    $('evoBtn').classList.toggle('pulse', afford && !$('drawer').classList.contains('open'));
    if ($('drawer').classList.contains('open')) renderCards();
    Sound.setTension(0.12 + 0.55 * st.cure / 100 + 0.35 * Math.min(1, t.D / t.pop * 5) + 0.2 * Math.min(1, t.I / t.pop * 2));
    if (!bubbleHinted && st.bubbles.length) { bubbleHinted = true; flash('DNA bubbles are your main income. Click them before they pop!', 'hint'); }
    else showNews();
    const sel = MapView.selected; if (sel >= 0) showTip(sel);
  }
  const NEWS_SOUND = { detect: 'detect', close: 'close', death: 'death', cure: 'cure', spread: 'spread' };
  function showNews() {
    if (st.news.length > newsShown) {
      const fresh = st.news.slice(newsShown); newsShown = st.news.length;
      const pick = fresh.find(n => n.kind === 'end') || fresh.find(n => n.kind === 'sab' || n.kind === 'cure' || n.kind === 'hint') || fresh[fresh.length - 1];
      flash(pick.text, pick.kind);
      if (NEWS_SOUND[pick.kind]) Sound.play(NEWS_SOUND[pick.kind]);
    }
  }

  // ---------- evolve drawer ----------
  const GROUPS = ['Transmission', 'Symptoms', 'Abilities'];
  const TAGS = { tra: 'Spread', vec: 'Vectors', air: 'Air', sea: 'Sea', land: 'Land', sev: 'Visible', let: 'Lethal', hot: 'Heat', cold: 'Cold', stealth: 'Stealth', res: 'Cure resist' };
  function renderTabs() {
    $('tabs').innerHTML = GROUPS.map(g => '<button data-g="' + g + '" class="' + (g === tab ? 'on' : '') + '">' + g + '</button>').join('');
    $('tabs').querySelectorAll('button').forEach(b => b.addEventListener('click', () => { tab = b.dataset.g; renderTabs(); renderCards(); }));
  }
  function renderCards() {
    if (!st) return;
    $('cards').innerHTML = UPGRADES.filter(u => u.g === tab).map(u => {
      const owned = st.owned.includes(u.id), locked = !owned && u.req && !st.owned.includes(u.req), buyable = canBuy(st, u.id);
      const tags = Object.keys(TAGS).filter(k => u[k]).map(k => '<span>' + TAGS[k] + '</span>').join('');
      return '<button class="card ' + (owned ? 'owned' : locked ? 'locked' : !buyable ? 'poor' : '') + '" data-id="' + u.id + '">' +
        '<h4><span>' + esc(u.n) + '</span><span class="cost">' + (owned ? '&#10003;' : u.cost + ' DNA') + '</span></h4>' +
        '<p>' + esc(u.desc) + '</p><div class="tags">' + tags + '</div>' + (locked ? '<span class="req">Needs ' + esc(UP_INDEX[u.req].n) + '</span>' : '') + '</button>';
    }).join('');
    $('cards').querySelectorAll('.card').forEach(c => c.addEventListener('click', () => {
      if (buyUpgrade(st, c.dataset.id)) { Sound.play('buy'); hud(); renderCards(); save(); }
      else if (!st.owned.includes(c.dataset.id)) Sound.play('deny');
    }));
  }
  function toggleDrawer(open) {
    const d = $('drawer'); const o = open === undefined ? !d.classList.contains('open') : open;
    d.classList.toggle('open', o); if (o) { renderTabs(); renderCards(); }
  }
  $('evoBtn').addEventListener('click', () => toggleDrawer());
  $('drawerClose').addEventListener('click', () => toggleDrawer(false));
  function doSabotage() { if (st && sabotage(st)) { Sound.play('sabotage'); hud(); } else if (st && !st.over) Sound.play('deny'); }
  $('sab').addEventListener('click', doSabotage);

  // ---------- tooltip + map input ----------
  function showTip(i) {
    const r = REGIONS[i], tip = $('tip'); if (!st) return;
    const flags = [];
    if (st.aware[i] >= 0) flags.push('Disease detected'); if (st.cb[i]) flags.push('Borders closed');
    if (st.ca[i]) flags.push('Airports closed'); if (st.cs[i]) flags.push('Ports closed'); if (st.lock[i]) flags.push('Lockdown');
    const cm = climateMult(st, i), cmTxt = r.climate === 'temperate' ? 'temperate' : r.climate + ' · spread ×' + cm.toFixed(2) + (cm < 0.99 ? ' (' + r.climate + ' resistance helps)' : '');
    tip.innerHTML = '<h3>' + esc(r.name) + '</h3><div>Population <b>' + fmt(r.pop * 1e6) + '</b></div><div>Infected <b style="color:var(--inf)">' + fmt(st.I[i]) + '</b></div><div>Dead <b style="color:var(--dead)">' + fmt(st.D[i]) + '</b></div><div>Healthy <b style="color:var(--good)">' + fmt(Math.max(0, st.S[i])) + '</b></div><div>Climate <b>' + esc(cmTxt) + '</b></div>' + (flags.length ? '<div class="flags">' + flags.join(' · ') + '</div>' : '');
    tip.style.display = 'block';
    const [sx, sy] = MapView.toScreen(r.c[0], r.c[1]), [cw, ch] = MapView.size;
    const w = tip.offsetWidth, h = tip.offsetHeight;
    tip.style.left = Math.max(6, Math.min(cw - w - 6, sx + 14)) + 'px';
    tip.style.top = Math.max(50, Math.min(ch - h - 6, sy - h / 2)) + 'px';
  }
  function hideTip() { $('tip').style.display = 'none'; }
  function collect(id, sx, sy) {
    const b = st.bubbles.find(x => x.id === id); if (!b) return;
    const v = collectBubble(st, id);
    if (v) { MapView.addPop('+' + v + ' DNA', sx, sy, b.gold ? '#ffc933' : undefined); Sound.play(b.gold ? 'gold' : 'dna'); hud(); }
  }
  const cv = $('map'); const ptrs = new Map(); let dragMoved = 0, pinch0 = 0;
  const local = e => { const r = cv.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
  cv.addEventListener('pointerdown', e => {
    const p = local(e);
    if (st && !st.over && !blocked()) { const id = MapView.hitBubble(p[0], p[1], st); if (id) { collect(id, p[0], p[1]); return; } }
    cv.setPointerCapture(e.pointerId); ptrs.set(e.pointerId, p); dragMoved = 0;
    if (ptrs.size === 2) { const [a, b] = [...ptrs.values()]; pinch0 = Math.hypot(a[0] - b[0], a[1] - b[1]); }
  });
  cv.addEventListener('pointermove', e => {
    const p = local(e), prev = ptrs.get(e.pointerId);
    if (prev) {
      if (ptrs.size === 1) { dragMoved += Math.abs(p[0] - prev[0]) + Math.abs(p[1] - prev[1]); if (dragMoved > 6) { MapView.pan(p[0] - prev[0], p[1] - prev[1]); cv.classList.add('drag'); } }
      else if (ptrs.size === 2) { ptrs.set(e.pointerId, p); const [a, b] = [...ptrs.values()]; const d = Math.hypot(a[0] - b[0], a[1] - b[1]); if (pinch0) MapView.zoomAt((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, d / pinch0); pinch0 = d; dragMoved = 99; return; }
      ptrs.set(e.pointerId, p);
    } else if (e.pointerType === 'mouse') {
      const h = MapView.hitTest(p[0], p[1]); MapView.setHover(h);
      cv.style.cursor = st && MapView.hitBubble(p[0], p[1], st) ? 'pointer' : '';
      if (MapView.selected < 0) { if (h >= 0) showTip(h); else hideTip(); }
    }
  });
  const endPtr = e => { ptrs.delete(e.pointerId); cv.classList.remove('drag'); pinch0 = 0; };
  cv.addEventListener('pointerup', e => {
    const wasClick = dragMoved <= 6 && ptrs.size === 1; endPtr(e);
    if (wasClick) {
      const [x, y] = local(e), h = MapView.hitTest(x, y);
      if (h === MapView.selected || h < 0) { MapView.setSelected(-1); hideTip(); } else { MapView.setSelected(h); showTip(h); }
    }
  });
  cv.addEventListener('pointercancel', endPtr);
  cv.addEventListener('pointerleave', e => { if (e.pointerType === 'mouse') { MapView.setHover(-1); if (MapView.selected < 0) hideTip(); } });
  cv.addEventListener('wheel', e => { e.preventDefault(); const [x, y] = local(e); MapView.zoomAt(x, y, Math.exp(-e.deltaY * 0.0015)); }, { passive: false });
  $('zin').addEventListener('click', () => { const [w, h] = MapView.size; MapView.zoomAt(w / 2, h / 2, 1.5); });
  $('zout').addEventListener('click', () => { const [w, h] = MapView.size; MapView.zoomAt(w / 2, h / 2, 1 / 1.5); });
  $('zfit').addEventListener('click', () => MapView.fit());
  window.addEventListener('resize', () => { MapView.resize(); });

  window.addEventListener('keydown', e => {
    if (trOpen()) { if (e.key === 'Escape') { e.preventDefault(); closeTrophies(); } return; }
    const how = $('howToPlayText'); if (how && !how.classList.contains('hidden')) { if (e.key === 'Escape') { e.preventDefault(); $('closeHowToPlay').click(); } return; }
    if (brkOpen()) { if (e.key === 'Escape' || e.key === 'Enter') { e.preventDefault(); closeBreak(); } return; }
    if (/INPUT|SELECT|TEXTAREA/.test(e.target.tagName) || e.ctrlKey || e.metaKey) return;
    if (e.key === ' ') { e.preventDefault(); setSpeed(userPaused ? 1 : 0); }
    else if (e.key === '1' || e.key === '2' || e.key === '3') setSpeed(+e.key);
    else if (e.key === 'e' || e.key === 'E') toggleDrawer();
    else if (e.key === 's' || e.key === 'S') doSabotage();
    else if (e.key === 'm' || e.key === 'M') { Sound.setMuted(!Sound.muted); updSndBtn(); }
    else if (e.key === 'Escape') { toggleDrawer(false); MapView.setSelected(-1); hideTip(); }
  });

  // ---------- screens ----------
  const regionOptions = () => REGIONS.slice().sort((a, b) => a.name.localeCompare(b.name)).map(r => '<option value="' + r.id + '">' + esc(r.name) + ' (' + r.climate + ')</option>').join('');
  function settingsHTML() {
    return '<div class="row"><button id="sSnd">Sound: ' + (Sound.muted ? 'off' : 'on') + '</button><button id="sCb">Colorblind palette: ' + (document.documentElement.dataset.cb === '1' ? 'on' : 'off') + '</button></div>' +
      '<div class="row"><label>Volume<input id="sVol" type="range" min="0" max="100" value="' + Math.round(Sound.volume * 100) + '"></label>' +
      '<label>Breaking news<select id="sBrk"><option value="all">All interrupts</option><option value="miles">Milestones only</option><option value="off">Off (ticker only)</option></select></label></div>';
  }
  function wireSettings(root) {
    const q = id => root.querySelector('#' + id);
    q('sSnd').onclick = () => { Sound.unlock(); Sound.setMuted(!Sound.muted); q('sSnd').textContent = 'Sound: ' + (Sound.muted ? 'off' : 'on'); updSndBtn(); };
    q('sCb').onclick = () => toggleCb(q('sCb'));
    q('sVol').oninput = e => Sound.setVolume(e.target.value / 100);
    q('sBrk').value = brkMode; q('sBrk').onchange = e => { brkMode = e.target.value; store.set(BRK_KEY, brkMode); };
  }
  function showStart() {
    const saved = load();
    const ov = $('startOv'); ov.classList.remove('hidden'); $('app').classList.add('onstart');
    ov.innerHTML = '<div class="modal start"><h2>OUTBREAK PROTOCOL</h2>' +
      '<button id="howToPlayBtn" class="linkBtn" aria-expanded="false" aria-controls="howToPlayText">HOW TO PLAY</button>' +
      '<div id="howToPlayText" class="howBox hidden" role="dialog" aria-label="How to play">' +
        '<div class="howHead"><strong>How to Play</strong><button id="closeHowToPlay" class="howX" aria-label="Close how to play">&#10005;</button></div>' +
        '<p>Name your pathogen and pick where it begins. Click the DNA bubbles that pop up on infected regions, then evolve to spread, hide or kill. Sabotage the cure before humanity finishes it. Infect everyone to win. If the cure reaches 100%, you lose. Climate matters: a cold start needs cold resistance, a hot one needs heat resistance.</p>' +
      '</div>' +
      '<div class="row"><label>Pathogen name<input id="pName" maxlength="24" value="Nightfall"></label>' +
      '<label>Patient zero<select id="pStart"><option value="">Random</option>' + regionOptions() + '</select></label></div>' +
      '<label>Seed (optional, same seed = same game)<input id="pSeed" inputmode="numeric" placeholder="e.g. 2027"></label>' +
      '<div class="row"><button class="primary" id="goBtn">Start outbreak</button><button id="dailyBtn">Daily challenge</button></div>' +
      (saved ? '<button id="contBtn">Continue saved game · day ' + saved.day + '</button>' : '') +
      '<button id="trBtn"></button>' +
      (prof.games ? '<p>' + prof.games + ' game' + (prof.games === 1 ? '' : 's') + ' played · ' + prof.wins + ' won' + (prof.fastestWin ? ' · fastest win ' + prof.fastestWin + ' days' : '') + (prof.bestRating >= 0 ? ' · best rating: ' + esc(RATINGS[prof.bestRating].name) : '') + '</p>' : '') +
      '<details class="setBox"><summary>Settings</summary>' + settingsHTML() + '</details>' +
      '<footer class="credit">Fictional pathogen, simplified world model. Country figures are rounded approximations. Headlines are satire of systems and habits, not of real people.</footer></div>';
    wireSettings(ov); refreshTrBtn();
    const setHow = show => {
      $('howToPlayText').classList.toggle('hidden', !show);
      $('howToPlayBtn').setAttribute('aria-expanded', show ? 'true' : 'false');
      if (show) { ov.scrollTop = 0; $('closeHowToPlay').focus(); } else $('howToPlayBtn').focus();
    };
    $('howToPlayBtn').onclick = () => setHow($('howToPlayText').classList.contains('hidden'));
    $('closeHowToPlay').onclick = () => setHow(false);
    $('trBtn').onclick = showTrophies;
    $('goBtn').onclick = () => {
      const s = $('pSeed').value.trim(), seed = s ? (parseInt(s, 10) || hashStr(s)) : (Math.random() * 2 ** 31) | 0;
      begin($('pStart').value || REGIONS[Math.floor(Math.random() * REGIONS.length)].id, seed, $('pName').value);
    };
    $('dailyBtn').onclick = () => {
      const d = new Date(), seed = d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
      begin(REGIONS[seed % REGIONS.length].id, seed, $('pName').value, true);
    };
    if (saved) $('contBtn').onclick = () => { st = saved; resume(false); };
  }
  function hashStr(s) { let h = 7; for (const c of s) h = (h * 31 + c.charCodeAt(0)) | 0; return h; }
  function toggleCb(btn) {
    const on = document.documentElement.dataset.cb !== '1';
    document.documentElement.dataset.cb = on ? '1' : '0'; store.set(CB_KEY, on ? '1' : '0'); MapView.refreshPalette();
    if (btn) btn.textContent = 'Colorblind palette: ' + (on ? 'on' : 'off');
  }
  function begin(startId, seed, name, daily) {
    st = newGame(startId, seed, (name || 'Pathogen').trim().slice(0, 24) || 'Pathogen');
    if (daily) st.daily = true;
    store.del(SAVE_KEY); resume(true);
  }
  function resume(fresh) {
    $('startOv').classList.add('hidden'); $('startOv').innerHTML = ''; $('app').classList.remove('onstart'); $('endOv').classList.add('hidden'); $('menuOv').classList.add('hidden'); $('brkOv').classList.add('hidden');
    acc = 0; last = performance.now(); lastSave = st.day; newsShown = fresh ? 0 : st.news.length; bubbleHinted = !fresh;
    MapView.setSelected(-1); hideTip(); setSpeed(1); toggleDrawer(false); hud();
    if (fresh) MapView.fit();
    if (st.brk) openBreak();
  }
  function finish() {
    store.del(SAVE_KEY);
    const t = totals(st), won = st.over === 'win', ri = ratingIndex(st), R = RATINGS[ri];
    // Update the saved profile: counts, rating history, records, recent runs, then trophies.
    prof.games++; if (won) prof.wins++;
    prof.ratings[R.id] = (prof.ratings[R.id] || 0) + 1;
    const newBest = ri > prof.bestRating; if (newBest) prof.bestRating = ri;
    const newRecord = won && (!prof.fastestWin || st.day < prof.fastestWin); if (newRecord) prof.fastestWin = st.day;
    prof.recent.unshift({ t: Date.now(), r: ri, o: st.over, day: st.day, dead: +(t.D / t.pop).toFixed(4), name: st.name }); prof.recent = prof.recent.slice(0, 10);
    const fresh = unlockNew('end'); saveProfile();
    Sound.play(won ? 'win' : 'lose'); if (fresh.length) setTimeout(() => Sound.play('trophy'), 1100);
    const title = won ? 'HUMANITY ENDED' : st.over === 'burnout' ? 'PATHOGEN BURNED OUT' : 'CURE DEPLOYED';
    const msg = won ? esc(st.name) + ' reached every living person.' : st.over === 'burnout' ? 'Not enough hosts remained to keep ' + esc(st.name) + ' alive.' : 'Humanity developed a cure for ' + esc(st.name) + '.';
    const ov = $('endOv'); ov.classList.remove('hidden');
    ov.innerHTML = '<div class="modal"><h2 style="color:' + (won ? 'var(--inf)' : 'var(--cure)') + '">' + title + '</h2><p>' + msg + '</p>' +
      '<div class="rate"><span class="ricon">' + R.icon + '</span><div><small>Pandemic rating</small><b>' + esc(R.name) + '</b><span class="bl">' + esc(R.blurb) + '</span></div>' + (newBest ? '<span class="nb">NEW BEST</span>' : '') + '</div>' +
      '<div class="stats"><div class="stat"><small>Days</small><b>' + st.day + (newRecord ? ' · fastest win!' : '') + '</b></div>' +
      '<div class="stat"><small>Dead</small><b>' + fmt(t.D) + ' (' + (t.D / t.pop * 100).toFixed(1) + '%)</b></div><div class="stat"><small>Regions infected</small><b>' + t.regions + ' / ' + REGIONS.length + '</b></div>' +
      '<div class="stat"><small>Cure progress</small><b>' + st.cure.toFixed(0) + '%</b></div><div class="stat"><small>Sabotages</small><b>' + st.sabCount + '</b></div>' +
      '<div class="stat"><small>DNA bubbles caught</small><b>' + st.bubGot + ' / ' + st.bubMade + '</b></div><div class="stat"><small>Breaking news seen</small><b>' + (st.brkSeen || 0) + '</b></div>' +
      '<div class="stat"><small>Trophies</small><b>' + trophyCount() + ' / ' + TROPHIES.length + '</b></div></div>' +
      (fresh.length ? '<div class="newTroph"><small>New trophies</small>' + fresh.map(id => '<span title="' + esc(TROPHY_INDEX[id].desc) + '">' + TROPHY_INDEX[id].icon + ' ' + esc(TROPHY_INDEX[id].name) + '</span>').join('') + '</div>' : '') +
      '<div class="row"><button class="primary" id="againBtn">Play again</button><button id="trBtn2">&#127942; Trophy Room</button></div></div>';
    $('againBtn').onclick = () => { $('endOv').classList.add('hidden'); showStart(); };
    $('trBtn2').onclick = showTrophies;
  }

  // ---------- trophy room ----------
  const pct = x => +(x * 100).toFixed(1) + '%';
  function refreshTrBtn() { const b = $('trBtn'); if (b) b.innerHTML = '&#127942; Trophy Room (' + trophyCount() + '/' + TROPHIES.length + ')'; }
  const encodeProfile = () => 'OP1:' + btoa(unescape(encodeURIComponent(JSON.stringify(prof))));
  function decodeProfile(s) {
    s = String(s || '').replace(/\s+/g, ''); if (s.indexOf('OP1:') === 0) s = s.slice(4);
    try { return cleanProfile(JSON.parse(decodeURIComponent(escape(atob(s))))); } catch (e) { return null; }
  }
  function showTrophies() {
    const ov = $('trophyOv'); ov.classList.remove('hidden');
    const OUT = { win: 'Won', lose: 'Cured', burnout: 'Burned out' };
    const rate = RATINGS.map((r, i) => {
      const n = prof.ratings[r.id] || 0, lo = i ? RATINGS[i - 1].max : 0;
      const range = i === 0 ? 'under ' + pct(r.max) + ' dead' : i === RATINGS.length - 1 ? pct(lo) + '+ dead' : pct(lo) + ' to ' + pct(r.max) + ' dead';
      return '<div class="rchip' + (n ? ' got' : '') + '"><span class="ri">' + r.icon + '</span><b>' + esc(r.name) + '</b><small>' + range + '</small><small>' + (n ? '&times;' + n + (i === prof.bestRating ? ' · best so far' : '') : 'not yet') + '</small></div>';
    }).join('');
    const cats = TROPHY_CATS.map(c => {
      const list = TROPHIES.filter(t => t.cat === c), have = list.filter(t => prof.trophies[t.id]).length;
      return '<h3>' + c + '<small>' + have + '/' + list.length + '</small></h3><div class="tgrid">' + list.map(t => {
        const g = prof.trophies[t.id];
        return '<div class="tcard' + (g ? ' got' : '') + '" data-id="' + t.id + '"><span class="ticon">' + (g ? t.icon : '&#128274;') + '</span><div><b>' + esc(t.name) + '</b><p>' + esc(t.desc) + '</p>' + (g ? '<small>Unlocked' + (g.t ? ' ' + new Date(g.t).toLocaleDateString() : '') + '</small>' : '') + '</div></div>';
      }).join('') + '</div>';
    }).join('');
    const recent = prof.recent.length ? '<h3>Recent runs</h3><div class="recent">' + prof.recent.map(x => '<div>' + new Date(x.t).toLocaleDateString() + ' · ' + esc(x.name) + ' · ' + esc(RATINGS[x.r].name) + ' · ' + (OUT[x.o] || esc(x.o)) + ' on day ' + x.day + ' · ' + pct(x.dead) + ' dead</div>').join('') + '</div>' : '';
    ov.innerHTML = '<div class="modal tr" role="dialog" aria-modal="true" aria-label="Trophy Room"><header><h2>&#127942; Trophy Room</h2><button id="trClose" aria-label="Close">&times; Close</button></header>' +
      '<div class="stats"><div class="stat"><small>Games played</small><b>' + prof.games + '</b></div><div class="stat"><small>Wins</small><b>' + prof.wins + '</b></div>' +
      '<div class="stat"><small>Fastest win</small><b>' + (prof.fastestWin ? prof.fastestWin + ' days' : 'none yet') + '</b></div>' +
      '<div class="stat"><small>Trophies</small><b>' + trophyCount() + ' / ' + TROPHIES.length + '</b></div></div>' +
      '<h3>Pandemic ratings</h3><div class="rgrid">' + rate + '</div>' + cats + recent +
      '<details><summary>Back up or move your progress</summary><p>Your trophies and records are saved in this browser only. Copy this code somewhere safe, or paste a code from another browser or device and press Load. Loading never removes progress you already have.</p>' +
      '<textarea id="trCode" rows="3" spellcheck="false" aria-label="Backup code"></textarea><div class="row"><button id="trCopy">Copy code</button><button id="trLoad">Load code</button></div><p id="trMsg" role="status"></p></details></div>';
    $('trCode').value = encodeProfile();
    $('trClose').onclick = closeTrophies; $('trClose').focus();
    $('trCopy').onclick = () => {
      const ta = $('trCode'), done = () => { $('trMsg').textContent = 'Copied.'; };
      ta.select();
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(ta.value).then(done, () => { try { document.execCommand('copy'); done(); } catch (e) {} });
      else { try { document.execCommand('copy'); done(); } catch (e) {} }
    };
    $('trLoad').onclick = () => {
      const p = decodeProfile($('trCode').value);
      if (!p) { $('trMsg').textContent = 'That code could not be read. Paste the whole code, including the OP1: start.'; return; }
      prof = mergeProfile(prof, p); saveProfile(); showTrophies();
      $('trMsg').textContent = 'Loaded. You now have ' + trophyCount() + ' trophies.'; $('trCode').value = encodeProfile();
      const d = ov.querySelector('details'); if (d) d.open = true;
    };
  }
  function closeTrophies() {
    $('trophyOv').classList.add('hidden'); $('trophyOv').innerHTML = '';
    refreshTrBtn(); last = performance.now(); acc = 0;
  }
  $('trophyBtn').addEventListener('click', () => { if (!brkOpen()) showTrophies(); });
  $('menuBtn').addEventListener('click', () => {
    const ov = $('menuOv'); ov.classList.remove('hidden');
    ov.innerHTML = '<div class="modal"><h2>Paused</h2><div class="row"><button class="primary" id="mResume">Resume</button><button id="mNew">New game</button></div>' + settingsHTML() +
      '<p>Keys: Space pause · 1/2/3 speed · E evolve · S sabotage · M mute · scroll or pinch to zoom · drag to pan · click a region for details · click DNA bubbles to collect.</p></div>';
    wireSettings(ov);
    $('mResume').onclick = () => { ov.classList.add('hidden'); last = performance.now(); };
    $('mNew').onclick = () => { ov.classList.add('hidden'); save(); showStart(); };
  });

  // ---------- boot ----------
  if (store.get(CB_KEY) === '1') document.documentElement.dataset.cb = '1';
  updSndBtn();
  MapView.resize(); MapView.fit();
  showStart(); requestAnimationFrame(frame);
  window.__game = { get st() { return st; }, begin, step: () => { if (st) tick(); }, setSpeed, collect: id => { const [x, y] = MapView.bubbleXY(st.bubbles.find(b => b.id === id)); collect(id, x, y); }, closeBreak, openBreak, get blocked() { return blocked(); }, get prof() { return prof; }, showTrophies, closeTrophies, checkLive, encodeProfile, decodeProfile };
})();
