# GridPred data pipeline

Regenerates `src/data/snapshot/` from real Formula 1 session data. The frontend
never talks to FastF1 directly — it reads the snapshot these scripts produce,
through `src/services/fastf1.js`.

## Setup

```bash
python3 -m venv .venv && source .venv/bin/activate
pip install -r tools/requirements.txt
```

## Run, in this order

```bash
python tools/extract_circuits.py       # calendar + circuit geometry from telemetry
python tools/repair_circuits.py        # re-extract circuits whose first pass was poor
python tools/fetch_circuit_specs.py    # official length / turn counts (Wikipedia)
python tools/osm_fallback.py           # OpenStreetMap centreline where F1 has never run
python tools/extract_season.py         # results, standings, derived ratings
python tools/build_snapshot.py         # assemble + verify headshots -> src/data/snapshot
python tools/gen_assets.py             # canonical asset registry -> src/data/*Assets.js
```

`build_snapshot.py` must run last: it writes every file the app imports, and it
resolves driver headshots as part of that step.

## What comes from where

| Data | Source |
| --- | --- |
| Calendar, sessions, formats | FastF1 event schedule |
| Circuit outline | Position telemetry (X/Y) of a representative fast lap |
| Corner numbers and positions | `session.get_circuit_info()` |
| Full-throttle / braking zones | Throttle and brake channels of the same lap |
| Results, grids, pit stops, tyres, weather | FastF1 session results and lap data |
| Driver identity, number, team colour, headshot | FastF1 session results |
| Constructor entrant names and power units | 2026 published entry list |
| Circuit length and official turn count | Wikipedia circuit infoboxes (CC BY-SA) |
| Sepang centreline | OpenStreetMap (ODbL 1.0) |
| Driver photographs (22) | Formula 1 official 2026 media library, referenced by URL |
| Team logos (11) | Formula 1 official 2026 white variants, referenced by URL |

## Notes

* **DRS.** The 2026 regulations abolished DRS. The telemetry DRS channel reads
  zero at every circuit this season, so no DRS zones are emitted. The field is
  kept in the schema so a season that has them renders without code changes.
* **Geometry gaps.** 22 of 23 circuits have real geometry. The Madring (Madrid,
  round 14) is new for 2026, has never hosted a session, and is not mapped in
  OpenStreetMap — it is emitted with `geometryUnavailable` and the UI says so
  rather than drawing an invented shape.
* **Ratings.** Capability scores are arithmetic over real classifications, and
  each carries a sample count. The UI hides any rating with fewer than three
  races behind it.
* **Assets.** `gen_assets.py` builds the registry from `f1_official_map.json`,
  which maps each GridPred driver id to F1's own asset code and current team
  slug. Because the asset path is namespaced by season and constructor, a driver
  who changes team resolves to their new team's photograph automatically.
  Refresh the map by re-scraping F1's driver index when the grid changes; never
  edit `src/data/driverAssets.js` by hand.
* **Helmets.** No 2026 helmet design is available under a reusable licence, so
  the registry emits `helmet: null` for every driver and the UI shows an explicit
  unavailable state. Add a licensed file and its path to `gen_assets.py` to
  render it.
