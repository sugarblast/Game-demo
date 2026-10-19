# Outbreak Protocol

A lightweight browser pandemic strategy game. No frameworks, no backend, no paid anything. Entirely vibe coded based on Plague Inc inspiration. Just testing out vibe coding and reverse engineering capabilities using AI. For this specific project, I used free version of Claude AI total working hours on this upto now 2 hours.

## Play

 To play open (https://sugarblast.github.io/Game-demo/)

How it plays: name a pathogen, pick where it starts, click the DNA bubbles that pop up on infected regions (that is your main
DNA income, idle DNA is tiny), spend DNA in Evolve, and sabotage the cure before humanity finishes it. Cold regions need cold resistance,
hot regions need heat resistance. Breaking News interrupts pause the game until you cross them out. Keys: Space pause, 1/2/3 speed,
E evolve, S sabotage, M mute.

## Ratings, trophies and your saved progress

Every finished game gets a **pandemic rating** from how many people died: Barely a Cough, Silent Pandemic, Deadly Pandemic,
Global Catastrophe, Civilization Collapse, Apocalypse (thresholds are in `RATINGS` in `src/trophies.js`). There are also 26 **trophies**
(first win, every region infected, a golden DNA bubble, winning with the cure at 90%...). Unlocks pop up mid-game, and the 🏆 Trophy Room
(top bar, start screen or end screen) lists everything, with your best rating, fastest win and recent runs.

Progress is saved in your browser (localStorage, key `outbreak-protocol-profile-v1`). It stays on that browser and that address. To move it
or back it up, open the Trophy Room, "Back up or move your progress", and copy the code. Pasting a code on another browser merges it and never removes progress.

## Folder map

```
index.html            the whole game, built from src/ (open this)
src/                  source: data.js (regions), sim.js (rules + balance TUNE), news.js (jokes), trophies.js (ratings + trophies), audio.js, map.js, ui.js
assets/audio/         optional real sound files + manifest.js (Sound helper chat)
assets/content/       optional extra headlines, extra.js (Writers' Room helper chat)
tools/                validate_content.py, check_audio.py, soundboard.html
docs/                 PROJECT_BRIEF.md and the prompts for the helper chats
test/                 bot.js (balance bots), climate.js, trophies.js (trophy unit tests), reach.js (can bots earn every trophy?), smoke.js (browser test, needs Node + Playwright)
build.py / build.js   rebuild index.html after editing src/ (python build.py)
```

## Change the game

Edit files in `src/`, then run `python build.py`. Balance numbers are in the `TUNE` block at the top of `src/sim.js`.
`node test/bot.js 8` plays bot games with different player types and prints win rates, so you can see the effect of a change.
`node test/trophies.js` and `node test/reach.js 10` check every trophy and rating. Run them after changing balance, because a trophy nobody can earn is a bug.
To add a trophy, add one entry to `TROPHIES` in `src/trophies.js` (the file explains the fields), add a case in `test/trophies.js`, then rebuild.

## Host for free

GitHub Pages: put this whole folder in a public repo, Settings, Pages, deploy from the main branch. Cloudflare Pages and itch.io
(upload a zip) also work. Upload the `assets` folder too if you use it.
