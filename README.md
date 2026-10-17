# Outbreak Protocol

A lightweight browser pandemic strategy game. No frameworks, no backend, no paid anything.

## Play

Double-click `index.html`. That's it. (Or run `python -m http.server` here and open http://localhost:8000.)

How it plays: name a pathogen, pick where it starts, click the DNA bubbles that pop up on infected regions (that is your main
DNA income, idle DNA is tiny), spend DNA in Evolve, and sabotage the cure before humanity finishes it. Cold regions need cold resistance,
hot regions need heat resistance. Breaking News interrupts pause the game until you cross them out. Keys: Space pause, 1/2/3 speed,
E evolve, S sabotage, M mute.

## Folder map

```
index.html            the whole game, built from src/ (open this)
src/                  source: data.js (regions), sim.js (rules + balance TUNE), news.js (jokes), audio.js, map.js, ui.js
assets/audio/         optional real sound files + manifest.js (Sound helper chat)
assets/content/       optional extra headlines, extra.js (Writers' Room helper chat)
tools/                validate_content.py, check_audio.py, soundboard.html
docs/                 PROJECT_BRIEF.md and the prompts for the helper chats
test/                 bot.js (balance bots), climate.js, smoke.js (browser test, needs Node + Playwright)
build.py / build.js   rebuild index.html after editing src/ (python build.py)
```

## Change the game

Edit files in `src/`, then run `python build.py`. Balance numbers are in the `TUNE` block at the top of `src/sim.js`.
`node test/bot.js 8` plays bot games with different player types and prints win rates, so you can see the effect of a change.

## Host for free

GitHub Pages: put this whole folder in a public repo, Settings, Pages, deploy from the main branch. Cloudflare Pages and itch.io
(upload a zip) also work. Upload the `assets` folder too if you use it.
