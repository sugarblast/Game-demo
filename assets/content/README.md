# assets/content

The game ships with built-in headlines (in `src/news.js`). Anything in `extra.js` is **added** to them, never replaces them.
More lines means fewer repeats. The text is picked at random, so the more variety the better.

## How it plugs in

`extra.js` must be exactly one assignment holding **strict JSON** (double quotes, no trailing commas, no comments):

```js
window.OUTBREAK_CONTENT = {
  "ticker":   { "air": ["{p} lands in {r} with carry-on only."] },
  "breaking": { "random": [ { "h": "Headline here", "s": "Subline here." } ] }
};
```

Tokens: `{p}` = the pathogen's name (any line). `{r}` = a region name (only where the table says so).
Region names are things like "Russia", "Greenland", "Sudan & South Sudan", "Central America", so any `{r}` joke has to work for ANY region.

## ticker keys (one short line each, max 110 characters)

| key | fires when | tokens |
|---|---|---|
| zero | game starts, patient zero | p, r |
| air / sea / land | infection reaches a NEW region by air / sea / land | p, r |
| death | first deaths in a region | p, r |
| detect | a region's doctors identify the disease | p, r |
| closeB / closeA / closeS | region closes borders / airports / ports | p, r |
| lock | region goes into lockdown | p, r |
| cure25 / cure50 / cure75 | cure research milestone | p |
| sab | player sabotages the cure (no region) | p |
| hintCold / hintHot | pathogen stalls in a cold or hot region (keep it informative) | p, r |
| winEnd / loseEnd / burnEnd | last headline of the game | p |

## breaking keys (a headline `h` max 80 chars, a subline `s` max 160 chars)

These interrupt the game with a full-screen BREAKING NEWS card the player has to cross out.

| key | fires when | tokens |
|---|---|---|
| detect1 | the first region in the world detects the disease | p, r |
| death1 | the first deaths anywhere | p, r |
| close1 | the first border / airport / port closure | p, r |
| inf_100k / inf_1b | infected passes 100 thousand / 1 billion | p |
| dead_1m / dead_100m / dead_1b | dead passes 1 million / 100 million / 1 billion | p |
| cure25 / cure50 / cure75 | cure milestone | p |
| regions25 | disease is in 25 regions | p |
| sab1 | the first time the player sabotages the cure | p |
| random | a satire interrupt every 90 to 140 days | p |

## Rules of the joke

Satire aimed at systems, companies, habits and trends. Never real people, politicians, parties, real brand names, religions,
nationalities, ethnic groups or stereotypes of any place. No jokes at the expense of the sick or the dead (dark humor
aims at institutions, not victims). PG-13.

## Check your work

`python tools/validate_content.py` from the project folder.
