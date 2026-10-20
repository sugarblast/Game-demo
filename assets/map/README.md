# assets/map

The game ships with simple hand-drawn continent shapes. This folder lets you replace them with **real country borders**.
`world.js` here is a one-line stub that changes nothing until you build the real thing.

## Get real borders (one command, needs internet once)

From the project folder:

```
python tools/build_map.py
python tools/check_map.py
```

That downloads the free Natural Earth country borders (public domain), assigns every country to one of the game's 45
regions, simplifies the outlines, and overwrites `world.js`. Reload `index.html` and you have a real map. Nothing to install.

If the download is blocked (some networks do), open the link the script prints in your browser, save the page with Ctrl+S
as a `.geojson` file, and run `python tools/build_map.py --file path/to/that/file.geojson`.

Options: `--res 110` is smaller and blockier, `--res 50` (default) looks better, `--tol 0.1` makes the file smaller and the
coastlines rougher, `--tol 0.03` the opposite.

Upload the `assets` folder next to `index.html` when you host the game (same as the audio folder).

## How it works

- The game still has **45 regions** (that is where the population, wealth and climate numbers live). With real borders each
  region is drawn as the union of its member countries, so "West Africa" is Nigeria, Ghana, Senegal and so on, all taking the
  region's infection color. Hover or click any country and the whole region lights up.
- Which country belongs to which region is the `REGION_COUNTRIES` table at the top of `tools/build_map.py`. A country that is
  not in the table is attached to the nearest region, and the script prints what it did. Edit the table and rerun to move
  countries around.
- If `world.js` is missing, broken, or only covers some regions, the game quietly keeps its hand-drawn shapes for whatever is
  missing. A bad file cannot break the game.
- Colors: land is colored by climate zone (green temperate, sand hot, pale tundra cold) with a slightly different shade per
  country, and infection mixes toward red on top. The colors live at the top of `src/map.js` (`LAND`).

## The file format (contract)

```js
window.OUTBREAK_MAP = {
  "v": 1,
  "countries": [
    { "n": "France", "r": "fra", "p": [ [ [ [lon,lat], [lon,lat], ... ] ] ] }
  ]
};
```

`n` is the country name, `r` is the region id (see below), `p` is a list of polygons, each polygon is a list of rings (the first
is the outline, any others are holes such as lakes), each ring is a list of `[lon, lat]` pairs in degrees (2 decimals, no need to
repeat the first point). Keep the whole file under 1.5 MB.

## Region ids

| id | game region | countries (as built by tools/build_map.py) |
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

## Credits

Borders: Natural Earth, public domain (naturalearthdata.com).
