// Reachability check: plays bot games through the REAL trophy engine (same flow as the UI) and reports
// which trophies and ratings the bots can earn, and how deaths are distributed when games end.
// Usage: node test/reach.js [gamesPerCombo, default 40]
const fs = require('fs'), path = require('path');
const read = f => fs.readFileSync(path.join(__dirname, '../src', f), 'utf8');
const src = ['data.js', 'news.js', 'sim.js', 'trophies.js'].map(read).join('\n') +
  '; return {REGIONS,newGame,step,buyUpgrade,canBuy,sabotage,canSabotage,collectBubble,totals,RATINGS,ratingIndex,TROPHIES,evalTrophies,newProfile};';
const G = new Function('__TUNE', src)({});
const { REGIONS, newGame, step, buyUpgrade, canBuy, sabotage, canSabotage, collectBubble, totals, RATINGS, ratingIndex, TROPHIES, evalTrophies, newProfile } = G;

const LETH = ['pneu', 'hemo', 'organ', 'necro'];
const SPREAD = ['cough', 'stealth', 'water', 'air', 'rodent', 'heat1', 'cold1', 'sneeze', 'drug1', 'blood', 'vector', 'heat2', 'cold2', 'drug2', 'gene'];
const PLANS = {
  lethal:  { order: ['cough', 'sneeze', 'water', 'air', 'rodent', 'heat1', 'cold1', 'pneu', 'fever', 'hemo', 'organ', 'necro', 'drug1', 'drug2', 'gene', 'stealth', 'blood', 'vector', 'heat2', 'cold2'] },
  stealth: { order: ['cough', 'stealth', 'water', 'sneeze', 'air', 'rodent', 'heat1', 'cold1', 'drug1', 'blood', 'vector', 'heat2', 'cold2', 'drug2', 'gene', 'rash', 'pneu', 'fever', 'hemo', 'organ', 'necro'] },
  rush:    { order: ['cough', 'sneeze', 'pneu', 'hemo', 'organ', 'necro', 'water', 'air', 'rodent', 'heat1', 'cold1', 'heat2', 'cold2', 'drug1', 'drug2', 'gene', 'vector', 'blood'] },
  // Spread silently first, then put every DNA into lethal symptoms once enough of the world is infected.
  sleeper: { order: SPREAD, trig: 0.3 },
  pure:    { order: SPREAD },  // never buys a lethal symptom
};
function lcg(seed) { let s = seed >>> 0; return () => (s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296; }

const prof = newProfile(), firstSeen = {}; // one profile across all games, like a real player's browser
const ratingSeen = {}, deadAtEnd = { win: [], lose: [], burnout: [] };
let gameNo = 0;

function play(plan, eff, startId, seed, daily) {
  const st = newGame(startId, seed, 'Bug'), R = lcg(seed * 7 + 1), seen = new Set(); let guard = 0;
  if (daily) st.daily = true;
  gameNo++;
  const unlock = phase => { for (let k = 0; k < 4; k++) { const ids = evalTrophies(st, prof, phase); if (!ids.length) break; ids.forEach(id => { prof.trophies[id] = { day: st.day, t: gameNo }; if (!(id in firstSeen)) firstSeen[id] = plan + '/' + eff + '/' + startId + ' g' + gameNo; }); } };
  while (!st.over && guard++ < 4000) {
    for (const b of st.bubbles.slice()) { if (seen.has(b.id)) continue; seen.add(b.id); if (R() < eff) collectBubble(st, b.id); }
    const PL = PLANS[plan], tt = totals(st), late = PL.trig !== undefined && 1 - tt.S / tt.pop >= PL.trig;
    for (const id of (late ? LETH.concat(PL.order) : PL.order)) { if (st.owned.includes(id)) continue; if (canBuy(st, id)) buyUpgrade(st, id); else if (late && LETH.includes(id)) break; else if (!late) break; }
    if (st.cure > 8 && canSabotage(st) && st.pts >= 30) sabotage(st);
    if (st.brk) { st.brk = null; st.brkSeen = (st.brkSeen || 0) + 1; }
    step(st);
    if (!st.over) unlock('live');
  }
  const t = totals(st);
  prof.games++; if (st.over === 'win') prof.wins++;
  const ri = ratingIndex(st); ratingSeen[RATINGS[ri].name] = (ratingSeen[RATINGS[ri].name] || 0) + 1; prof.bestRating = Math.max(prof.bestRating, ri);
  deadAtEnd[st.over === 'win' ? 'win' : st.over === 'burnout' ? 'burnout' : 'lose'].push(t.D / t.pop);
  unlock('end');
  return st;
}

const N = +process.argv[2] || 40; // 40 games per combo covers the island starts and the rare high-death wins
const starts = ['ind', 'usa', 'chn', 'bra', 'rus', 'waf', 'gbr', 'aus', 'jpn', 'nzl'];
for (const plan of Object.keys(PLANS)) for (const eff of [0.95, 0.5, 0.0]) for (let k = 0; k < N; k++) play(plan, eff, starts[k % starts.length], 300 + k * 13 + Math.floor(eff * 10), k % 5 === 0);
const mx = Math.max(...Object.values(deadAtEnd).flat(), 0);

const pct = a => a.length ? (a.reduce((x, y) => x + y, 0) / a.length * 100).toFixed(1) + '% avg, max ' + (Math.max(...a) * 100).toFixed(1) + '%' : 'n/a';
console.log('games', gameNo, '| wins', prof.wins);
console.log('dead at end  win:', pct(deadAtEnd.win), '| lose:', pct(deadAtEnd.lose), '| burnout:', pct(deadAtEnd.burnout));
console.log('ratings reached:', RATINGS.map(r => r.name + ' ' + (ratingSeen[r.name] || 0)).join(' | '));
const got = TROPHIES.filter(t => prof.trophies[t.id]), miss = TROPHIES.filter(t => !prof.trophies[t.id]);
console.log('trophies earned by bots (' + got.length + '/' + TROPHIES.length + '):', got.map(t => t.id).join(', '));
const all = Object.values(deadAtEnd).flat().sort((a, b) => a - b), qq = f => (all[Math.min(all.length - 1, Math.floor(all.length * f))] * 100).toFixed(1) + '%';
console.log('death toll at end, all outcomes: 25th ' + qq(0.25) + ' | 50th ' + qq(0.5) + ' | 75th ' + qq(0.75) + ' | 90th ' + qq(0.9) + ' | 95th ' + qq(0.95));
console.log('highest death toll at the end of any game: ' + (mx * 100).toFixed(1) + '%');
console.log('first earned by:', Object.keys(firstSeen).map(k => k + ' <- ' + firstSeen[k]).join('; '));
console.log('NOT reached by bots:', miss.map(t => t.id).join(', ') || 'none');
