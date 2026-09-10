# GridPred — Formula 1 Race Prediction

GridPred predicts the Formula 1 grid from real session data. Explore the 2026
drivers, read circuits whose geometry was measured from car telemetry, and see
exactly why the model made its call.

```bash
npm install
npm run dev      # http://localhost:5173
npm run build
```

## This is built on real Formula 1 data

Everything the interface shows comes from actual 2026 sessions, pulled through
[FastF1](https://github.com/theOehrly/Fast-F1) by the pipeline in `tools/` and
written to `src/data/snapshot/`.

| Data | Source |
| --- | --- |
| 23-round calendar, session times, sprint formats | FastF1 event schedule |
| Championship standings, results, grids, pit stops, tyres, weather | FastF1 session results and lap data |
| Driver identity, racing number, team colour, headshot | FastF1 session results |
| **Circuit outlines** | Position telemetry (X/Y) of a representative fast lap |
| **Corner numbers and positions** | `session.get_circuit_info()` |
| Full-throttle and braking zones | Throttle and brake telemetry channels |
| Constructor entrant names, power units | 2026 published entry list |
| Circuit length, official turn counts | Wikipedia circuit infoboxes (CC BY-SA) |

The driver standings this produces match the official 2026 table exactly,
sprint points included — that agreement is the pipeline's correctness check.

## Circuits are measured, not drawn

No circuit in GridPred is illustrated or generated. Each outline is the path a
car actually took, reconstructed from the position telemetry of a real lap, and
each corner marker sits at the coordinate FastF1 reports for that corner. Every
layout records its provenance — which session, which driver, which lap time —
and the race page shows it.

**All 23 circuits have real geometry, 21 of them from telemetry.**
The other two are surveyed rather than driven, and both use an OpenStreetMap
centreline (ODbL), stitched from the circuit's own OSM relation and checked
against its official length. Sepang, which hosts the relocated Bahrain Grand Prix
and predates FastF1's telemetry era, measures 5549 m against an official 5543 m.
The Madring in Madrid is new for 2026 and has never hosted a session; it measures
5426 m against an official 5416 m.

Where a layout is surveyed rather than driven, the things only telemetry can give
are absent instead of invented — no corner markers, no top speed, average speed
or throttle share. The race page says "not measured yet" and names the source.
They fill in on their own once the first session runs. A start/finish line is
drawn only where the OSM relation marks one, which Sepang's does and the
Madring's does not.

## Things the data says that you might not expect

* **There is no DRS in 2026.** The regulations replaced it with active
  aerodynamics and an overtake boost, and the DRS telemetry channel reads zero
  all season. GridPred therefore draws no DRS zones; it shows measured
  full-throttle and braking zones instead. The `drsZones` field remains in the
  schema so a season that has them renders with no code change.
* **The Bahrain Grand Prix is in Malaysia.** It was relocated to Sepang after the
  Saudi Arabian round was cancelled; the calendar reflects that.
* **Not every rating exists for every driver.** Capability scores are arithmetic
  over real classifications and each carries a sample count. Anything resting on
  fewer than three races is hidden rather than shown as a confident number.
* **One driver has no photograph.** The F1 media CDN answers with a generic
  silhouette for Arvid Lindblad; the build detects that and the interface falls
  back to a drawn helmet.

## Architecture

```
src/
├── components/
│   ├── circuits/     CircuitMap, CircuitCard, CircuitDetail, CircuitCorner,
│   │                 DRSZone, TrackTelemetry
│   ├── drivers/      headshot, helmet, cards, carousel, form, ratings
│   ├── predictions/  ranked grid, factor dial, model reasoning
│   ├── teams/ races/ charts/ hero/ navigation/ ui/ layout/ brand/
├── data/             normalised access to the snapshot
│   └── snapshot/     generated FastF1 data (+ telemetry/, loaded lazily)
├── services/         fastf1 transport + per-domain accessors + normalisers
├── hooks/ lib/ pages/
└── tools/            the Python extraction pipeline
```

Routes: `/` `/drivers` `/drivers/:id` `/teams` `/teams/:id` `/races` `/races/:id`
`/predict` `/analytics` `/compare`

### Connecting a live backend

`src/services/fastf1.js` is the only module that knows where data comes from.
Set `VITE_GRIDPRED_API` and it fetches from your API instead of the bundled
snapshot; the shapes are identical because both pass through
`src/services/normalize.js`. The intended path is:

```
GridPred UI → GridPred API → FastF1 → F1 session data → prediction model
```

`predictRace(race, { weights, rainChance })` returns a ranked qualifying order, a
ranked race order, per-driver factor attributions and a confidence figure. On a
sprint weekend it also returns a ranked **sprint** with the top-eight scoring
applied; the Predict page grows a Sprint tab only for rounds that have one. The
sprint model leans about twice as hard on grid position and damps the random
element, because a sprint is a third of the distance with no mandatory stop —
which is why its order sits closer to qualifying than the race order does.

Replace the body of `predictRace` with a call to a served model and no component
changes.

Per-circuit telemetry (speed trace, racing line) is the one genuinely lazy path:
it is fetched only when a circuit appears in telemetry mode, keeping ~300 KB out
of the initial payload.

## Staying current

The bundled snapshot is generated at build time and goes stale the moment
another Grand Prix runs. Two mechanisms keep a deployed GridPred honest.

Everything below runs on load, every five minutes, and whenever the tab regains
focus. Each feed fails soft: if one is unavailable the snapshot stands in its
place and the freshness badge says so.

**Championship standings.** When the feed answers, the tables *are* the
published order — rows are built by walking that list, not by re-sorting the
bundled ones. Mixing the two is what lets a single unresolved name sit on a
stale score while everything around it updates, so the fallback to the snapshot
is all-or-nothing.

Constructor names differ between sources — the results feed calls Racing Bulls
"RB F1 Team" and Red Bull Racing simply "Red Bull" — so they are matched by an
explicit alias table first, then by distinctive-word overlap that ignores filler
like "F1 Team". A driver the bundled data has never seen is carried through with
their real championship row rather than showing zero.

**Results for rounds run since the build.** When the feed reports a round the
snapshot predates, GridPred fetches just those classifications — a handful of
requests at most. The race page switches from a projection to the real result,
form strips grow, and the "rounds in" counts follow.

**Session results.** Practice, sprint and qualifying classifications come from
the timing API, which is the only source that publishes them — the results feed
carries the Grand Prix alone. Fetched on demand, since only the race page shows
them.

**Calendar drift.** The published schedule is compared against the bundled one,
and cancellations, reschedules and relocations are stated rather than silently
counted down to. Two false positives are deliberately suppressed: venue names
that differ only in wording ("Albert Park Circuit" against "Albert Park Grand
Prix Circuit") are matched on shared distinctive words, and a one-day date
difference is treated as a timezone artefact — a night race such as Las Vegas
has a local date one day behind its UTC date, and the feeds disagree about which
to publish. A genuine move is measured in weeks.

**This weekend's entry.** Championship standings say who has *scored* what;
they cannot say who is *driving*. An entry list describes only the weekend it
belongs to, so it is treated as the current field until that weekend's last
session has run, and as history afterwards — otherwise a driver who sat out the
previous round would stay hidden while they are racing the next one. A driver stood down through injury keeps their
points and their standings place, and their stand-in has no standings row at
all — so substitutions are invisible to a standings feed. GridPred therefore
also reads the session entry list from the timing API and treats it as the
authority on the field: absentees drop out of the grid, stand-ins move to the
team they are actually driving for, and a reserve the snapshot has never seen is
built from the entry and appears everywhere, right down to their own driver
page. The championship table is deliberately left alone.

The change is stated, not just applied: a *lineup change* panel on the next-race
card and the prediction page names who is out, who has moved and who has come
in, and stand-ins carry a badge on their card.

**Permanent team moves heal themselves too.** The standings feed reports which
constructor each driver is scoring for, so a move is picked up without a
rebuild.
Nothing stores a frozen image URL: `driverAssets.js` holds F1's driver code and
`teamAssets.js` holds the team slug, and `useDriverAssets` builds the portrait
from whichever team the driver is racing for *now* — F1 namespaces portraits by
constructor, so the new team's photograph, colour and logo all follow. A driver
the feed knows about but the snapshot has never seen is surfaced too. Where the
new asset does not exist yet, the portrait degrades to the neutral placeholder
rather than showing the old team's photograph.

```
src/services/live.js        the API client — every call fails soft
src/context/LiveSeason.jsx  provider: snapshot first, live upgrade after
src/hooks/useLiveSeason.js  useDriverStats / useDriverStandings / …
```

Responses are cached per tab for ten minutes: these are public, shared,
rate-limited endpoints whose answers change a few times a day at most, and
without it a series of page loads earns a 429 for no benefit.

Point `VITE_LIVE_API` (standings) or `VITE_TIMING_API` (entry list) at your own
mirrors to change source.

**Real-time weekend state.** `src/lib/session.js` classifies every session of the
next race against the clock, so the interface advances by itself: a session is
marked live when it starts, the strip moves on when it ends, and the countdown
targets whatever is genuinely next rather than a fixed race time. One shared
clock (`useNow`) drives every countdown so they cannot drift apart.

Session timestamps are stored with an explicit `Z`. They are UTC by definition,
and a bare `2026-08-22T10:00:00` is parsed by JavaScript as *local* time — which
silently shifts every session by the viewer's offset. `parseUtc()` enforces the
marker at every read rather than trusting it.

## Motion and accessibility

Motion is centralised in `src/lib/motion.js`. `useCalmMotion()` reads
`prefers-reduced-motion` and components collapse to plain fades rather than
merely running faster — the pace car stops circulating, telemetry stops
drifting, circuits appear fully drawn, counters land on their final value.

Navigation is keyboard reachable with visible focus rings, corner markers are
focusable buttons, charts and meters carry ARIA roles, and there is a skip link.

## Assets and licensing

Every image resolves through one registry. No component contains an image URL.

```
data/driverAssets.js   driver photographs
data/teamAssets.js     constructor logos
data/assetSources.js   provenance + licence for every asset
```

**Source: Formula 1's official 2026 media library.** All 22 driver portraits and
all 11 team logos come from `media.formula1.com`, referenced by URL and **not
copied into this repository** — there is no bundled imagery at all.

The asset path encodes the season *and the driver's current constructor*:

```
common/f1/2026/redbullracing/isahad01/2026redbullracingisahad01right.webp
common/f1/2026/cadillac/serper01/2026cadillacserper01right.webp
```

That namespacing is what makes these current. A driver who changes team resolves
to a new path under the new team, so Hadjar appears in Red Bull kit and Pérez in
Cadillac kit. The mapping in `tools/f1_official_map.json` is regenerated from
F1's own driver index rather than guessed, and every image was inspected against
its driver's 2026 constructor before being accepted.

Team logos use F1's official **white** variants, supplied for dark backgrounds,
so no recolouring is applied.

**Fallbacks.** If any image fails to load, the interface shows a neutral
GridPred placeholder — an anonymous silhouette for a driver, a plate carrying
the team's own name and colour for a constructor. An outdated photograph or
another team's logo is never substituted.

**Rights.** These are Formula 1's copyrighted photographs and the constructors'
trademarks, used here to identify the driver and team they depict. Confirm you
hold the rights you need for your own deployment context.

Run `/assets-debug` in development for a one-page audit of every driver's photo,
helmet, number, team and logo. `validateDriverAssets()` reports missing numbers,
unresolved teams and duplicate image URLs to the console on boot.

GridPred is an independent project and is not affiliated with Formula 1.

## Regenerating the data

See `tools/README.md`. Scripts must run in the documented order;
`build_snapshot.py` writes every file the app imports and must run last.
