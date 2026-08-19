# Apex GP — Formula 1 Race Predictor

A cinematic front-end for a Formula 1 race-prediction product. Explore the grid,
read the circuits, and see *why* the model ranked the field the way it did.

This is the **frontend phase**: no backend, no database, no auth, no API. Every
figure comes from a simulated 2026 season that lives in `src/data/`.

```bash
npm install
npm run dev      # http://localhost:5173
npm run build
npm run preview
```

## Stack

React 19 · Vite 8 · Tailwind CSS v4 · Framer Motion · React Router 7 · Recharts · Lucide

## How the data actually works

The interesting part of this build is that **nothing is hand-written twice**.
Two files state facts; everything else is derived from them.

| File | Owns |
| --- | --- |
| `data/drivers.js` | Identity, career totals, nine 0–100 capability scores, and a championship *prior* (`seedPoints`) |
| `data/teams.js` | Identity and car characteristics that no result can imply — pit-stop pace, reliability, development rate |
| `data/races.js` | The 24-round calendar, circuit dimensions, weather, and a `shape` descriptor per venue |
| `data/results.js` | **Derives** the entire season: every grid, classification, retirement, standings table and form strip |
| `data/predictions.js` | The prediction engine — a weighted feature model over the same numbers |

`results.js` simulates all fifteen completed rounds from a seeded model
(championship prior + capability + per-circuit team swing + reliability). Because
the season is generated once and every surface reads from it, a driver's points
on the standings table can never disagree with the sum of their race results.
Season aggregates deliberately **do not** exist in `drivers.js` or `teams.js`.

### Circuit outlines

Real track geometry isn't bundled. `lib/circuit.js` synthesises a stable outline
per venue: a closed polygon whose vertices are filleted with tangent arcs, so
each layout reads as *straights joined by corners of varying radius* rather than
a smooth blob. Deterministic — the same circuit always draws the same shape.

To drop in real geometry later, set `path` on a circuit; `circuitPath()` returns
the override and no component changes.

### Driver visuals

No photography ships with the app. `ui/DriverPortrait` renders a helmet from the
team livery, with a stripe angle derived from the racing number. It scales to any
size and costs nothing to load. Every call site passes only `driver` and `team`,
so swapping in real imagery is a one-component change.

## Wiring up a real model

`predictRace(race, { weights, rainChance })` returns a ranked qualifying order, a
ranked race order, per-driver factor contributions, win probabilities and a
confidence figure. Replace its body with a `fetch` to a served model and keep the
return shape — the Predict page, the home teaser and the driver pages all consume
that contract and nothing else.

The prediction page genuinely re-runs the model on every control change; the grid
animates drivers between positions rather than redrawing the list.

## Structure

```
src/
├── components/
│   ├── navigation/   floating rail + mobile tab bar
│   ├── hero/         landing sections
│   ├── drivers/      carousel, cards, form strip, attribute profile
│   ├── teams/        crest, head-to-head
│   ├── races/        calendar row
│   ├── predictions/  ranked grid, factor dial, model reasoning
│   ├── charts/       Recharts wrappers + shared theme
│   ├── ui/           design-system primitives
│   └── layout/       shell, backdrop, footer
├── data/             the mock dataset (see above)
├── hooks/            counters, countdown, parallax, live telemetry
├── lib/              circuit generator, formatting, motion vocabulary
└── pages/            one file per route
```

Routes: `/` `/drivers` `/drivers/:id` `/teams` `/teams/:id` `/races` `/races/:id`
`/predict` `/analytics` `/compare`

## Motion and accessibility

Motion is centralised in `lib/motion.js` so every surface uses the same physics.
`useCalmMotion()` reads `prefers-reduced-motion` and components collapse to plain
fades rather than merely running faster — the pace car stops circulating,
telemetry stops drifting, counters land on their final value immediately.

Navigation is keyboard reachable with visible focus rings, charts and meters
carry ARIA roles and values, and there's a skip link to `#main`.

## Notes

All data is simulated and this project is not affiliated with Formula 1.
