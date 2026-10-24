// Simulation engine: pure logic, no DOM. One step() = one in-game day.
// All balance numbers live in TUNE so they are easy to adjust (and to test with the bot).
const TUNE = Object.assign({
  beta: 0.05,       // base spread rate inside a region
  upScale: 0.3,     // how strongly transmission upgrades add to beta
  cmCold: 0.5,      // cold regions: spread multiplier with no cold resistance (1.0 with full resistance)
  cmHot: 0.6,       // hot regions: same idea for heat
  land: 1.1, air: 2.4, sea: 1.6, // travel seeding strength
  cure: 0.0075,     // cure research speed
  passive: 0.04,    // tiny passive DNA per day. Bubbles are the real income.
  bubBase: 0.07, bubPerRegion: 0.008, bubMax: 0.4, bubLife: 18, bubCap: 8, goldChance: 0.1, bubVal: 2, goldVal: 9,
  alert: 3,         // once some regions detect the disease, the rest notice faster (x1 .. x1+alert)
  panic: 60, panicMax: 1.2, // cure speeds up as deaths rise: x(1 + min(panicMax, dead% * panic))
  det: 0.0016,      // detection sensitivity
  brkGap: 18,       // min days between breaking-news interrupts
  startPts: 10,
}, (typeof __TUNE !== 'undefined') ? __TUNE : {});

const UPGRADES = [
  // Transmission
  { id:'cough',  g:'Transmission', n:'Coughing',        cost:9,  tra:.06, desc:'A classic. Nobody covers their mouth anymore.' },
  { id:'sneeze', g:'Transmission', n:'Sneezing',        cost:15, tra:.08, req:'cough', desc:'Aerosolized fun for the whole bus.' },
  { id:'air',    g:'Transmission', n:'Airborne',        cost:24, tra:.10, air:.9, req:'sneeze', desc:'Rides on flights. Free upgrade, no baggage fee.' },
  { id:'water',  g:'Transmission', n:'Water-borne',     cost:14, tra:.04, sea:.9, desc:'Hitches a ride on cargo ships and suspicious ice machines.' },
  { id:'vector', g:'Transmission', n:'Insect vectors',  cost:17, vec:.12, desc:'Mosquitoes finally have a purpose besides ruining picnics. Hot regions.' },
  { id:'rodent', g:'Transmission', n:'Rodent hosts',    cost:15, tra:.04, land:.7, desc:'Rats: underpaid, overqualified, excellent at travel. Land borders.' },
  { id:'blood',  g:'Transmission', n:'Blood contact',   cost:21, tra:.07, land:.3, req:'rodent', desc:'For when coughing feels too impersonal.' },
  // Symptoms
  { id:'rash',   g:'Symptoms',     n:'Rash',            cost:8,  sev:.25, desc:'Mild. Everyone blames the new laundry detergent.' },
  { id:'fever',  g:'Symptoms',     n:'Fever',           cost:14, sev:.5, tra:.03, desc:'People take sick days, briefly. Then work from bed.' },
  { id:'nausea', g:'Symptoms',     n:'Nausea',          cost:12, sev:.4, tra:.03, desc:'Blamed on the gas station sushi.' },
  { id:'pneu',   g:'Symptoms',     n:'Pneumonia',       cost:18, sev:.6, let:.0012, req:'cough', desc:'Things get serious. The group chat goes quiet.' },
  { id:'hemo',   g:'Symptoms',     n:'Hemorrhaging',    cost:27, sev:1.1, let:.0022, req:'fever', desc:'Deadly, and impossible to hide. Even from HR.' },
  { id:'organ',  g:'Symptoms',     n:'Organ failure',   cost:38, sev:1.3, let:.0036, req:'pneu', desc:'Very lethal. Governments finally hold a meeting that matters.' },
  { id:'necro',  g:'Symptoms',     n:'Total necrosis',  cost:48, sev:1.6, let:.0055, req:'organ', desc:'Maximum lethality. Your pathogen has stopped asking permission.' },
  // Abilities
  { id:'heat1',  g:'Abilities',    n:'Heat resistance I',   cost:15, hot:.5, desc:'Fewer penalties in hot regions. Sunscreen not included.' },
  { id:'heat2',  g:'Abilities',    n:'Heat resistance II',  cost:24, hot:.5, req:'heat1', desc:'Thrives in the tropics. Loves a humid Tuesday.' },
  { id:'cold1',  g:'Abilities',    n:'Cold resistance I',   cost:15, cold:.5, desc:'Fewer penalties in cold regions. Unbothered by office thermostats.' },
  { id:'cold2',  g:'Abilities',    n:'Cold resistance II',  cost:24, cold:.5, req:'cold1', desc:'Full spread in the cold. Winter becomes a minor inconvenience.' },
  { id:'stealth',g:'Abilities',    n:'Asymptomatic phase',  cost:23, stealth:.45, desc:'Spreads quietly, like a Slack channel you muted.' },
  { id:'drug1',  g:'Abilities',    n:'Drug resistance I',   cost:21, res:.5, desc:'The cure labs groan. Again.' },
  { id:'drug2',  g:'Abilities',    n:'Drug resistance II',  cost:36, res:.7, req:'drug1', desc:'Researchers switch to a stronger coffee.' },
  { id:'gene',   g:'Abilities',    n:'Genetic hardening',   cost:45, res:1.0, req:'drug2', desc:'Cure research now needs "a new strategy" and a bigger budget.' },
];
const UP_INDEX = {}; UPGRADES.forEach(u => UP_INDEX[u.id] = u);

const SAB_COST = 18, SAB_COOLDOWN = 24, SAB_SLOW_DAYS = 18, SAB_SETBACK = 4;
const MAX_DAYS = 2500;

function rnd(st) {
  st.seed = (st.seed + 0x6D2B79F5) | 0;
  let t = Math.imul(st.seed ^ (st.seed >>> 15), 1 | st.seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

function computeDerived(st) {
  const d = { tra:0, vec:0, air:0, sea:0, land:0, sev:0, let:0, hot:0, cold:0, stealthUp:0, res:0 };
  for (const id of st.owned) {
    const u = UP_INDEX[id];
    d.tra += (u.tra || 0) * TUNE.upScale; d.vec += (u.vec || 0) * TUNE.upScale; d.air += u.air || 0; d.sea += u.sea || 0;
    d.land += u.land || 0; d.sev += u.sev || 0; d.let += u.let || 0;
    d.hot += u.hot || 0; d.cold += u.cold || 0; d.stealthUp += u.stealth || 0; d.res += u.res || 0;
  }
  d.hot = Math.min(1, d.hot); d.cold = Math.min(1, d.cold);
  d.stealth = Math.max(0.3, 1 - d.stealthUp);
  st.d = d;
}

// How well the pathogen spreads in a region's climate right now (1 = no penalty).
function climateMult(st, i) {
  const c = REGIONS[i].climate, d = st.d;
  if (c === 'hot') return TUNE.cmHot + (1 - TUNE.cmHot) * d.hot;
  if (c === 'cold') return TUNE.cmCold + (1 - TUNE.cmCold) * d.cold;
  return 1;
}

function newGame(startId, seed, name) {
  const n = REGIONS.length;
  const sd = (seed | 0) || 12345;
  const st = {
    v: 2, day: 0, seed: sd, ts: (sd ^ 0x9E3779B9) >>> 0, start: startId, name: (name || 'Pathogen'),
    S: new Array(n), I: new Array(n).fill(0), D: new Array(n).fill(0),
    aware: new Array(n).fill(-1), lock: new Array(n).fill(false),
    cb: new Array(n).fill(false), ca: new Array(n).fill(false), cs: new Array(n).fill(false),
    seen: new Array(n).fill(false), dead1: new Array(n).fill(false),
    pts: TUNE.startPts, owned: [], cure: 0, sabCd: 0, sabLeft: 0, sabCount: 0,
    bubbles: [], bseq: 0, bubMade: 0, bubGot: 0, dnaGot: 0,
    mil: {}, hinted: {}, bq: [], brk: null, lastBrk: -99, brkCount: 0, nextRand: 70, usedBrk: [],
    news: [], fx: [], over: null, peakInf: 0,
  };
  REGIONS.forEach((r, i) => { st.S[i] = r.pop * 1e6; });
  const s = REGION_INDEX[startId];
  st.S[s] -= 1; st.I[s] = 1; st.seen[s] = true;
  computeDerived(st);
  pushNews(st, tline(st, 'zero', { r: REGIONS[s].name }), 'info');
  return st;
}

function pushNews(st, text, kind) {
  st.news.push({ day: st.day, text, kind: kind || 'info' });
  if (st.news.length > 80) st.news.shift();
}
// Queue a breaking-news interrupt. Milestones fire once; the queue is capped so they never pile up.
function qBreak(st, type, v) {
  if (type !== 'random' && st.mil[type]) return;
  if (st.bq.length >= 3) return;
  const b = makeBreak(st, type, v);
  if (b) { st.bq.push(b); if (type !== 'random') st.mil[type] = true; }
}

function totals(st) {
  let pop = 0, S = 0, I = 0, D = 0, regions = 0, aware = 0;
  for (let i = 0; i < REGIONS.length; i++) {
    pop += REGIONS[i].pop * 1e6; S += st.S[i]; I += st.I[i]; D += st.D[i];
    if (st.I[i] >= 1 || st.D[i] >= 1) regions++;
    if (st.aware[i] >= 0) aware++;
  }
  return { pop, S, I, D, regions, aware };
}

function canBuy(st, id) {
  const u = UP_INDEX[id];
  if (!u || st.owned.includes(id) || st.pts < u.cost) return false;
  return !u.req || st.owned.includes(u.req);
}
function buyUpgrade(st, id) {
  if (!canBuy(st, id)) return false;
  st.pts -= UP_INDEX[id].cost; st.owned.push(id); computeDerived(st); return true;
}
function canSabotage(st) { return !st.over && st.pts >= SAB_COST && st.sabCd <= 0; }
function sabotage(st) {
  if (!canSabotage(st)) return false;
  st.pts -= SAB_COST; st.sabCd = SAB_COOLDOWN; st.sabLeft = SAB_SLOW_DAYS; st.sabCount++;
  st.cure = Math.max(0, st.cure - SAB_SETBACK);
  pushNews(st, tline(st, 'sab', {}), 'sab');
  qBreak(st, 'sab1', {});
  return true;
}

// ---- DNA bubbles: the main DNA income. They pop up on infected regions and vanish if ignored. ----
function spawnBubble(st) {
  const live = [];
  for (let i = 0; i < REGIONS.length; i++) if (st.I[i] >= 1) live.push(i);
  if (!live.length) return;
  let tot = 0; const w = live.map(i => { const x = 1 + Math.log10(st.I[i] + 1); tot += x; return x; });
  let x = rnd(st) * tot, pick = live[0];
  for (let k = 0; k < live.length; k++) { x -= w[k]; if (x <= 0) { pick = live[k]; break; } }
  const gold = rnd(st) < TUNE.goldChance;
  // Where inside the region: a point on the line from its centre toward one outline vertex. Try a few spots and prefer one that is not
  // sitting on top of another bubble (so every bubble can be seen and clicked).
  const poly = REGIONS[pick].polys[0], c = REGIONS[pick].c;
  const spot = (vi, t) => { const v = poly[vi % poly.length]; return [c[0] + (v[0] - c[0]) * t, c[1] + (v[1] - c[1]) * t]; };
  let vi = 0, t = 0;
  for (let tries = 0; tries < 6; tries++) {
    vi = Math.floor(rnd(st) * 1000); t = 0.15 + rnd(st) * 0.45;
    const [x, y] = spot(vi, t);
    if (!st.bubbles.some(b => { const [bx, by] = spot(b.vi, b.t); return b.r === pick && Math.hypot(bx - x, by - y) < 6; })) break;
  }
  st.bubbles.push({ id: ++st.bseq, r: pick, vi, t,
    born: st.day, life: gold ? 11 : TUNE.bubLife, val: gold ? TUNE.goldVal : TUNE.bubVal + Math.floor(rnd(st) * 3), gold });
  st.bubMade++;
}
function collectBubble(st, id) {
  const k = st.bubbles.findIndex(b => b.id === id);
  if (k < 0 || st.over) return 0;
  const b = st.bubbles[k]; st.bubbles.splice(k, 1);
  st.pts += b.val; st.bubGot++; st.dnaGot += b.val; if (b.gold) st.goldGot = (st.goldGot || 0) + 1;
  return b.val;
}

function seedInfection(st, j, why, from) {
  if (st.S[j] < 1) return;
  if (from !== undefined) { st.fx.push([from, j, why]); if (st.fx.length > 40) st.fx.shift(); }
  st.S[j] -= 1; st.I[j] += 1;
  if (!st.seen[j]) {
    st.seen[j] = true; st.pts += 1;
    pushNews(st, tline(st, why === 'by air' ? 'air' : why === 'by sea' ? 'sea' : 'land', { r: REGIONS[j].name }), 'spread');
  }
}

function pickWeighted(st, key, exceptI, closedArr) {
  let tot = 0;
  for (let j = 0; j < REGIONS.length; j++) if (j !== exceptI && !closedArr[j]) tot += REGIONS[j][key] + 0.05;
  if (tot <= 0) return -1;
  let x = rnd(st) * tot;
  for (let j = 0; j < REGIONS.length; j++) {
    if (j === exceptI || closedArr[j]) continue;
    x -= REGIONS[j][key] + 0.05;
    if (x <= 0) return j;
  }
  return -1;
}

function step(st) {
  if (st.over) return;
  const d = st.d, n = REGIONS.length;
  // 1) local spread and deaths
  for (let i = 0; i < n; i++) {
    const r = REGIONS[i], pop = r.pop * 1e6;
    let I = st.I[i], S = st.S[i];
    if (I <= 0) continue;
    const cm = climateMult(st, i), vec = r.climate === 'hot' ? d.vec : 0;
    const wm = 1.18 - 0.35 * r.wealth;
    const beta = (TUNE.beta + d.tra + vec) * cm * wm * (st.lock[i] ? 0.72 : 1);
    let ni = Math.min(S, beta * I * (S / pop));
    const agef = Math.max(0.4, Math.min(2, Math.pow(r.age / 38, 1.5)));
    const hcf = 1.25 - 0.55 * r.wealth;
    let dd = Math.min(I, I * d.let * agef * hcf);
    st.S[i] = S - ni; st.I[i] = I + ni - dd; st.D[i] += dd;
    if (dd >= 1 && !st.dead1[i]) {
      st.dead1[i] = true; st.pts += 1;
      pushNews(st, tline(st, 'death', { r: r.name }), 'death');
      qBreak(st, 'death1', { r: r.name });
    }
    // one-time hint when climate is clearly holding the pathogen back
    if (st.I[i] >= 1 && st.day >= 8 && cm < 0.75 && !st.hinted[r.climate]) {
      st.hinted[r.climate] = 1;
      pushNews(st, tline(st, r.climate === 'cold' ? 'hintCold' : 'hintHot', { r: r.name }), 'hint');
    }
  }
  // 2) travel seeding (land, air, sea)
  for (let i = 0; i < n; i++) {
    const r = REGIONS[i], pop = r.pop * 1e6;
    if (st.I[i] < 1) continue;
    const x = Math.sqrt(st.I[i] / pop);
    if (!st.cb[i]) {
      for (const j of r.nbi) {
        if (st.cb[j] || st.I[j] >= 1) continue;
        const p = 1 - Math.exp(-TUNE.land * (1 + d.land) * x);
        if (rnd(st) < p) seedInfection(st, j, 'by land', i);
      }
    }
    if (!st.ca[i] && r.air > 0) {
      let ev = TUNE.air * (r.air / 10) * (1 + d.air) * x;
      while (ev > 0) { if (rnd(st) < Math.min(1, ev)) { const j = pickWeighted(st, 'air', i, st.ca); if (j >= 0) seedInfection(st, j, 'by air', i); } ev -= 1; }
    }
    if (!st.cs[i] && r.sea > 0) {
      let ev = TUNE.sea * (r.sea / 10) * (1 + d.sea) * x;
      while (ev > 0) { if (rnd(st) < Math.min(1, ev)) { const j = pickWeighted(st, 'sea', i, st.cs); if (j >= 0) seedInfection(st, j, 'by sea', i); } ev -= 1; }
    }
  }
  // 3) detection, closures
  let nInf = 0, nAw = 0;
  for (let i = 0; i < n; i++) { if (st.I[i] >= 1) nInf++; if (st.aware[i] >= 0) nAw++; }
  const alertMul = 1 + TUNE.alert * (nAw / Math.max(1, nInf));
  for (let i = 0; i < n; i++) {
    const r = REGIONS[i], pop = r.pop * 1e6;
    if (st.aware[i] < 0) {
      if (st.I[i] >= 1) {
        const sig = Math.sqrt(st.I[i]) * (d.sev + 0.35) + Math.sqrt(st.D[i]) * 1.5;
        const p = 1 - Math.exp(-TUNE.det * sig * (0.35 + r.wealth) * d.stealth * alertMul);
        if (rnd(st) < p) {
          st.aware[i] = st.day;
          pushNews(st, tline(st, 'detect', { r: r.name }), 'detect');
          qBreak(st, 'detect1', { r: r.name });
        }
      }
    } else {
      const threat = (st.I[i] / pop) * 8 + (st.D[i] / pop) * 120;
      const w = 0.4 + r.wealth;
      if (!st.cb[i] && r.nbi.length && threat > 0.01 && rnd(st) < 0.04 * w) { st.cb[i] = true; pushNews(st, tline(st, 'closeB', { r: r.name }), 'close'); qBreak(st, 'close1', { r: r.name }); }
      if (!st.ca[i] && threat > 0.02 && rnd(st) < 0.035 * w) { st.ca[i] = true; pushNews(st, tline(st, 'closeA', { r: r.name }), 'close'); qBreak(st, 'close1', { r: r.name }); }
      if (!st.cs[i] && threat > 0.03 && rnd(st) < 0.03 * w) { st.cs[i] = true; pushNews(st, tline(st, 'closeS', { r: r.name }), 'close'); qBreak(st, 'close1', { r: r.name }); }
      if (!st.lock[i] && threat > 0.04 && rnd(st) < 0.05 * (0.3 + r.wealth)) { st.lock[i] = true; pushNews(st, tline(st, 'lock', { r: r.name }), 'close'); qBreak(st, 'close1', { r: r.name }); }
    }
  }
  // 4) cure research
  let capT = 0, capA = 0;
  for (let i = 0; i < n; i++) {
    const r = REGIONS[i], c = Math.pow(0.05 + r.wealth, 1.2) * Math.sqrt(r.pop);
    capT += c; if (st.aware[i] >= 0) capA += c;
  }
  const share = capA / capT;
  let totD = 0, totP = 0;
  for (let i = 0; i < n; i++) { totD += st.D[i]; totP += REGIONS[i].pop * 1e6; }
  const panic = 1 + Math.min(TUNE.panicMax, (totD / totP) * TUNE.panic);
  let rate = Math.max(0, share - 0.05) * TUNE.cure * panic / (1 + 0.6 * d.res);
  if (st.sabLeft > 0) rate *= 0.35;
  const before = st.cure;
  st.cure = Math.min(100, st.cure + rate * 100);
  st.cureShare = share; st.cureRate = rate * 100;
  if (before < 25 && st.cure >= 25) pushNews(st, tline(st, 'cure25', {}), 'cure');
  if (before < 50 && st.cure >= 50) pushNews(st, tline(st, 'cure50', {}), 'cure');
  if (before < 75 && st.cure >= 75) pushNews(st, tline(st, 'cure75', {}), 'cure');
  if (st.sabCd > 0) st.sabCd--;
  if (st.sabLeft > 0) st.sabLeft--;
  // 5) DNA bubbles, tiny passive income, milestones, end checks
  const t = totals(st);
  st.pts += TUNE.passive;
  st.peakInf = Math.max(st.peakInf, t.I);
  st.bubbles = st.bubbles.filter(b => st.day - b.born < b.life);
  const p = Math.min(TUNE.bubMax, TUNE.bubBase + TUNE.bubPerRegion * t.regions);
  if (st.bubbles.length < TUNE.bubCap && (rnd(st) < p || (st.day === 3 && !st.bseq))) spawnBubble(st);
  st.day++;
  const MIL = [['inf_100k', t.I >= 1e5], ['inf_1b', t.I >= 1e9],
    ['dead_1m', t.D >= 1e6], ['dead_100m', t.D >= 1e8], ['dead_1b', t.D >= 1e9],
    ['cure25', st.cure >= 25], ['cure50', st.cure >= 50], ['cure75', st.cure >= 75],
    ['regions25', t.regions >= 25]];
  for (const [k, ok] of MIL) if (ok && !st.mil[k]) qBreak(st, k, {});
  if (st.day >= st.nextRand) { qBreak(st, 'random', {}); st.nextRand = st.day + 90 + Math.floor(tnext(st) * 50); }
  if (!st.brk && st.bq.length && st.day - st.lastBrk >= TUNE.brkGap) { st.brk = st.bq.shift(); st.lastBrk = st.day; st.brkCount++; }
  const reached = 1 - t.S / t.pop;
  if (reached >= 0.995) { st.over = 'win'; pushNews(st, tline(st, 'winEnd', {}), 'end'); }
  else if (st.cure >= 100) { st.over = 'lose'; pushNews(st, tline(st, 'loseEnd', {}), 'end'); }
  else if (t.I < 0.5) { st.over = 'burnout'; pushNews(st, tline(st, 'burnEnd', {}), 'end'); }
  else if (st.day >= MAX_DAYS) { st.over = 'lose'; }
}
