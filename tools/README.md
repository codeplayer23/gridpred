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
python tools/osm_fallback.py           # OpenStreetMap centreline where telemetry cannot reach
python tools/extract_season.py         # results, standings, derived ratings
python tools/fetch_careers.py          # career history + debut for the current grid
python tools/build_snapshot.py         # assemble + verify headshots -> src/data/snapshot
python tools/gen_assets.py             # canonical asset registry -> src/data/*Assets.js
python tools/revise_results.py --apply # LAST: apply post-race classification changes
```

`revise_results.py` reads and writes `src/data/snapshot/` directly rather than
the `out/` intermediates, so it runs **after** `build_snapshot.py` — running it
before would just have the rebuild overwrite it. It is also safe to run on its
own at any time, and says so when nothing has changed.

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
| Career history, debut, season-by-season | Jolpica (Ergast successor), aggregated from every classification |
| Post-race classification revisions | Jolpica, reconciled by `revise_results.py` |
| Sepang and Madring centrelines | OpenStreetMap (ODbL 1.0) |
| Driver photographs (22) | Formula 1 official 2026 media library, referenced by URL |
| Team logos (11) | Formula 1 official 2026 white variants, referenced by URL |

## Notes

* **DRS.** The 2026 regulations abolished DRS. The telemetry DRS channel reads
  zero at every circuit this season, so no DRS zones are emitted. The field is
  kept in the schema so a season that has them renders without code changes.
* **Geometry gaps.** All 23 circuits have real geometry, but not all of it is
  telemetry. 21 outlines are reconstructed from the position telemetry of a real
  lap; two are surveyed centrelines from OpenStreetMap. The Madring (Madrid, round 14) is new for 2026 and has never hosted a
  session, so its outline is the surveyed centreline from OpenStreetMap route
  relation [18813472](https://www.openstreetmap.org/relation/18813472), stitched
  by `osm_fallback.py`.

  A route relation is used rather than `highway=raceway` ways because the Madring
  runs largely on public roads: the raceway-tagged ways cover only 2.7 km of the
  5.4 km lap, while the relation lists every way of the circuit with a role
  giving its direction of travel. The stitched ring measures 5426 m against the
  official 5416 m — 0.2% — and the script refuses to emit anything that disagrees
  with the official length by more than 5%.

  **Corners** are measured, not copied. A telemetry layout gets its corners from
  `session.get_circuit_info()`; a centreline has no such list, but a corner is a
  sustained change of heading and that is readable from the geometry. The
  detector walks the resampled centreline and marks each run of curvature above
  `TURN_RATE`. The parameters are not tuned per circuit: one set recovers **22
  corners at the Madring and 15 at Sepang**, each matching that circuit's
  official published count — two independent checks the detector was not fitted
  to individually.

  **The start/finish** is taken from the relation's `start` node where a mapper
  has placed one, which is the case at Sepang. The Madring's relation has none,
  so it is placed on the main straight, identified by the pit lane running
  alongside it — an *inference*, recorded as one in `startFinishSource` and shown
  on the race page as "inferred from the pit lane". Corner numbering runs from
  the start/finish in the lap's direction of travel, which the relation's member
  roles establish.

  **Speeds are still absent**, because nothing but telemetry can supply them:
  `maxSpeed`, `avgSpeed`, `fullThrottlePct` and `brakingPct` stay `null` and the
  race page says "not measured yet". Once FP1 runs at Madrid
  (2026-09-11 11:30 UTC), `extract_circuits.py` produces a real telemetry layout
  and it supersedes this one — `osm_fallback.py` writes into
  `out/circuits_geom.json` before `build_snapshot.py`, so re-running the pipeline
  in order does the right thing.

  Sepang (round 16, the relocated Bahrain Grand Prix) comes from the same script
  and the same principle — it predates FastF1's telemetry era — via relation
  [284496](https://www.openstreetmap.org/relation/284496), measuring 5549 m
  against an official 5543 m. That relation marks its start/finish as a node with
  role `start`, so Sepang gets a real start/finish line; the Madring's relation
  does not, so it gets none rather than a guessed one.

  `osm_fallback.py` validates what it emits: it rejects any ring whose length
  disagrees with the official figure by more than 5%, and prints the worst join
  and the closing gap so a bad stitch is visible rather than silent.

  ODbL 1.0 requires attribution wherever the data is shown, which the footer and
  the race page's geometry-source card both carry.
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
