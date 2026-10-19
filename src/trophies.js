// Ratings and trophies. Pure data and logic (no DOM), so it can be unit tested in Node.
// To add a trophy: add one entry to TROPHIES. To change a rating threshold: edit RATINGS.

// End-of-game rating by share of humanity that died. `max` is the exclusive upper bound.
// Calibrated to what the game can produce: a win ends once 99.5% of people are infected, so the death toll at the end is
// 0% for a pure stealth game and climbs with lethal symptoms. In bot testing: median about 1%, top 10% of games above 12%,
// best games 25% to 40%. So the ladder spans 0% to 15%+ (see test/reach.js).
const RATINGS = [
  { id: 'cough',    name: 'Barely a Cough',        max: 0.003, icon: '🤧', blurb: 'Humanity barely noticed.' },
  { id: 'silent',   name: 'Silent Pandemic',       max: 0.015, icon: '🤫', blurb: 'Plenty of sniffles, very few funerals.' },
  { id: 'deadly',   name: 'Deadly Pandemic',       max: 0.04,  icon: '☣️', blurb: 'The history books will need a new chapter.' },
  { id: 'global',   name: 'Global Catastrophe',    max: 0.08,  icon: '🌋', blurb: 'Whole industries are now "a memory".' },
  { id: 'collapse', name: 'Civilization Collapse', max: 0.15,  icon: '🏚️', blurb: 'The group chat is down to eleven people.' },
  { id: 'apoc',     name: 'Apocalypse',            max: 1.01,  icon: '☠️', blurb: 'Somebody is left to write the review. One star.' },
];
function ratingIndex(st) {
  const t = totals(st), d = t.D / t.pop;
  const i = RATINGS.findIndex(r => d < r.max);
  return i < 0 ? RATINGS.length - 1 : i;
}
function rating(st) { return RATINGS[ratingIndex(st)].name; }

// phase 'live' = can unlock mid-game (checked every day). phase 'end' = only checked when the game ends.
// test(st, ctx): st = game state, ctx = { prof (saved profile), T (totals), dead (0..1), reach (0..1) }
const WIN = st => st.over === 'win';
const TROPHIES = [
  // Progress
  { id: 'first',    cat: 'Progress', icon: '🧫', name: 'Patient Zero',         desc: 'Finish your first game.',                          phase: 'end',  test: st => !!st.over },
  { id: 'win1',     cat: 'Progress', icon: '☠️', name: 'Humanity Ended',       desc: 'Win a game.',                                      phase: 'end',  test: WIN },
  { id: 'win5',     cat: 'Progress', icon: '👑', name: 'Serial Pandemic',      desc: 'Win 5 games.',                                     phase: 'end',  test: (st, c) => c.prof.wins >= 5 },
  { id: 'hunter',   cat: 'Progress', icon: '🏆', name: 'Trophy Hunter',        desc: 'Unlock 10 trophies.',                              phase: 'live', test: (st, c) => Object.keys(c.prof.trophies).length >= 10 },
  // Spread
  { id: 'reach10',  cat: 'Spread',   icon: '🌍', name: 'Going Global',         desc: 'Infect 10 regions in one game.',                   phase: 'live', test: (st, c) => c.T.regions >= 10 },
  { id: 'all',      cat: 'Spread',   icon: '✈️', name: 'Frequent Flyer',       desc: 'Infect every region on the map.',                  phase: 'live', test: (st, c) => c.T.regions >= REGIONS.length },
  { id: 'billion',  cat: 'Spread',   icon: '🤒', name: 'Billion Club',         desc: 'Have 1 billion people infected at once.',          phase: 'live', test: st => st.peakInf >= 1e9 },
  { id: 'weather',  cat: 'Spread',   icon: '🌡️', name: 'Weatherproof',   desc: 'Own both Heat and Cold resistance II.',            phase: 'live', test: st => st.owned.includes('heat2') && st.owned.includes('cold2') },
  // DNA
  { id: 'bub50',    cat: 'DNA',      icon: '🫧', name: 'Bubble Popper',        desc: 'Collect 50 DNA bubbles in one game.',              phase: 'live', test: st => st.bubGot >= 50 },
  { id: 'bub120',   cat: 'DNA',      icon: '🧬', name: 'DNA Hoarder',          desc: 'Collect 120 DNA bubbles in one game.',             phase: 'live', test: st => st.bubGot >= 120 },
  { id: 'gold',     cat: 'DNA',      icon: '✨',       name: 'Golden Touch',         desc: 'Collect a gold DNA bubble.',                       phase: 'live', test: st => (st.goldGot || 0) >= 1 },
  // Cure
  { id: 'sab5',     cat: 'Cure',     icon: '🔧', name: 'Professional Saboteur', desc: 'Sabotage the cure 5 times in one game.',          phase: 'live', test: st => st.sabCount >= 5 },
  { id: 'close',    cat: 'Cure',     icon: '😰', name: 'Photo Finish',         desc: 'Win with the cure at 90% or more.',                phase: 'end',  test: st => WIN(st) && st.cure >= 90 },
  { id: 'denied',   cat: 'Cure',     icon: '🚫', name: 'Cure Denied',          desc: 'Win with the cure under 30%.',                     phase: 'end',  test: st => WIN(st) && st.cure < 30 },
  { id: 'lock',     cat: 'Cure',     icon: '🔒', name: 'Total Lockdown',       desc: 'Have 40 regions in lockdown at the same time.',    phase: 'live', test: st => st.lock.reduce((a, x) => a + (x ? 1 : 0), 0) >= 40 },
  // Style
  { id: 'pacifist', cat: 'Style',    icon: '🤧', name: 'Everybody Got It',     desc: 'Win with fewer than 1% of people dead.',           phase: 'end',  test: (st, c) => WIN(st) && c.dead < 0.01 },
  { id: 'reaper',   cat: 'Style',    icon: '💀', name: 'Grim Harvest',         desc: 'Win with 10% or more of humanity dead.',           phase: 'end',  test: (st, c) => WIN(st) && c.dead >= 0.10 },
  { id: 'minimal',  cat: 'Style',    icon: '🧼', name: 'Minimalist',           desc: 'Win with 12 or fewer upgrades.',                   phase: 'end',  test: st => WIN(st) && st.owned.length <= 12 },
  { id: 'speed',    cat: 'Style',    icon: '⚡',       name: 'Speed Demon',          desc: 'Win in under 450 days.',                           phase: 'end',  test: st => WIN(st) && st.day < 450 },
  { id: 'slow',     cat: 'Style',    icon: '🐢', name: 'Slow Burn',            desc: 'Win after day 600.',                               phase: 'end',  test: st => WIN(st) && st.day > 600 },
  // Starting point
  { id: 'cold',     cat: 'Start',    icon: '🥶', name: 'Cold Shoulder',        desc: 'Win a game that began in a cold region.',          phase: 'end',  test: st => WIN(st) && REGIONS[REGION_INDEX[st.start]].climate === 'cold' },
  { id: 'island',   cat: 'Start',    icon: '🏝️', name: 'Island Hopper',  desc: 'Win a game that began on an island.',              phase: 'end',  test: st => WIN(st) && REGIONS[REGION_INDEX[st.start]].island },
  { id: 'daily',    cat: 'Start',    icon: '📅', name: 'Daily Habit',          desc: 'Finish a Daily Challenge.',                        phase: 'end',  test: st => !!st.over && !!st.daily },
  // Fun
  { id: 'news',     cat: 'Fun',      icon: '📱', name: 'Doomscroller',         desc: 'See 12 breaking-news cards in one game.',          phase: 'live', test: st => (st.brkSeen || 0) >= 12 },
  { id: 'pharma',   cat: 'Fun',      icon: '💊', name: 'Big Pharma Wins',      desc: 'Lose to the cure.',                                phase: 'end',  test: st => st.over === 'lose' },
  { id: 'part',     cat: 'Fun',      icon: '🎖️', name: 'Participation Trophy', desc: 'Lose with under 40% of humanity ever infected.',   phase: 'end',  test: (st, c) => st.over === 'lose' && c.reach < 0.40 },
];
const TROPHY_CATS = ['Progress', 'Spread', 'DNA', 'Cure', 'Style', 'Start', 'Fun'];
const TROPHY_INDEX = {}; TROPHIES.forEach(t => TROPHY_INDEX[t.id] = t);

// Which trophies would unlock right now (not yet owned). Call with phase 'live' every day and 'end' when the game finishes.
function evalTrophies(st, prof, phase) {
  const T = totals(st), ctx = { prof, T, dead: T.D / T.pop, reach: 1 - T.S / T.pop }, got = [];
  for (const t of TROPHIES) {
    if (prof.trophies[t.id]) continue;
    if (t.phase === 'end' && phase !== 'end') continue;
    try { if (t.test(st, ctx)) got.push(t.id); } catch (e) {}
  }
  return got;
}

function newProfile() { return { v: 1, games: 0, wins: 0, trophies: {}, ratings: {}, bestRating: -1, fastestWin: 0, recent: [] }; }
// Validates and cleans a profile loaded from storage or pasted from a backup code. Returns null if unusable.
function cleanProfile(o) {
  if (!o || typeof o !== 'object' || o.v !== 1) return null;
  const p = newProfile(), num = (x, d) => (typeof x === 'number' && isFinite(x) && x >= 0 ? x : d);
  p.games = num(o.games, 0); p.wins = num(o.wins, 0); p.fastestWin = num(o.fastestWin, 0);
  p.bestRating = Math.min(RATINGS.length - 1, Math.floor(typeof o.bestRating === 'number' ? o.bestRating : -1));
  for (const id in (o.trophies || {})) if (TROPHY_INDEX[id]) p.trophies[id] = { day: num(o.trophies[id] && o.trophies[id].day, 0), t: num(o.trophies[id] && o.trophies[id].t, 0) };
  for (const r of RATINGS) if (o.ratings && num(o.ratings[r.id], 0) > 0) p.ratings[r.id] = Math.floor(o.ratings[r.id]);
  if (Array.isArray(o.recent)) p.recent = o.recent.slice(0, 10).filter(x => x && typeof x === 'object').map(x => ({ t: num(x.t, 0), r: Math.min(RATINGS.length - 1, Math.max(0, Math.floor(num(x.r, 0)))), o: String(x.o || '').slice(0, 10), day: num(x.day, 0), dead: num(x.dead, 0), name: String(x.name || '').slice(0, 24) }));
  return p;
}

// Merge a restored profile into the current one: never lose progress, keep the best of both.
function mergeProfile(a, b) {
  const p = cleanProfile(a) || newProfile(), q = cleanProfile(b);
  if (!q) return p;
  p.games = Math.max(p.games, q.games); p.wins = Math.max(p.wins, q.wins);
  if (q.fastestWin && (!p.fastestWin || q.fastestWin < p.fastestWin)) p.fastestWin = q.fastestWin;
  p.bestRating = Math.max(p.bestRating, q.bestRating);
  for (const id in q.ratings) p.ratings[id] = Math.max(p.ratings[id] || 0, q.ratings[id]);
  for (const id in q.trophies) if (!p.trophies[id] || (q.trophies[id].t && q.trophies[id].t < p.trophies[id].t)) p.trophies[id] = q.trophies[id];
  return p;
}
