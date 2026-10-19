# assets/audio

The game already makes its own sounds (synthesized in the browser). Anything you put here **overrides** the built-in
version, one sound at a time. Missing or broken files silently fall back to the built-in sound, so you can add files gradually.

## How it plugs in

Edit `manifest.js` (strict, simple JavaScript, paths relative to `index.html`):

```js
window.OUTBREAK_AUDIO = {
  sfx: {
    click: 'assets/audio/click.mp3',
    dna:   'assets/audio/dna.mp3'
    // ...any of the 16 names below
  },
  music: {
    calm:  'assets/audio/music_calm.mp3',
    tense: 'assets/audio/music_tense.mp3',
    panic: 'assets/audio/music_panic.mp3'
  },
  volume: { click: 0.5, news: 0.8 }   // optional, per-sound multiplier 0..1
};
```

## The 16 sound effects

| name | plays when | feel | max length |
|---|---|---|---|
| click | any button press | tiny soft UI tick | 0.1 s |
| dna | player collects a DNA bubble (hundreds per game!) | bright satisfying bubble pop, never annoying | 0.3 s |
| gold | player collects a rare gold bubble | sparkly reward | 0.8 s |
| buy | player buys an upgrade | "mutation acquired" confirm | 0.6 s |
| deny | tries to buy something unaffordable or locked | soft low buzz | 0.3 s |
| sabotage | player sabotages the cure | sneaky glitch, fizzle, glass crack | 1.0 s |
| detect | doctors in a country identify the disease | double-beep alarm | 1.0 s |
| close | border, airport or port closes, or a lockdown starts | heavy thud, gate clang | 0.6 s |
| death | first deaths in a country | low somber toll | 2.0 s |
| spread | infection reaches a new country (frequent, throttled) | very tiny unobtrusive blip | 0.15 s |
| cure | cure reaches 25, 50, 75% | lab beep, ominous tick | 1.2 s |
| news | a BREAKING NEWS interrupt appears | urgent TV news sting, a little comedic | 2.5 s |
| newsClose | player crosses out the breaking news | quick swish | 0.3 s |
| trophy | a trophy unlocks | proud little fanfare, quick and cheerful | 1.5 s |
| win | pathogen infects everyone | dark triumphant stinger | 4 s |
| lose | cure deployed | hopeful, relieved stinger | 4 s |

## Music (optional)

Three loops, **same length, same tempo, same key, seamless loop**. The game plays all three at once and crossfades by how bad
things are: `calm` (early), `tense` (middle), `panic` (late). If any music file is listed, the built-in drone is replaced by the files.

## File rules

mp3 or ogg. SFX: mono, 44.1 kHz, under 60 KB each. Music: 128 kbps, under 1.5 MB each, 40 to 90 seconds.
Whole folder under 5 MB. Only original, generated or CC0 audio. List every source in `CREDITS.md`.

## Check your work

`python tools/check_audio.py` (from the project folder) and open `tools/soundboard.html` in a browser to audition everything.
