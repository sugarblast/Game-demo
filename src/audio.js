// Sound engine. Everything is synthesized with the Web Audio API, so the game needs no audio files.
// Optional: assets/audio/manifest.js can define window.OUTBREAK_AUDIO to override any sound with a real file
// (see assets/audio/README.md). A missing or broken file silently falls back to the synthesized version.
const Sound = (() => {
  const KEY = 'outbreak-protocol-snd';
  const man = (typeof window !== 'undefined' && window.OUTBREAK_AUDIO) || {};
  let ctx = null, master = null, sfxBus = null, musBus = null, analyser = null, noiseBuf = null;
  let muted = false, vol = 0.7, tension = 0.2, musicOn = false, mus = null, fileMus = null;
  const lastPlayed = {}, bad = {};
  const GAP = { spread: 240, click: 45, dna: 25, close: 150, detect: 400, death: 500 };

  try { const o = JSON.parse(localStorage.getItem(KEY) || 'null'); if (o) { muted = !!o.muted; if (typeof o.vol === 'number') vol = Math.max(0, Math.min(1, o.vol)); } } catch (e) {}
  const persist = () => { try { localStorage.setItem(KEY, JSON.stringify({ muted, vol })); } catch (e) {} };
  const level = () => (muted ? 0 : vol);

  // ----- low level synth helpers -----
  function env(g, t, a, d, peak) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
  }
  function tone(freq, dur, o) {
    o = o || {};
    const t = ctx.currentTime + (o.delay || 0), a = o.a || 0.005;
    const osc = ctx.createOscillator(), g = ctx.createGain();
    osc.type = o.type || 'sine'; osc.frequency.setValueAtTime(freq, t);
    if (o.to) osc.frequency.exponentialRampToValueAtTime(o.to, t + dur);
    env(g, t, a, dur, o.vol || 0.2);
    osc.connect(g); g.connect(o.bus || sfxBus);
    osc.start(t); osc.stop(t + a + dur + 0.05);
  }
  function noise(dur, o) {
    o = o || {};
    const t = ctx.currentTime + (o.delay || 0), a = o.a || 0.005;
    const src = ctx.createBufferSource(); src.buffer = noiseBuf;
    const f = ctx.createBiquadFilter(); f.type = o.ftype || 'bandpass'; f.Q.value = o.q || 1;
    f.frequency.setValueAtTime(o.f || 1000, t);
    if (o.fto) f.frequency.exponentialRampToValueAtTime(o.fto, t + dur);
    const g = ctx.createGain(); env(g, t, a, dur, o.vol || 0.15);
    src.connect(f); f.connect(g); g.connect(sfxBus);
    src.start(t); src.stop(t + a + dur + 0.05);
  }

  // ----- the sound effects -----
  const SFX = {
    click:    () => tone(520, 0.06, { type: 'triangle', vol: 0.1, to: 380 }),
    dna:      () => { tone(700, 0.12, { vol: 0.26, to: 1400 }); tone(1400, 0.2, { vol: 0.14, delay: 0.06 }); },
    gold:     () => [880, 1175, 1568, 2093].forEach((f, i) => tone(f, 0.18, { type: 'triangle', vol: 0.2, delay: i * 0.06 })),
    buy:      () => { tone(392, 0.1, { type: 'square', vol: 0.08 }); tone(587, 0.14, { type: 'square', vol: 0.08, delay: 0.08 }); tone(784, 0.24, { type: 'triangle', vol: 0.14, delay: 0.16 }); },
    deny:     () => tone(140, 0.2, { type: 'sawtooth', vol: 0.1, to: 90 }),
    sabotage: () => { noise(0.55, { f: 2400, fto: 200, q: 0.8, vol: 0.25 }); tone(300, 0.55, { type: 'sawtooth', vol: 0.1, to: 60 }); tone(1200, 0.06, { type: 'square', vol: 0.08, delay: 0.02 }); },
    detect:   () => [880, 660, 880, 660].forEach((f, i) => tone(f, 0.12, { type: 'square', vol: 0.07, delay: i * 0.13 })),
    close:    () => { tone(90, 0.3, { vol: 0.32, to: 45 }); noise(0.12, { f: 400, q: 0.7, vol: 0.18 }); },
    death:    () => { tone(196, 1.1, { vol: 0.22, to: 185 }); tone(98, 1.4, { vol: 0.2 }); tone(392, 0.8, { type: 'triangle', vol: 0.05, delay: 0.02 }); },
    spread:   () => tone(300 + Math.random() * 500, 0.08, { vol: 0.05, to: 700 }),
    cure:     () => { tone(660, 0.12, { vol: 0.15 }); tone(660, 0.12, { vol: 0.15, delay: 0.25 }); tone(494, 0.45, { vol: 0.13, delay: 0.5 }); },
    news:     () => { // breaking-news sting
      [523, 659, 784].forEach((f, i) => tone(f, 0.14, { type: 'sawtooth', vol: 0.1, delay: i * 0.11 }));
      tone(1047, 0.55, { type: 'sawtooth', vol: 0.12, delay: 0.36 }); tone(523, 0.55, { type: 'square', vol: 0.06, delay: 0.36 });
      noise(0.15, { f: 5000, ftype: 'highpass', vol: 0.05, delay: 0.34 });
    },
    newsClose:() => noise(0.2, { f: 1500, fto: 5000, vol: 0.1 }),
    win:      () => [196, 185, 175, 147].forEach((f, i) => { tone(f, 0.9, { type: 'sawtooth', vol: 0.1, delay: i * 0.35, to: f * 0.97 }); tone(f / 2, 1, { vol: 0.2, delay: i * 0.35 }); }),
    trophy:   () => { [784, 988, 1175, 1568].forEach((f, i) => tone(f, 0.22, { type: 'triangle', vol: 0.16, delay: i * 0.08 })); tone(2093, 0.7, { vol: 0.1, delay: 0.34 }); tone(392, 0.5, { type: 'sawtooth', vol: 0.05, delay: 0.3 }); },
    lose:     () => { [392, 494, 587, 784].forEach((f, i) => tone(f, 0.5, { type: 'triangle', vol: 0.15, delay: i * 0.18 })); tone(1047, 0.9, { vol: 0.13, delay: 0.74 }); },
  };

  function playFile(name, src) {
    try {
      const a = new Audio(src);
      a.volume = Math.min(1, level() * ((man.volume && man.volume[name]) || 1));
      a.onerror = () => { bad[name] = true; synth(name); };
      const p = a.play(); if (p && p.catch) p.catch(e => { if (e && e.name === 'NotSupportedError') { bad[name] = true; synth(name); } });
    } catch (e) { bad[name] = true; synth(name); }
  }
  function synth(name) { if (!ctx || !SFX[name]) return; try { SFX[name](); } catch (e) {} }
  function play(name) {
    if (muted) return;
    const now = performance.now(), gap = GAP[name] || 0;
    if (lastPlayed[name] && now - lastPlayed[name] < gap) return;
    lastPlayed[name] = now;
    const f = man.sfx && man.sfx[name];
    if (f && !bad[name]) playFile(name, f); else synth(name);
  }

  // ----- music: a slow generative drone that gets darker as the pandemic worsens -----
  function startSynthMusic() {
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 260; lp.Q.value = 0.7;
    const g = ctx.createGain(); g.gain.value = 0.4; lp.connect(g); g.connect(musBus);
    const oscs = [[55, 'sawtooth', 0], [82.41, 'sawtooth', 6], [110.4, 'triangle', -5], [164.8, 'sine', 3]].map(([f, type, det]) => {
      const o = ctx.createOscillator(); o.type = type; o.frequency.value = f; o.detune.value = det;
      const og = ctx.createGain(); og.gain.value = 0.12; o.connect(og); og.connect(lp); o.start(); return o;
    });
    const lfo = ctx.createOscillator(); lfo.frequency.value = 0.07;
    const lg = ctx.createGain(); lg.gain.value = 110; lfo.connect(lg); lg.connect(lp.frequency); lfo.start();
    mus = { lp, g, oscs, lfo };
    (function beat() { // heartbeat when things get tense
      if (!musicOn) return;
      if (!muted && ctx.state === 'running' && tension > 0.35) {
        const a = 0.12 + 0.2 * tension;
        tone(62, 0.14, { vol: a, to: 38, bus: musBus }); tone(58, 0.16, { vol: a * 0.8, to: 36, delay: 0.19, bus: musBus });
      }
      setTimeout(beat, 1500 - 800 * tension);
    })();
    applyTension();
  }
  function startFileMusic() {
    fileMus = {};
    for (const k of ['calm', 'tense', 'panic']) {
      const src = man.music && man.music[k]; if (!src) continue;
      const a = new Audio(src); a.loop = true; a.volume = 0; a.onerror = () => { delete fileMus[k]; };
      fileMus[k] = a; const p = a.play(); if (p && p.catch) p.catch(() => {});
    }
    setInterval(applyTension, 250);
  }
  function applyTension() {
    if (mus && ctx) {
      const t = ctx.currentTime;
      mus.lp.frequency.setTargetAtTime(220 + 900 * tension, t, 1.5);
      mus.g.gain.setTargetAtTime(0.3 + 0.3 * tension, t, 1.5);
      mus.oscs[1].detune.setTargetAtTime(6 + 25 * tension, t, 2);
    }
    if (fileMus) {
      const want = { calm: Math.max(0, 1 - tension * 2.2), tense: 1 - Math.abs(tension - 0.5) * 2.2, panic: Math.max(0, (tension - 0.45) * 1.8) };
      for (const k in fileMus) { const a = fileMus[k], target = Math.max(0, Math.min(1, want[k])) * level() * 0.6; a.volume = a.volume + (target - a.volume) * 0.35; }
    }
  }

  function unlock() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
    try {
      const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
      ctx = new AC();
      master = ctx.createGain(); master.gain.value = level(); master.connect(ctx.destination);
      analyser = ctx.createAnalyser(); analyser.fftSize = 1024; master.connect(analyser);
      sfxBus = ctx.createGain(); sfxBus.gain.value = 0.9; sfxBus.connect(master);
      musBus = ctx.createGain(); musBus.gain.value = 0.5; musBus.connect(master);
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      musicOn = true;
      if (man.music && (man.music.calm || man.music.tense || man.music.panic)) startFileMusic(); else startSynthMusic();
    } catch (e) { ctx = null; }
  }
  function setMuted(m) {
    muted = !!m; persist();
    if (master) master.gain.setTargetAtTime(level(), ctx.currentTime, 0.05);
    applyTension();
  }
  function setVolume(v) { vol = Math.max(0, Math.min(1, v)); persist(); if (master) master.gain.setTargetAtTime(level(), ctx.currentTime, 0.05); applyTension(); }
  function setTension(t) { tension = Math.max(0, Math.min(1, t)); applyTension(); }

  if (typeof document !== 'undefined') document.addEventListener('visibilitychange', () => {
    if (!ctx) return;
    if (document.hidden) { ctx.suspend(); if (fileMus) for (const k in fileMus) fileMus[k].pause(); }
    else { ctx.resume(); if (fileMus) for (const k in fileMus) fileMus[k].play().catch(() => {}); }
  });

  return {
    unlock, play, setTension, setMuted, setVolume,
    get muted() { return muted; }, get volume() { return vol; },
    names: Object.keys(SFX),
    // for tests: current output level (RMS) and context state
    probe() { if (!analyser) return { state: 'none', rms: 0 }; const a = new Float32Array(analyser.fftSize); analyser.getFloatTimeDomainData(a); let s = 0; for (const x of a) s += x * x; return { state: ctx.state, rms: Math.sqrt(s / a.length) }; },
  };
})();
