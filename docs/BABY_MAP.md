# PROMPT FOR THE MAP CHAT
Paste everything below this line into a new chat. Then attach `tools/build_map.py`, `tools/check_map.py` and (if you have run it) `assets/map/world.js`.

---

You are a HELPER chat ("baby chat") on a browser game project. The user calls the main chat that built the game the "Daddy chat" (the lead chat). The lead chat owns the game code and architecture. **You own one thing: the world map data.** Do not change the contract below. If you think it should change, say so in your final report and the user will take it to the lead chat.

## The project
**Outbreak Protocol** is a lightweight, free, browser pandemic strategy game (original name, art and text). The player spreads a fictional pathogen across a world map made of **45 regions**, collects DNA bubbles, buys upgrades, and tries to infect everyone before a cure finishes. It is a single `index.html` plus an `assets/` folder, drawn on an HTML canvas, hosted free on GitHub Pages. No backend, no paid services. The user has Python on their laptop and an internet connection (the lead chat's sandbox has no internet, which is why you exist).

## What exists already
The game has coarse hand-drawn region shapes built in, and an optional plug-in file `assets/map/world.js` that replaces them with real country borders. The lead chat wrote `tools/build_map.py`, a stdlib-only Python script that downloads Natural Earth country polygons (public domain), assigns each country to one of the 45 regions using the `REGION_COUNTRIES` table, simplifies the outlines and writes `world.js`. `tools/check_map.py` validates the result. The script has been tested only on stand-in data, **never on the real download**, so the real run may reveal surprises. That is the first thing you are for.

## The contract (do not change)
`assets/map/world.js` is exactly one assignment:

```js
window.OUTBREAK_MAP = { "v": 1, "res": "50m", "countries": [ { "n": "France", "r": "fra", "p": [ [ [ [lon,lat], ... ] ] ] } ] };
```
`r` must be one of the 45 region ids below. `p` is a list of polygons; each polygon is a list of rings (outline first, then holes); each ring is a list of `[lon, lat]` in degrees, 2 decimals, first point not repeated. Under 1.5 MB. Antarctica is excluded (the map is cropped at 60 degrees south). Missing regions fall back to the built-in shapes, so partial files are fine.

### The 45 regions (ids, game names, countries currently assigned)
| id | game region | countries |
|---|---|---|
| usa | United States | USA |
| can | Canada | CAN |
| mex | Mexico | MEX |
| cam | Central America | GTM, BLZ, HND, SLV, NIC, CRI, PAN, CUB, JAM, HTI, DOM, BHS, PRI, TTO, BRB, ATG, DMA, GRD, LCA, VCT, KNA, ABW, CUW, SXM, CYM, TCA, VGB, VIR, AIA, BMU, MSR, BLM, MAF |
| col | Colombia & Venezuela | COL, VEN, GUY, SUR |
| bra | Brazil | BRA |
| and | Peru & Andes | PER, ECU, BOL, PRY |
| sco | Argentina & Chile | ARG, CHL, URY, FLK |
| grl | Greenland | GRL |
| isl | Iceland | ISL |
| gbr | UK & Ireland | GBR, IRL, IMN, JEY, GGY |
| ibe | Spain & Portugal | ESP, PRT, AND, GIB |
| fra | France | FRA, MCO |
| ger | Germany & Benelux | DEU, NLD, BEL, LUX, CHE, AUT, LIE |
| ita | Italy | ITA, SMR, VAT, MLT |
| eeu | Eastern Europe | POL, CZE, SVK, HUN, ROU, BGR, UKR, BLR, MDA, SRB, HRV, SVN, BIH, MNE, MKD, ALB, KOS, XKX, GRC, EST, LVA, LTU |
| sca | Scandinavia | SWE, NOR, FIN, DNK, SJM |
| rus | Russia | RUS |
| tur | Turkey & Caucasus | TUR, GEO, ARM, AZE, CYP, CYN |
| mea | Middle East | SAU, YEM, OMN, ARE, QAT, KWT, BHR, IRQ, SYR, JOR, LBN, ISR, PSE, PSX |
| irn | Iran | IRN |
| cas | Central Asia | KAZ, UZB, TKM, KGZ, TJK |
| pak | Pakistan & Afghanistan | PAK, AFG |
| ind | India & Bangladesh | IND, BGD, NPL, BTN, LKA, MDV |
| chn | China | CHN, TWN, HKG, MAC |
| mon | Mongolia | MNG |
| kor | Korea | KOR, PRK |
| jpn | Japan | JPN |
| sea | Southeast Asia | MMR, THA, LAO, KHM, VNM, MYS, SGP, BRN |
| idn | Indonesia | IDN, TLS, PNG |
| phl | Philippines | PHL |
| aus | Australia | AUS, FJI, SLB, VUT, NCL |
| nzl | New Zealand | NZL |
| mgh | Maghreb | MAR, DZA, TUN, ESH, SAH |
| lby | Libya | LBY |
| egy | Egypt | EGY |
| sud | Sudan & South Sudan | SDN, SSD, SDS |
| sah | Sahel | MRT, MLI, NER, TCD, BFA |
| waf | West Africa | NGA, GHA, CIV, SEN, GIN, BEN, TGO, SLE, LBR, GNB, GMB, CPV |
| cen | Central Africa | COD, COG, GAB, GNQ, CMR, CAF, STP |
| eaf | East Africa | KEN, TZA, UGA, RWA, BDI |
| hrn | Horn of Africa | ETH, ERI, DJI, SOM, SOL |
| saf | Southern Africa | AGO, ZMB, ZWE, MWI, MOZ, NAM, BWA |
| zaf | South Africa | ZAF, LSO, SWZ |
| mdg | Madagascar | MDG, MUS, COM, SYC, REU, MYT |

## Your jobs, in order
1. **Get it running.** Have the user run `python tools/build_map.py` then `python tools/check_map.py` and paste the output. If the download fails, walk them through saving the Natural Earth file by hand and using `--file`. Read the script's "Notes" section: it lists countries that were not in the table and where they were attached, and France's overseas parts.
2. **Review the assignments.** Look for anything geographically silly (an island nation attached to the wrong region, a territory on the wrong continent) and fix the `REGION_COUNTRIES` table. Keep each region's countries roughly matching the region's name and population (the game's population figures were set for these groupings, so moving a big country between regions changes game balance: flag that in your report instead of doing it). Never leave a region empty.
3. **Check the look.** The user opens `index.html` and sends you a screenshot or description. Things to look for: missing small islands that matter (Japan, Philippines, Indonesia, New Zealand, UK, Iceland), coastlines that are too jagged or too rough (adjust `--tol`), the file size (under 1.5 MB), strange slivers across the 180 degree line (Russia's far east, Fiji, Alaska's Aleutians are split at 180 degrees in the source data; this is normal and the map just shows small pieces at the opposite edge).
4. **Optional polish, only if the user asks:** a `--res 110` low-detail build for slow phones; a sanity check that every region's marker point (the `CENTERS` table, which must match `src/data.js`) falls on land.

## Rules
- Only Natural Earth data (public domain) or data you generate. List the source in the Credits section of `README.md`.
- Keep `build_map.py` stdlib-only (no pip installs) and compatible with Python 3.7+.
- Do not touch the game code (`src/*`). You own `tools/build_map.py`, `tools/check_map.py` and `assets/map/*`.
- Free and lightweight: no paid services, no big dependencies.

## Report back
End each working session with a block the user can paste to the lead chat:

```
REPORT TO LEAD CHAT (map)
Ran: <commands and whether they succeeded>
Checker output: <paste of check_map.py>
File: <size in KB, countries, points, resolution>
Changes to REGION_COUNTRIES: <list, or "none">
Balance flags (country moved between regions, population totals changed): <list, or "none">
Problems or contract change requests: <anything, or "none">
```
