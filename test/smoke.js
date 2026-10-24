// Loads index.html in headless Chromium and exercises the real UI. Usage: node test/smoke.js <screenshot-dir>
const { chromium } = require('/opt/npm-tools/node_modules/playwright');
const path = require('path'), out = process.argv[2] || '/tmp';
const ok = (c, m, extra) => { console.log((c ? 'PASS ' : 'FAIL ') + m + (extra !== undefined ? '  ' + JSON.stringify(extra) : '')); if (!c) process.exitCode = 1; };
(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--autoplay-policy=no-user-gesture-required'] });
  const errors = [];
  const page = await browser.newPage({ viewport: { width: 1280, height: 780 } });
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  await page.goto('file://' + path.resolve(__dirname, '../index.html'));
  await page.waitForSelector('#goBtn');
  await page.screenshot({ path: out + '/1-start.png' });

  // --- start screen: How to Play box, nothing clipped on a small phone ---
  await page.setViewportSize({ width: 360, height: 640 }); await page.waitForTimeout(150);
  const sm = await page.evaluate(() => { const ov = document.getElementById('startOv'), m = ov.querySelector('.modal').getBoundingClientRect(), o = ov.getBoundingClientRect(); return { top: m.top - o.top, scrollable: ov.scrollHeight >= ov.clientHeight }; });
  ok(sm.top >= 0, 'start screen is not clipped at the top on a 360x640 phone', sm);
  ok(await page.evaluate(() => getComputedStyle(document.getElementById('bottom')).display === 'none'), 'game controls are hidden behind the start screen on phones');
  ok(!(await page.locator('#howToPlayText').isVisible()), 'How to Play box starts closed');
  await page.click('#howToPlayBtn'); await page.waitForTimeout(100);
  ok(await page.locator('#howToPlayText').isVisible() && /Name your pathogen/.test(await page.locator('#howToPlayText').innerText()), 'HOW TO PLAY opens the instructions box');
  await page.keyboard.press('Escape');
  ok(!(await page.locator('#howToPlayText').isVisible()), 'Escape closes the How to Play box');
  await page.click('#howToPlayBtn'); await page.click('#closeHowToPlay');
  ok(!(await page.locator('#howToPlayText').isVisible()), 'the X closes the How to Play box');
  await page.locator('#startOv details summary').click();
  ok(await page.locator('#sSnd').isVisible(), 'Settings fold open on the start screen');
  await page.setViewportSize({ width: 1280, height: 780 }); await page.waitForTimeout(150);

  // start in Russia (cold) with a fixed seed
  await page.fill('#pSeed', '2027'); await page.selectOption('#pStart', 'rus'); await page.fill('#pName', 'Nightfall');
  await page.click('#goBtn'); await page.waitForTimeout(300);

  // --- climate: details card shows the multiplier, hint appears ---
  await page.evaluate(() => { const g = window.__game; for (let i = 0; i < 12; i++) g.step(); });
  const hintText = await page.evaluate(() => window.__game.st.news.map(n => n.text).find(t => /cold/i.test(t)) || '');
  ok(/cold/i.test(hintText), 'cold-climate hint appears in the news', hintText);
  const [rx, ry] = await page.evaluate(() => MapView.toScreen(REGIONS[REGION_INDEX.rus].c[0], REGIONS[REGION_INDEX.rus].c[1]));
  const box = await page.locator('#map').boundingBox();
  await page.mouse.move(box.x + rx + 30, box.y + ry + 10); await page.waitForTimeout(250);
  ok(!(await page.locator('#tip').isVisible()), 'hovering a country does NOT open the details card');
  ok(await page.evaluate(() => MapView.hover === REGION_INDEX.rus), 'hovering still highlights the country');
  await page.evaluate(() => { window.__game.st.bubbles = []; }); // a bubble under the pointer would be collected instead (that is covered in test/input.js)
  await page.mouse.click(box.x + rx + 30, box.y + ry + 10); await page.waitForTimeout(250);
  const tip = await page.locator('#tip').innerText();
  ok(/Russia/.test(tip) && /×0\.50/.test(tip), 'clicking a country opens details with the cold spread multiplier x0.50', tip.replace(/\n/g, ' | '));

  // --- bubbles ---
  await page.evaluate(() => { const g = window.__game; for (let i = 0; i < 60 && !g.st.bubbles.length; i++) g.step(); });
  const nb = await page.evaluate(() => window.__game.st.bubbles.length);
  ok(nb >= 1, 'a DNA bubble pops up within a few weeks', nb);
  await page.screenshot({ path: out + '/2-bubble.png' });
  const before = await page.evaluate(() => window.__game.st.pts);
  const b = await page.evaluate(() => { const g = window.__game, bb = g.st.bubbles[0], [x, y] = MapView.bubbleXY(bb); return { x, y, val: bb.val, id: bb.id }; });
  await page.mouse.click(box.x + b.x, box.y + b.y); await page.waitForTimeout(150);
  const after = await page.evaluate(() => window.__game.st.pts);
  ok(Math.abs(after - before - b.val) < 0.01, 'clicking a bubble collects its DNA', { before: +before.toFixed(2), after: +after.toFixed(2), val: b.val });
  await page.waitForTimeout(250); await page.screenshot({ path: out + '/3-collected.png' });

  // idle income is tiny: 100 days with no clicking
  const idle = await page.evaluate(() => { const g = window.__game, p0 = g.st.pts; for (let i = 0; i < 100; i++) { g.st.bubbles = []; g.step(); if (g.st.brk) g.closeBreak(); } return g.st.pts - p0; });
  ok(idle < 6, 'idle DNA income over 100 days is tiny', +idle.toFixed(2));

  // --- live trophy: unlocks mid-game, toasts, saves immediately ---
  ok((await page.evaluate(() => Object.keys(window.__game.prof.trophies).length)) === 0, 'fresh browser starts with no trophies');
  await page.evaluate(() => { const g = window.__game; g.st.bubGot = 50; g.step(); });
  await page.waitForTimeout(500);
  const toastTxt = await page.locator('#toast').innerText();
  ok(/Bubble Popper/.test(toastTxt) && await page.evaluate(() => document.getElementById('toast').classList.contains('show')), 'unlock toast slides in for Bubble Popper', toastTxt.replace(/\n/g, ' | '));
  await page.screenshot({ path: out + '/8-toast.png' });
  const saved0 = await page.evaluate(() => JSON.parse(localStorage.getItem('outbreak-protocol-profile-v1') || 'null'));
  ok(saved0 && saved0.trophies && saved0.trophies.bub50, 'trophy is written to localStorage the moment it unlocks', saved0 && Object.keys(saved0.trophies));
  await page.evaluate(() => { const g = window.__game; g.step(); g.step(); });
  ok((await page.evaluate(() => Object.keys(window.__game.prof.trophies).filter(k => k === 'bub50').length)) === 1, 'a trophy is never awarded twice');
  // opening the Trophy Room from the top bar pauses the game
  await page.click('#trophyBtn'); await page.waitForTimeout(200);
  ok(await page.locator('#trophyOv').isVisible() && await page.evaluate(() => window.__game.blocked), 'top-bar trophy button opens the room and pauses the game');
  await page.keyboard.press('Escape');
  ok(!(await page.locator('#trophyOv').isVisible()), 'Escape closes the Trophy Room');

  // --- breaking news pauses the game until crossed out ---
  await page.evaluate(() => { const g = window.__game; g.st.brk = { type: 'random', h: 'Cookie banner accepted by 100% of humanity', s: 'The reject all button is reportedly still at the bottom of the internet.', r: '' }; g.openBreak(); });
  await page.waitForTimeout(400);
  ok(await page.locator('#brkOv').isVisible(), 'breaking news overlay is visible');
  await page.screenshot({ path: out + '/4-breaking.png' });
  await page.click('#speed button[data-s="3"]');
  const d0 = await page.evaluate(() => window.__game.st.day); await page.waitForTimeout(2200);
  const d1 = await page.evaluate(() => window.__game.st.day);
  ok(d0 === d1, 'game stays paused while breaking news is open (even at 3x)', { d0, d1 });
  await page.click('#brkX'); await page.waitForTimeout(2200);
  const d2 = await page.evaluate(() => window.__game.st.day);
  ok(d2 > d1, 'crossing out the X resumes the game', { d1, d2 });
  const closeAny = async () => { for (let i = 0; i < 4 && await page.locator('#brkOv').isVisible(); i++) { await page.click('#brkX'); await page.waitForTimeout(80); } };
  await closeAny(); await page.evaluate(() => window.__game.setSpeed(0));

  // --- sound ---
  await page.click('#sndBtn'); await page.click('#sndBtn'); // unlock, mute, unmute
  const names = await page.evaluate(() => Sound.names);
  const thrown = await page.evaluate(() => { const bad = []; for (const n of Sound.names) { try { Sound.play(n); } catch (e) { bad.push(n + ':' + e.message); } } return bad; });
  ok(thrown.length === 0, 'all ' + names.length + ' sound effects play without errors', thrown);
  await page.evaluate(() => Sound.play('news')); await page.waitForTimeout(120);
  const pr = await page.evaluate(() => Sound.probe());
  ok(pr.state === 'running' && pr.rms > 0.0005, 'audio output is not silent after a sound plays', pr);
  await page.click('#sndBtn');
  ok(await page.evaluate(() => Sound.muted), 'mute button mutes');
  await page.click('#sndBtn');

  // --- breaking news "milestones only" setting drops random interrupts ---
  await closeAny(); await page.click('#menuBtn'); await page.selectOption('#sBrk', 'miles'); await page.click('#mResume');
  await page.evaluate(() => { const g = window.__game; g.st.brk = { type: 'random', h: 'x', s: 'y', r: '' }; g.openBreak(); });
  ok(!(await page.locator('#brkOv').isVisible()), 'milestones-only setting skips random interrupts');
  await page.evaluate(() => { const g = window.__game; g.st.brk = { type: 'cure50', h: 'Halfway to a cure', s: 'z', r: '' }; g.openBreak(); });
  ok(await page.locator('#brkOv').isVisible(), 'milestone interrupts still show');
  await page.keyboard.press('Escape');
  ok(!(await page.locator('#brkOv').isVisible()), 'Escape also closes breaking news');

  // --- evolve drawer still works, and unaffordable cards are marked ---
  await closeAny(); await page.evaluate(() => { window.__game.st.pts = 20; }); await page.click('#evoBtn'); await page.waitForTimeout(350);
  await page.click('#tabs button[data-g="Abilities"]'); await page.waitForTimeout(150);
  await page.screenshot({ path: out + '/5-evolve.png' });
  const bought = await page.evaluate(() => { document.querySelector('.card[data-id="cold1"]').click(); return window.__game.st.owned.includes('cold1'); });
  ok(bought, 'bought Cold resistance I from the evolve drawer');
  await page.click('#drawerClose');
  const mult = await page.evaluate(() => climateMult(window.__game.st, REGION_INDEX.rus));
  ok(Math.abs(mult - 0.75) < 0.001, 'cold resistance I lifts Russia multiplier to 0.75', mult);

  // --- full game end screen ---
  await page.evaluate(() => { const g = window.__game; g.st.cure = 100; g.st.brk = null; g.setSpeed(0); g.step(); });
  await page.waitForTimeout(500);
  ok(await page.locator('#endOv').isVisible(), 'end screen shows');
  await page.screenshot({ path: out + '/6-end.png' });

  const endTxt = await page.locator('#endOv').innerText();
  ok(/Pandemic rating/i.test(endTxt) && /Barely a Cough/.test(endTxt), 'end screen shows the rating box', endTxt.split('\n').slice(0, 6).join(' | '));
  ok(/NEW BEST/.test(endTxt), 'first rating is flagged NEW BEST');
  ok(/Patient Zero/.test(endTxt) && /Big Pharma Wins/.test(endTxt), 'end screen lists the trophies earned this game');
  await page.click('#trBtn2'); await page.waitForTimeout(250);
  const counts = await page.evaluate(() => ({ cards: document.querySelectorAll('#trophyOv .tcard').length, got: document.querySelectorAll('#trophyOv .tcard.got').length, chips: document.querySelectorAll('#trophyOv .rchip').length, chipsGot: document.querySelectorAll('#trophyOv .rchip.got').length }));
  ok(counts.cards === 26 && counts.chips === 6 && counts.got >= 3 && counts.chipsGot === 1, 'Trophy Room shows 26 trophies, 6 ratings, and the ones earned', counts);
  await page.screenshot({ path: out + '/9-trophyroom.png' });
  ok(/Games played\s*1/i.test((await page.locator('#trophyOv').innerText()).replace(/\n/g, ' ')), 'Trophy Room counts the finished game');
  await page.keyboard.press('Escape');

  // --- phone layout with a breaking news modal ---
  await page.click('#againBtn'); await page.fill('#pSeed', '7'); await page.click('#goBtn');
  await page.setViewportSize({ width: 390, height: 780 }); await page.waitForTimeout(300);
  await page.evaluate(() => { const g = window.__game; g.st.brk = { type: 'cure25', h: 'Streaming service raises prices again to "support outbreak content"', s: 'Subscribers can now watch the world end in 4K for $24.99 a month. With ads.', r: '' }; g.openBreak(); });
  await page.waitForTimeout(400); await page.screenshot({ path: out + '/7-phone-breaking.png' });
  // --- profile survives a reload; backup code round-trips ---
  await closeAny();
  const saved1 = await page.evaluate(() => localStorage.getItem('outbreak-protocol-profile-v1'));
  await page.reload(); await page.waitForSelector('#goBtn');
  const startTxt = await page.locator('#startOv').innerText();
  ok(/1 game played/.test(startTxt) && /Trophy Room \(\d+\/26\)/.test(startTxt), 'start screen shows saved stats and Trophy Room button after reload', startTxt.split('\n').filter(l => /game|Trophy/.test(l)));
  await page.click('#trBtn'); await page.waitForTimeout(250);
  const gotAfter = await page.evaluate(() => document.querySelectorAll('#trophyOv .tcard.got').length);
  ok(gotAfter >= 3, 'trophies are still unlocked after a reload', gotAfter);
  await page.locator('#trophyOv details summary').click();
  const code = await page.inputValue('#trCode');
  ok(/^OP1:/.test(code), 'backup code is shown', code.slice(0, 12) + '...');
  await page.keyboard.press('Escape');
  await page.evaluate(() => localStorage.removeItem('outbreak-protocol-profile-v1'));
  await page.reload(); await page.waitForSelector('#goBtn');
  await page.click('#trBtn'); await page.waitForTimeout(200); // on a phone the top-bar button is hidden behind the start screen, the start screen has its own
  ok((await page.evaluate(() => document.querySelectorAll('#trophyOv .tcard.got').length)) === 0, 'wiping storage empties the room');
  await page.locator('#trophyOv details summary').click();
  await page.fill('#trCode', 'not a real code'); await page.click('#trLoad');
  ok(/could not be read/.test(await page.locator('#trMsg').innerText()), 'garbage backup code is rejected politely');
  await page.fill('#trCode', code); await page.click('#trLoad'); await page.waitForTimeout(200);
  ok((await page.evaluate(() => document.querySelectorAll('#trophyOv .tcard.got').length)) === gotAfter, 'loading the backup code restores every trophy', gotAfter);
  ok(await page.evaluate(() => window.__game.prof.games === 1 && localStorage.getItem('outbreak-protocol-profile-v1') !== null), 'restored profile is saved again');
  await page.setViewportSize({ width: 390, height: 780 }); await page.waitForTimeout(200);
  await page.screenshot({ path: out + '/10-trophyroom-phone.png' });
  void saved1;
  ok(errors.length === 0, 'no console or page errors', errors);
  await browser.close();
})();
