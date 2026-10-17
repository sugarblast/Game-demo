# Outbreak Protocol: how the family works

**Daddy chat** (the lead chat) owns the game code and the contracts. **Baby chats** each own one asset area and plug in
through a contract file, so they never touch the game code and can't break it.

## Who owns what

| Owner | Owns | Never touches |
|---|---|---|
| Daddy chat (lead) | `src/*`, `index.html`, `build.js/.py`, balance, contracts, tests | the baby asset files |
| Sound baby | `assets/audio/*` (`manifest.js`, mp3/ogg files, `CREDITS.md`) | everything else |
| Writers' Room baby | `assets/content/extra.js` | everything else |

Prompts to paste into the baby chats: `docs/BABY_SOUND.md` and `docs/BABY_WRITERS.md`.

## Workflow

1. Open a new chat, paste a baby's prompt, and answer its questions.
2. Save what it gives you into the project folder (same paths it names).
3. Run its checker: `python tools/check_audio.py` or `python tools/validate_content.py`. Fix anything it flags with the baby.
4. Open `index.html` and play for a minute.
5. Paste the baby's `REPORT TO LEAD CHAT` block back to Daddy chat. Daddy chat reviews it and decides if the game code or the contract needs to change.

## Rules for every baby

- Don't change the contract. Ask for changes through the report.
- Original or CC0 only. No copied game audio, no copied text, no real people or brands.
- Free and lightweight: whole project stays under about 10 MB, nothing that needs a paid service.

## More babies when you want them (ask Daddy chat for the prompt)

- **Map and Data baby:** swaps the hand-drawn regions for real country borders and real World Bank numbers. Needs a machine with internet, so it works best with a Python script you run on your laptop.
- **Art baby:** favicon, share image for social links, maybe a logo.
- **Playtest baby:** plays your game and writes up balance feedback.
