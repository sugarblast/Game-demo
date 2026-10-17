// Headless playthroughs. Usage: node test/bot.js [games] [json-tune-overrides]
const fs = require('fs'), path = require('path');
const read = f => fs.readFileSync(path.join(__dirname, '../src', f), 'utf8');
const tune = process.argv[3] ? JSON.parse(process.argv[3]) : {};
const src = ['data.js', 'news.js', 'sim.js'].map(read).join('\n') + '; return {REGIONS,UPGRADES,newGame,step,buyUpgrade,canBuy,sabotage,canSabotage,collectBubble,totals,rating,TUNE};';
const G = new Function('__TUNE', src)(tune);
const { newGame, step, buyUpgrade, canBuy, sabotage, canSabotage, collectBubble, totals } = G;

const PLANS = {
  lethal: ['cough','sneeze','water','air','rodent','heat1','cold1','pneu','fever','hemo','organ','necro','drug1','drug2','gene','stealth','blood','vector','heat2','cold2'],
  stealth: ['cough','stealth','water','sneeze','air','rodent','heat1','cold1','drug1','blood','vector','heat2','cold2','drug2','gene','rash','pneu','fever','hemo','organ','necro'],
};
// Player profiles: how reliably they click DNA bubbles, and whether they sabotage the cure.
const PROFILES = {
  active: { eff: 0.95, sab: true },
  casual: { eff: 0.5, sab: true },
  idle:   { eff: 0.0, sab: true },
  activeNoSab: { eff: 0.95, sab: false },
};
function lcg(seed) { let s = seed >>> 0; return () => (s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296; }

function play(plan, prof, startId, seed) {
  const st = newGame(startId, seed, 'Testbug'), R = lcg(seed * 7 + 1), P = PROFILES[prof];
  const seen = new Set(); let guard = 0;
  while (!st.over && guard++ < 4000) {
    for (const b of st.bubbles.slice()) { if (seen.has(b.id)) continue; seen.add(b.id); if (R() < P.eff) collectBubble(st, b.id); }
    for (const id of PLANS[plan]) { if (st.owned.includes(id)) continue; if (canBuy(st, id)) buyUpgrade(st, id); else break; }
    if (P.sab && st.cure > 8 && canSabotage(st) && st.pts >= 18 + 12) sabotage(st);
    if (st.brk) st.brk = null;
    step(st);
  }
  const t = totals(st);
  return { over: st.over, day: st.day, cure: +st.cure.toFixed(0), reach: +((1 - t.S / t.pop) * 100).toFixed(1), dead: +(t.D / t.pop * 100).toFixed(1),
    regions: t.regions, sab: st.sabCount, owned: st.owned.length, dna: Math.round(st.dnaGot), brk: st.brkCount, bub: st.bubGot + '/' + st.bubMade };
}
const N = +process.argv[2] || 8;
const starts = ['ind', 'usa', 'chn', 'bra', 'rus', 'waf', 'gbr', 'aus'];
for (const plan of Object.keys(PLANS)) for (const prof of Object.keys(PROFILES)) {
  const rs = [];
  for (let k = 0; k < N; k++) rs.push(play(plan, prof, starts[k % starts.length], 100 + k));
  const wins = rs.filter(r => r.over === 'win').length, burn = rs.filter(r => r.over === 'burnout').length;
  const avg = key => (rs.reduce((a, r) => a + r[key], 0) / rs.length).toFixed(0);
  const days = rs.map(r => r.day).sort((a, b) => a - b);
  console.log(`${plan.padEnd(8)} ${prof.padEnd(11)} win ${wins}/${N} burn ${burn}  days avg ${avg('day')} (min ${days[0]}, max ${days[days.length - 1]})  cure ${avg('cure')}%  reached ${avg('reach')}%  upgrades ${avg('owned')}  dna ${avg('dna')}  brk ${avg('brk')}`);
}
console.log('sample:', JSON.stringify(play('lethal', 'active', 'rus', 100)));
