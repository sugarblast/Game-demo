# Outbreak Protocol

A lightweight browser pandemic strategy game. No frameworks, no backend, no paid anything. **Entirely vibe coded using Claude free model**, inspired by the pandemic-sim genre that *Plague Inc.* made popular. I built it to test what vibe coding and reverse-engineering a game's mechanics can really do with AI, using the **free version of Claude**. Total working time was about 2 hours, spread over five days (Oct 16 to 20, 2026).

### ▶ Play it: https://sugarblast.github.io/Game-demo/

> The name, code, jokes and sounds are original. This project is not affiliated with, and uses nothing from, *Plague Inc.* (Ndemic Creations).

**Jump to:** [How to play](#how-to-play) · [How I built it with AI](#how-i-built-it-with-ai) · [Problems and fixes](#problems-we-hit-and-how-they-were-solved) · [Run, change, test](#run-change-and-test) · [Optional plug-ins](#optional-plug-ins) · [Host for free](#host-for-free)

---

## How to play

Name a pathogen, pick where it starts, and spread it until everyone is infected, before humanity finishes its cure.

- **Click the green DNA bubbles** that pop up on infected regions. That is your main income; idle DNA is tiny on purpose.
- **Evolve** (22 upgrades in 3 tabs: Transmission, Symptoms, Abilities) to spread by air, sea and land, resist climates, hide, or turn lethal.
- **Sabotage the cure** (18 DNA, then a 24-day cooldown) to slow it down.
- **Climate matters.** A cold start (Russia) needs cold resistance, a hot one (India) needs heat resistance. Without it, spread there is halved.
- **Breaking News** interrupts pause the game until you cross them out.
- **Click a country** to open its details card (hovering only highlights it). Click a bubble to collect it; that never selects the country under it.
- Travel animations: an airplane for "by air", a ship for "by sea", a small dot for "by land".
- Win by infecting 99.5% of the world. Lose if the cure reaches 100%.

Keys: `Space` pause · `1` `2` `3` speed · `E` evolve · `S` sabotage · `M` mute · `Esc` close · scroll or pinch to zoom · drag to pan.

### Ratings, trophies and saved progress

Every finished game gets a **pandemic rating** from how many people died: Barely a Cough, Silent Pandemic, Deadly Pandemic, Global Catastrophe, Civilization Collapse, Apocalypse. There are also **26 trophies** (first win, every region infected, a golden DNA bubble, a total lockdown of 40 regions, and so on). Unlocks pop up mid-game, and the 🏆 Trophy Room lists everything with your best rating, fastest win and recent runs.

Progress is saved in your browser (`localStorage`, key `outbreak-protocol-profile-v1`), so it stays on that browser and that address. To back it up or move it, open the Trophy Room, "Back up or move your progress", and copy the code. Pasting a code elsewhere merges it and never removes progress.

### The game in numbers

|  |  |
| --- | --- |
| Built with | plain HTML, CSS and JavaScript, Canvas 2D, Web Audio. Python and Node only for building and testing |
| Ships as | one `index.html` (about 130 KB) that works offline |
| Content | 45 world regions, 22 evolutions, 26 trophies, 6 ratings, 16 synthesized sound effects, about 100 original satirical headlines and breaking-news stories |
| Size | about 1,900 lines of game source, about 3,400 lines including build scripts, tools and tests |
| Tests | 5 automated suites (see [How it was tested](#how-it-was-tested)) |

---

## How I built it with AI

### The short version

|  |  |
| --- | --- |
| Tool | Claude (Sonnet 5.5), free plan, in a chat that could also run code: it had a file system, a shell, and a headless Chrome to check its own work |
| Time | about 2 h 16 min on the session timer when I last read it (about 74 min of Claude generating, about 22 min of it running builds and tests), across five calendar days of building plus a few more days of finishing touches and this write-up |
| My requests | about a dozen real requests, plus **"continue" at least 6 times** |
| Code | Claude wrote essentially all of it. The session log counted about 3,500 lines written and about 220 removed |
| Start | a screenshot of *Plague Inc.* and one question: what is the best language and app to make this for a browser? |

### Who did what

I want to be clear about this, because "vibe coded" can mean anything.

**Claude** wrote the code, the satirical text, the sound synthesis, the build scripts and the tests, and it ran them.

I came up with the idea, made every product decision, play-tested it (on my laptop, and I noticed problems on a small phone screen), wrote the bug reports, ran the build on my own computer, deployed it to GitHub Pages, and wrote one piece of UI myself: the HOW TO PLAY box on the start screen. I pasted my version into the chat and Claude merged it and fixed the layout bug underneath it.

The game's feel, its pacing, and what was annoying or broken came from me playing it. The automated tests Claude wrote could not judge those, and I found out below how important that was.

### Why I typed "continue" so many times

I used the free plan, so I hit limits constantly. Two different things made me type **"continue"**:

1. **A long answer got cut off.** The first full build of the game was one very large file. Claude's response ran into the output and usage limit mid-way, and I had to type "continue" several times to get it to pick up where it stopped.
2. **The chat ran out of room.** Conversations have a fixed size. When this one filled up (it happened at least twice), the system summarized everything so far into a short brief and started a fresh context from it. I resumed with "continue" each time.

In total I typed "continue" **at least 6 times**, and it worked because **everything lived in files in a project folder, not in the chat**. The code, the tests and a written project brief (`docs/PROJECT_BRIEF.md`) survived every reset. If the project had existed only as chat messages, each reset would have lost it. This was the most practical lesson of the whole build.

### Problems we hit and how they were solved

| # | Problem | How it showed up | How it was solved |
| --- | --- | --- | --- |
| 1 | Game too easy and too fast | I played it | Slower clock, DNA mainly from hand-collected bubbles, idle income made tiny (tested), cure and sabotage retuned with bot players |
| 2 | Cold or hot start had no consequence | My question about Russia | Climate multipliers by region plus a hint in the news, with tests |
| 3 | Some ratings and trophies could not be earned | Claude's bot players finished games with only 0 to 13% of the world dead, so the top ratings and three trophies were out of reach | Recalibrated to 6 rating levels, replaced the impossible trophies, and added `test/reach.js`, which plays 600 bot games and reports what is reachable |
| 4 | A reachability run with a small sample missed two trophies ("island" and "reaper") | The default sample never even started a game on an island, and one of the rare high-death wins did not show up | Checked with the old and new code and larger samples: sampling luck, not a bug. The test now plays 40 games per combination, and all 26 trophies and 6 ratings are reachable |
| 5 | Real map was slow | Claude's first timings looked impossibly fast (0.2 ms), because canvas drawing is deferred. It re-measured by reading pixels back and found 54 to 86 ms per frame | Removed the expensive wide "coast glow", simplified outlines, and later cached the land in an off-screen layer. A still frame is now about 1 ms (6 to 10 ms before) in the headless test browser |
| 6 | Could not download real borders | Claude's environment blocked outside network access | A script I run once on my own computer, a checker, a manual-file fallback, and a rule that a missing or bad map file falls back to the built-in shapes |
| 7 | Start screen clipped on phones | My phone screenshot and the word "whack" | Root cause: centered flex layout cuts off tall boxes. Changed the layout for all pop-ups, folded Settings into a collapsible section, hid the game controls behind the start screen on phones |
| 8 | Info card blocked the country and the DNA bubbles | My screenshot and bug report | Measured first: the old hover card covered the bubble in 24 of 45 regions. Now the card opens only on click and docks in a corner that is free of bubbles, the legend and the zoom buttons: 0 of 45 regions, at 3 screen sizes |
| 9 | Map sometimes felt "stuck" | My report | Found four real causes: a right-click could leave a drag stuck on, alt-tabbing mid-drag left the map following the mouse, a mouse-up the page never saw never ended the drag, and the scroll wheel barely zoomed in browsers that report lines instead of pixels. All fixed and tested |
| 10 | A bug in Claude's own fix | Its new test failed on a phone-size screen | The card's width depended on where it sat, so it was measured wrongly and could land on the zoom buttons. Fixed by making its width independent of position |
| 11 | A "failing" test that was actually right | The smoke test clicked a country where a DNA bubble sat, so it collected the bubble instead | That is the behavior I asked for (bubble clicks and country clicks are different). The test was changed to match, and a new test checks the rule directly |
| 12 | Bubbles could overlap | Seen while testing | New bubbles pick a spot away from the others in the same region, and a click takes the nearest bubble |
| 13 | Pop-ups were sluggish, especially BREAKING NEWS on a big screen | Not reported by me. A lag test showed a burst of slow frames, and a profile showed the page's own code was fast; the time was spent blurring the live map behind full-screen cards (a CSS `backdrop-filter`) | Measured 65 ms per frame (about 15 fps) at 1900x950 with a card open. Removed the blur (the card is already 87 to 93% opaque, so it looks the same) and stopped redrawing the hidden map at full speed while a pop-up is open. Now 16.7 ms (60 fps), and a test guards it |

### The kinds of requests I used

Looking back, my prompts fell into a few types, and some worked much better than others.

1. **Ask before building.** *"what would be the best language and app…"* before asking it to build anything.
2. **Goal plus constraints.** *"no paid tier anything just a lightwegiht website… tell me what i can use to host it for free"*. The constraints shaped every later choice (single file, no backend, free hosting).
3. **Numbered play-test feedback.** One message with five numbered points was easier for Claude to act on than five separate messages.
4. **Questions as tests.** *"…do we have logic like that?"* checks the AI's model of the game without telling it what to build.
5. **Ask for an opinion.** *"…or what do you think?"* turned a vague wish into a design: ratings, trophies, a saved profile, and later the recalibration.
6. **Answers only.** *"just tell me what and where to chnage"*, when I wanted to learn the code.
7. **Delegate with a contract.** *"give me a prompt that i can give to another chat"*, see below.
8. **Screenshots and my own words for bugs.** Plain language and a screenshot were enough. *"its like its stuck"* became four concrete bugs once Claude went looking.
9. **Bring my own code.** Pasting my edited `showStart()` was faster than describing it.
10. **Make the design call myself.** Splitting "click a country" from "click a bubble" was my decision; Claude's job was to carry it out and test it.
11. **Ask for proof.** *"runs tests to see it its working without bugs and lags now"*.
12. **"continue".**

### Working with more than one chat

I called the main chat the "daddy chat" and any helper chats "babies", partly as a joke. The idea was real: the main chat owns the game code, and helper chats each own a single asset area (sound, headlines, map data). They plug in through a fixed **contract file** (for example `assets/audio/manifest.js`), and each comes with a **checker script** and a prompt that ends with a "REPORT TO LEAD CHAT" block. The idea is that a helper chat can never break the game. A bad file falls back to the built-in version. The prompts are in `docs/`.

### How it was tested

Claude ran all of these itself in its own environment, and I could rerun them on my computer.

| Suite | What it checks |
| --- | --- |
| `test/bot.js`, `test/climate.js` | Balance: bot players of different styles. A stealthy plan beats the cure, a purely lethal plan does not, and doing nothing never wins. Cold and hot climates behave as designed |
| `test/trophies.js` | 106 checks on ratings, trophies, merging and backup codes |
| `test/reach.js` | 600 simulated games prove all 26 trophies and 6 ratings can be earned |
| `test/maptest.js` | 37 checks on the real-map pipeline, using stand-in data, bad-file fallbacks and frame times |
| `test/smoke.js` | 45 browser checks: start screen on a phone, trophies, saving, backup codes, sound, breaking news |
| `test/input.js` | 53 browser checks with real mouse and touch events: details card and bubble clicking at three screen sizes, stuck-input cases, the plane and ship icons, and lag under heavy use (including with a full-screen BREAKING NEWS card open). Lag is judged on the median of three short windows, because a shared test machine has the odd hiccup |

**What testing could not catch.** Every problem about feel came from me, not the tests: the game being too easy, the phone layout, the card hiding the bubbles. And Claude cannot hear. Tests confirm that all 16 sounds play and are not silent, but whether they sound good is for a human to judge.

### Honest limits

- **Kill all of humanity** is not a win condition. You win at 99.5% infected; deaths only decide your rating. An optional "finale" mode was discussed but not built.
- **The map uses simplified hand-drawn regions by default.** Real borders come from running `python tools/build_map.py`. Claude could only test that script against stand-in data, not the live download, so the first real run on a new computer might need a tweak.
- **Balance** was tuned by bot players and my own play, not by many testers.
- **Progress lives in one browser.** No accounts, no leaderboard (there is no backend).
- **Speed numbers** come from a headless test browser, not every device.
- **Phones work, but** the map is small and bubbles look large on it, and the top bar wraps to three rows.

### What I learned

1. **Playing it is the human job.** The AI can test logic, but pacing, annoyance and phone layout came from me noticing.
2. **Keep the project in files, not in the chat.** That is why "continue" worked after every cut-off and every reset.
3. **Make the AI measure.** Its first speed numbers were wrong, and it caught that itself by reading pixels back. Asking it to test for lag also turned up a slowdown I had never noticed (the blurred pop-ups). "Did you check?" is worth asking.
4. **Ask it to find the root cause.** My "whack" phone screen turned out to be a layout bug affecting every pop-up.
5. **Split big work with contracts** so independent pieces cannot break each other.
6. **It is fine to say what you do not want.** "Answers only", "last changes", and "don't worry about the other transmission types" kept the work focused.

---

## Project layout

```
index.html            the whole game, built from src/ (this is what gets hosted)
src/                  data.js (45 regions), sim.js (rules and the TUNE balance block), news.js (jokes),
                      trophies.js (ratings and trophies), audio.js, map.js (canvas map), ui.js (controls and screens),
                      style.css, template.html
assets/audio/         optional real sound files and manifest.js
assets/content/       optional extra headlines, extra.js
assets/map/           world.js: a stub until you build real borders
tools/                build_map.py, check_map.py, check_audio.py, validate_content.py, soundboard.html
docs/                 PROJECT_BRIEF.md and the prompts for the helper chats
test/                 the test files described under "How it was tested"
build.py / build.js   rebuild index.html from src/
```

## Run, change and test

Open `index.html` in a browser. To change the game, edit files in `src/`, then run `python build.py` (or `node build.js`; both make an identical file). Balance numbers are in the `TUNE` block at the top of `src/sim.js`.

```
node test/bot.js 8        # balance bots
node test/trophies.js     # trophy and rating unit tests
node test/reach.js        # can bots earn every trophy and rating?
node test/maptest.js      # real-map pipeline (needs Playwright)
node test/smoke.js        # browser smoke test (needs Playwright)
node test/input.js        # clicking, card, stuck input, icons, lag (needs Playwright)
```

To add a trophy, add one entry to `TROPHIES` in `src/trophies.js`, add a case in `test/trophies.js`, rebuild, and run `reach.js`, because a trophy nobody can earn is a bug.

## Optional plug-ins

None of these are needed. Each is a single file, and a missing or broken file silently falls back to the built-in version. The full contracts are in the helper-chat prompts in `docs/`.

**Sounds** (`assets/audio/manifest.js`, prompt: `docs/BABY_SOUND.md`). The game synthesizes all 16 effects (click, dna, gold, buy, deny, sabotage, detect, close, death, spread, cure, news, newsClose, trophy, win, lose). To replace any of them:

```
window.OUTBREAK_AUDIO = { sfx: { dna: 'assets/audio/dna.mp3' }, music: { calm: '…', tense: '…', panic: '…' } };
```

Use only original or CC0 audio. Check with `python tools/check_audio.py`, and audition with `tools/soundboard.html`.

**Extra headlines** (`assets/content/extra.js`, prompt: `docs/BABY_WRITERS.md`). One strict-JSON assignment, added to the built-in jokes:

```
window.OUTBREAK_CONTENT = { "ticker": { "air": ["{p} lands in {r} with carry-on only."] }, "breaking": { "random": [ { "h": "Headline", "s": "Subline." } ] } };
```

`{p}` is the pathogen's name and `{r}` a region. The rule: satire aimed at systems, companies and habits, never real people, brands or groups. Check with `python tools/validate_content.py`.

**Real country borders** (`assets/map/world.js`, prompt: `docs/BABY_MAP.md`, which also has the region table).

```
python tools/build_map.py     # downloads Natural Earth borders and writes assets/map/world.js
python tools/check_map.py     # checks the result
```

If the download is blocked, save the GeoJSON file yourself and run `python tools/build_map.py --file path/to/file.geojson`. Options: `--res 110` (smaller), `--res 50` (default, nicer), `--tol` (higher means rougher and smaller). The game still has 45 regions; with real borders each region is drawn as the union of its countries. Upload the `assets` folder next to `index.html` when you host.

## Host for free

GitHub Pages: put this folder in a public repo, then Settings → Pages → deploy from the main branch. Cloudflare Pages and itch.io (upload a zip) also work. Upload the `assets` folder too if you use any plug-ins.

## Credits

Written with Claude (Anthropic), directed and play-tested by me. Optional borders use [Natural Earth](https://www.naturalearthdata.com/) (public domain). Sounds are synthesized in the browser. All jokes are original.
