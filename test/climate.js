// Does climate matter? Start in Russia (cold). Compare cold resistance first vs heat resistance first.
const fs = require('fs'), path = require('path');
const read = f => fs.readFileSync(path.join(__dirname, '../src', f), 'utf8');
const G = new Function('__TUNE', ['data.js','news.js','sim.js'].map(read).join('\n') + '; return {REGIONS,REGION_INDEX,newGame,step,buyUpgrade,totals,climateMult};')({});
function run(order, start, days, seed) {
  const st = G.newGame(start, seed, 'Test'); st.pts = 200;
  for (const id of order) G.buyUpgrade(st, id);
  const i = G.REGION_INDEX[start], mult = G.climateMult(st, i);
  let day60 = 0;
  for (let d = 0; d < days; d++) { if (d % 1 === 0) st.bubbles = []; G.step(st); st.brk = null; if (d === 59) day60 = st.I[i]; }
  return { mult: +mult.toFixed(2), infectedAtDay60: Math.round(day60), infectedAtEnd: Math.round(st.I[i] + st.D[i]) };
}
for (const start of ['rus', 'ind']) {
  console.log('start in', start, G.REGIONS[G.REGION_INDEX[start]].climate);
  for (const [name, order] of [['no resistance', ['cough']], ['cold1+cold2', ['cough','cold1','cold2']], ['heat1+heat2', ['cough','heat1','heat2']]])
    console.log('  ', name.padEnd(14), JSON.stringify(Array.from({length: 4}, (_, k) => run(order, start, 120, 11 + k)).reduce((a, r) => ({ mult: r.mult, d60: (a.d60 || 0) + r.infectedAtDay60 / 4, d120: (a.d120 || 0) + r.infectedAtEnd / 4 }), {})).replace(/(\d+)\.\d+/g, '$1'));
}
