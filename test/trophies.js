// Unit tests for ratings, trophies and the saved profile (pure logic, no browser).
// Usage: node test/trophies.js
const fs = require('fs'), path = require('path');
const read = f => fs.readFileSync(path.join(__dirname, '../src', f), 'utf8');
const src = ['data.js', 'news.js', 'sim.js', 'trophies.js'].map(read).join('\n') +
  '; return {REGIONS,REGION_INDEX,newGame,step,totals,RATINGS,ratingIndex,rating,TROPHIES,TROPHY_CATS,TROPHY_INDEX,evalTrophies,newProfile,cleanProfile,mergeProfile};';
const G = new Function('__TUNE', src)({});
const { REGIONS, REGION_INDEX, newGame, totals, RATINGS, ratingIndex, TROPHIES, TROPHY_CATS, evalTrophies, newProfile, cleanProfile, mergeProfile } = G;

let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) pass++; else { fail++; console.log('FAIL  ' + msg); } };
const startIn = pred => REGIONS.find(pred).id;

// A finished game state with a given fraction dead (spread over all regions), everything else neutral.
function mk(o = {}) {
  const st = newGame(startIn(r => r.climate === 'temperate' && !r.island), 7, 'T');
  const pop = st.d ? null : null; void pop;
  st.over = o.over === undefined ? 'win' : o.over;
  const dead = o.dead === undefined ? 0.5 : o.dead, reach = o.reach === undefined ? 1 : o.reach;
  REGIONS.forEach((r, i) => {
    const P = r.pop * 1e6;
    st.D[i] = P * dead; st.I[i] = P * Math.max(0, reach - dead) * 0.5; st.S[i] = P * (1 - dead) - st.I[i];
    if (st.R) st.R[i] = 0;
    if (reach === 0) { st.D[i] = 0; st.I[i] = 0; st.S[i] = P; }
  });
  Object.assign(st, o.set || {});
  return st;
}
const fixReach = (st, reach) => { REGIONS.forEach((r, i) => { const Pp = r.pop * 1e6; st.D[i] = 0; st.I[i] = Pp * reach; st.S[i] = Pp * (1 - reach); }); return st; };
const P = (o = {}) => Object.assign(newProfile(), o);
const earned = (st, prof, phase = 'end') => evalTrophies(st, prof, phase);
const has = (st, prof, id, phase) => earned(st, prof, phase).includes(id);

// ---- ratings ----
{
  const idx = f => ratingIndex(mk({ dead: f }));
  ok(idx(0.001) === 0 && RATINGS[idx(0.001)].name === 'Barely a Cough', 'rating 0.1% dead = Barely a Cough');
  ok(idx(0.01) === 1 && RATINGS[1].name === 'Silent Pandemic', 'rating 1% = Silent Pandemic');
  ok(idx(0.03) === 2 && RATINGS[2].name === 'Deadly Pandemic', 'rating 3% = Deadly Pandemic');
  ok(idx(0.05) === 3, 'rating 5% = Global Catastrophe');
  ok(idx(0.08) === 4, 'rating 8% = Civilization Collapse');
  ok(idx(0.12) === 4, 'rating 12% = Civilization Collapse');
  ok(idx(0.2) === 5 && idx(1.0) === 5, 'rating 20% and 100% = Apocalypse');
  ok(idx(0.0029) === 0 && idx(0.0031) === 1, 'rating boundary at 0.3%');
  ok(RATINGS.every((r, i) => i === 0 || r.max > RATINGS[i - 1].max), 'rating thresholds strictly increase');
  ok(RATINGS.length === 6, '6 ratings');
  ok(RATINGS.every(r => r.id && r.name && r.icon && r.blurb), 'every rating has id, name, icon, blurb');
}

// ---- catalogue sanity ----
{
  const ids = TROPHIES.map(t => t.id);
  ok(new Set(ids).size === ids.length, 'trophy ids unique');
  ok(TROPHIES.length === 26, '26 trophies (got ' + TROPHIES.length + ')');
  ok(TROPHIES.every(t => t.name && t.desc && t.icon && TROPHY_CATS.includes(t.cat) && (t.phase === 'live' || t.phase === 'end') && typeof t.test === 'function'), 'every trophy has name, desc, icon, valid cat/phase/test');
  ok(TROPHY_CATS.every(c => TROPHIES.some(t => t.cat === c)), 'every category has trophies');
  ok(TROPHIES.every(t => t.desc.length <= 60 && t.name.length <= 24), 'text lengths fit the cards');
}

// ---- each trophy: a state that earns it, and one that must not ----
const hotIsland = startIn(r => r.island), coldStart = startIn(r => r.climate === 'cold'), tempMain = startIn(r => r.climate === 'temperate' && !r.island);
const cases = {
  first:    { yes: () => mk({ over: 'lose' }),                                  no: () => { const s = mk(); s.over = null; return s; } },
  win1:     { yes: () => mk(),                                                  no: () => mk({ over: 'lose' }) },
  win5:     { yes: () => mk(), prof: P({ wins: 5 }),                            no: () => mk(), profNo: P({ wins: 4 }) },
  hunter:   { yes: () => mk(), prof: (() => { const p = P(); for (let i = 0; i < 10; i++) p.trophies['x' + i] = {}; return p; })(), no: () => mk(), profNo: P(), live: true },
  reach10:  { yes: () => { const s = mk({ dead: 0, reach: 0 }); for (let i = 0; i < 10; i++) { s.I[i] = 5; s.S[i] -= 5; } return s; }, no: () => { const s = mk({ dead: 0, reach: 0 }); for (let i = 0; i < 9; i++) { s.I[i] = 5; s.S[i] -= 5; } return s; }, live: true },
  all:      { yes: () => { const s = mk({ dead: 0, reach: 0 }); REGIONS.forEach((r, i) => { s.I[i] = 5; s.S[i] -= 5; }); return s; }, no: () => { const s = mk({ dead: 0, reach: 0 }); for (let i = 0; i < REGIONS.length - 1; i++) { s.I[i] = 5; s.S[i] -= 5; } return s; }, live: true },
  billion:  { yes: () => mk({ set: { peakInf: 1e9 } }),                         no: () => mk({ set: { peakInf: 9.9e8 } }), live: true },
  weather:  { yes: () => mk({ set: { owned: ['heat2', 'cold2'] } }),            no: () => mk({ set: { owned: ['heat2', 'cold1'] } }), live: true },
  bub50:    { yes: () => mk({ set: { bubGot: 50 } }),                           no: () => mk({ set: { bubGot: 49 } }), live: true },
  bub120:   { yes: () => mk({ set: { bubGot: 120 } }),                          no: () => mk({ set: { bubGot: 119 } }), live: true },
  gold:     { yes: () => mk({ set: { goldGot: 1 } }),                           no: () => mk({ set: { goldGot: 0 } }), live: true },
  sab5:     { yes: () => mk({ set: { sabCount: 5 } }),                          no: () => mk({ set: { sabCount: 4 } }), live: true },
  close:    { yes: () => mk({ set: { cure: 92 } }),                             no: () => mk({ set: { cure: 80 } }) },
  denied:   { yes: () => mk({ set: { cure: 10 } }),                             no: () => mk({ set: { cure: 40 } }) },
  pacifist: { yes: () => mk({ dead: 0.005 }),                                   no: () => mk({ dead: 0.05 }) },
  reaper:   { yes: () => mk({ dead: 0.10 }),                                    no: () => mk({ dead: 0.09 }) },
  minimal:  { yes: () => mk({ set: { owned: new Array(12).fill('a') } }),       no: () => mk({ set: { owned: new Array(13).fill('a') } }) },
  speed:    { yes: () => mk({ set: { day: 449 } }),                             no: () => mk({ set: { day: 450 } }) },
  slow:     { yes: () => mk({ set: { day: 601 } }),                             no: () => mk({ set: { day: 600 } }) },
  cold:     { yes: () => mk({ set: { start: coldStart } }),                     no: () => mk({ set: { start: tempMain } }) },
  island:   { yes: () => mk({ set: { start: hotIsland } }),                     no: () => mk({ set: { start: tempMain } }) },
  daily:    { yes: () => mk({ over: 'lose', set: { daily: true } }),            no: () => mk({ over: 'lose' }) },
  news:     { yes: () => mk({ set: { brkSeen: 12 } }),                          no: () => mk({ set: { brkSeen: 11 } }), live: true },
  pharma:   { yes: () => mk({ over: 'lose' }),                                  no: () => mk() },
  lock:     { yes: () => mk({ set: { lock: new Array(REGIONS.length).fill(false).map((x, i) => i < 40) } }), no: () => mk({ set: { lock: new Array(REGIONS.length).fill(false).map((x, i) => i < 39) } }), live: true },
  part:     { yes: () => mk({ over: 'lose' }),                                  no: () => mk({ over: 'lose' }) },
};
// "part" needs reach computed from S: patch states so reach is explicit.
{
  const fix = (st, reach) => { REGIONS.forEach((r, i) => { const Pp = r.pop * 1e6; st.D[i] = 0; st.I[i] = Pp * reach; st.S[i] = Pp * (1 - reach); }); return st; };
  cases.part.yes = () => fix(mk({ over: 'lose' }), 0.39);
  cases.part.no = () => fix(mk({ over: 'lose' }), 0.41);
}
for (const t of TROPHIES) {
  const c = cases[t.id];
  if (!c) { ok(false, 'no test case for trophy ' + t.id); continue; }
  const phase = c.live ? 'live' : 'end';
  ok(has(c.yes(), c.prof || P(), t.id, 'end'), t.id + ': earned in the right situation (end phase)');
  ok(!has(c.no(), c.profNo || P(), t.id, 'end'), t.id + ': NOT earned in the wrong situation');
  if (c.live) ok(t.phase === 'live' && has(c.yes(), c.prof || P(), t.id, 'live'), t.id + ': unlocks mid-game (live phase)');
  else if (t.phase === 'end') ok(!has(c.yes(), c.prof || P(), t.id, 'live'), t.id + ': waits until the game ends');
  void phase;
}
// Never earned twice
{
  const prof = P(); prof.trophies.win1 = { day: 1, t: 1 };
  ok(!has(mk(), prof, 'win1'), 'owned trophy is not offered again');
}
// A game in progress must not award end-only trophies
{
  const st = mk({ over: null }); const live = earned(st, P(), 'live');
  ok(!live.some(id => ['win1', 'first', 'pharma', 'part'].includes(id)), 'no end trophies mid-game');
  // 'part' must not fire when the player WINS or the pathogen burns out, only when the cure arrives early
  ok(!has(fixReach(mk({ over: 'win' }), 0.2), P(), 'part'), 'participation trophy is not given for a win');
  ok(!has(fixReach(mk({ over: 'burnout' }), 0.2), P(), 'part'), 'participation trophy is not given for burnout');
}

// ---- profile helpers ----
{
  const p = newProfile(); p.games = 3; p.wins = 2; p.fastestWin = 400; p.bestRating = 4; p.ratings = { deadly: 2 }; p.trophies = { win1: { day: 400, t: 5 } };
  p.recent = [{ t: 1, r: 2, o: 'win', day: 400, dead: 0.2, name: 'Zed' }];
  const rt = cleanProfile(JSON.parse(JSON.stringify(p)));
  ok(rt && rt.games === 3 && rt.wins === 2 && rt.fastestWin === 400 && rt.bestRating === 4 && rt.ratings.deadly === 2 && rt.trophies.win1 && rt.recent.length === 1, 'profile survives JSON round-trip');
  ok(cleanProfile(null) === null && cleanProfile('x') === null && cleanProfile({ v: 2 }) === null, 'cleanProfile rejects junk');
  const evil = cleanProfile({ v: 1, games: -5, wins: 'x', fastestWin: NaN, bestRating: 99, trophies: { nope: {}, win1: { day: 'a' } }, ratings: { cough: 'many', silent: 3 }, recent: [null, 5, { r: 99, name: 'x'.repeat(100) }] });
  ok(evil && evil.games === 0 && evil.wins === 0 && evil.fastestWin === 0 && evil.bestRating === RATINGS.length - 1, 'cleanProfile clamps numbers');
  ok(evil && !evil.trophies.nope && evil.trophies.win1 && evil.ratings.silent === 3 && !evil.ratings.cough, 'cleanProfile drops unknown trophies and bad counts');
  ok(evil && evil.recent.length === 1 && evil.recent[0].r === RATINGS.length - 1 && evil.recent[0].name.length === 24, 'cleanProfile cleans recent runs');
  const a = newProfile(); a.games = 5; a.wins = 1; a.fastestWin = 500; a.bestRating = 2; a.trophies = { win1: { day: 500, t: 9 } }; a.ratings = { deadly: 1 };
  const b = newProfile(); b.games = 2; b.wins = 2; b.fastestWin = 380; b.bestRating = 5; b.trophies = { win1: { day: 380, t: 4 }, gold: { day: 20, t: 8 } }; b.ratings = { deadly: 3, apoc: 1 };
  const m = mergeProfile(a, b);
  ok(m.games === 5 && m.wins === 2 && m.fastestWin === 380 && m.bestRating === 5, 'merge keeps the best numbers');
  ok(m.trophies.gold && m.trophies.win1.t === 4 && m.ratings.deadly === 3 && m.ratings.apoc === 1, 'merge keeps every trophy and the higher rating counts');
  ok(mergeProfile(a, null).games === 5 && mergeProfile(null, b).games === 2, 'merge tolerates missing sides');
}

console.log(fail ? 'trophy tests: ' + fail + ' FAILED, ' + pass + ' passed' : 'trophy tests: all ' + pass + ' passed');
process.exit(fail ? 1 : 0);
