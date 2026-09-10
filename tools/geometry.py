"""
Shared circuit geometry helpers.

Pure maths — no FastF1, no network. Kept separate so a script that only needs to
project a centreline (the OpenStreetMap fallback, for instance) does not have to
import the telemetry stack to do it.

Every circuit in GridPred is rendered into the same 1000x620 viewBox, so these
functions are what make an OSM centreline and a telemetry-derived racing line
come out looking like they belong to the same product.
"""
import math
import numpy as np

VIEW = {'w': 1000.0, 'h': 620.0, 'pad': 64.0}


def rotate(xy, deg):
    """Rotate an (N,2) array of points about the origin."""
    r = math.radians(deg)
    c, s = math.cos(r), math.sin(r)
    return np.column_stack([xy[:, 0] * c - xy[:, 1] * s, xy[:, 0] * s + xy[:, 1] * c])


def rdp(pts, eps):
    """Ramer-Douglas-Peucker simplification."""
    if len(pts) < 3:
        return pts
    start, end = pts[0], pts[-1]
    d = end - start
    n = math.hypot(*d)
    if n == 0:
        dist = np.hypot(pts[:, 0] - start[0], pts[:, 1] - start[1])
    else:
        dist = np.abs(d[0] * (start[1] - pts[:, 1]) - (start[0] - pts[:, 0]) * d[1]) / n
    i = int(np.argmax(dist))
    if dist[i] > eps:
        return np.vstack([rdp(pts[:i + 1], eps)[:-1], rdp(pts[i:], eps)])
    return np.vstack([start, end])


def smooth_path(pts, closed=True):
    """Catmull-Rom through the points -> cubic bezier path data."""
    n = len(pts)
    at = lambda i: pts[i % n] if closed else pts[max(0, min(n - 1, i))]
    d = f"M {pts[0][0]:.1f} {pts[0][1]:.1f}"
    last = n if closed else n - 1
    for i in range(last):
        p0, p1, p2, p3 = at(i - 1), at(i), at(i + 1), at(i + 2)
        c1 = p1 + (p2 - p0) / 6.0
        c2 = p2 - (p3 - p1) / 6.0
        d += f" C {c1[0]:.1f} {c1[1]:.1f} {c2[0]:.1f} {c2[1]:.1f} {p2[0]:.1f} {p2[1]:.1f}"
    return d + (" Z" if closed else "")


def make_transform(xy):
    """Scale/centre a point cloud into the shared viewBox, flipping Y for SVG."""
    minx, maxx = float(xy[:, 0].min()), float(xy[:, 0].max())
    miny, maxy = float(xy[:, 1].min()), float(xy[:, 1].max())
    scale = min(
        (VIEW['w'] - 2 * VIEW['pad']) / max(maxx - minx, 1e-6),
        (VIEW['h'] - 2 * VIEW['pad']) / max(maxy - miny, 1e-6),
    )
    ox = (VIEW['w'] - (maxx - minx) * scale) / 2 - minx * scale
    oy = (VIEW['h'] - (maxy - miny) * scale) / 2 - miny * scale

    def tf(p):
        p = np.asarray(p, dtype=float)
        return np.column_stack([p[:, 0] * scale + ox, VIEW['h'] - (p[:, 1] * scale + oy)])

    return tf


def best_orientation(xy, step=5):
    """
    The rotation that fills the viewBox most completely.

    Telemetry-derived layouts get their orientation from FastF1's circuit
    rotation; a centreline from OpenStreetMap has none, so the frame is used to
    choose one rather than leaving the track floating in empty space.
    """
    best_deg, best_area = 0, -1.0
    for deg in range(0, 180, step):
        r = rotate(xy, deg)
        w = r[:, 0].max() - r[:, 0].min()
        h = r[:, 1].max() - r[:, 1].min()
        scale = min((VIEW['w'] - 2 * VIEW['pad']) / w, (VIEW['h'] - 2 * VIEW['pad']) / h)
        area = (w * scale) * (h * scale)
        if area > best_area:
            best_deg, best_area = deg, area
    return best_deg


def resample(xy, spacing):
    """
    Re-space a closed ring's points evenly along its own length.

    An OpenStreetMap way is digitised with whatever vertices a mapper placed:
    hundreds of metres of straight with two points, then a corner described by
    three. Sampling at a fixed interval gives the corners enough points to be
    curves, which is what makes a surveyed centreline sit next to a
    telemetry-derived racing line without looking like a floor plan.
    """
    pts = np.asarray(xy, dtype=float)
    closed = np.vstack([pts, pts[:1]])
    seg = np.hypot(*np.diff(closed, axis=0).T)
    dist = np.concatenate([[0.0], np.cumsum(seg)])
    total = dist[-1]
    if total <= 0:
        return pts
    n = max(16, int(round(total / spacing)))
    want = np.linspace(0.0, total, n, endpoint=False)
    return np.column_stack([np.interp(want, dist, closed[:, 0]),
                            np.interp(want, dist, closed[:, 1])])


def smooth_ring(xy, window):
    """
    Round the digitisation off a closed ring with a circular moving average.

    The angularity of a mapped centreline is an artefact of how many points the
    mapper placed, not a feature of the track: no circuit turns through a right
    angle. This averages each point against its neighbours, which recovers the
    curve the corner actually is. `window` is in samples, so the caller sizes it
    in metres via the resampling interval.
    """
    pts = np.asarray(xy, dtype=float)
    n = len(pts)
    if n < 8 or window < 1:
        return pts
    k = int(window) | 1  # odd, so the window is symmetric about each point
    kernel = np.ones(k) / k
    idx = (np.arange(n)[:, None] + np.arange(-(k // 2), k // 2 + 1)[None, :]) % n
    return np.column_stack([(pts[idx, 0] * kernel).sum(axis=1),
                            (pts[idx, 1] * kernel).sum(axis=1)])


def detect_corners(xy, spacing, min_turn_rate=0.35, merge_within=90.0, min_total_turn=12.0):
    """
    Find the corners of a closed ring by where it actually bends.

    A telemetry layout gets its corners from `session.get_circuit_info()`. A
    surveyed centreline has no such list, but a corner is not an opinion: it is a
    sustained change of heading, and that is measurable from the geometry itself.

    A run of samples turning faster than `min_turn_rate` degrees per metre is one
    corner; its apex is the sharpest sample in the run. Runs closer together than
    `merge_within` metres are the same corner described twice, and a run that
    turns through less than `min_total_turn` in total is a kink in the road
    rather than a corner.

    Returns indices into `xy`, in lap order, with the total turn at each.
    """
    pts = np.asarray(xy, dtype=float)
    n = len(pts)
    if n < 8:
        return []

    ahead = np.roll(pts, -1, axis=0) - pts
    behind = pts - np.roll(pts, 1, axis=0)
    turn = np.arctan2(ahead[:, 1], ahead[:, 0]) - np.arctan2(behind[:, 1], behind[:, 0])
    turn = (turn + np.pi) % (2 * np.pi) - np.pi
    hot = np.abs(np.degrees(turn)) / spacing > min_turn_rate

    runs, i = [], 0
    while i < n:
        if hot[i]:
            j = i
            while j < n and hot[j]:
                j += 1
            runs.append((i, j - 1))
            i = j
        else:
            i += 1
    # a corner sitting on the wrap point arrives as two runs
    if len(runs) > 1 and hot[0] and hot[-1]:
        runs[0] = (runs[-1][0] - n, runs[0][1])
        runs.pop()

    found = []
    for a, b in runs:
        idx = [k % n for k in range(a, b + 1)]
        total = abs(float(np.degrees(turn[idx]).sum()))
        if total < min_total_turn:
            continue
        apex = idx[int(np.argmax(np.abs(turn[idx])))]
        found.append({'index': apex, 'turn': total})

    merged = []
    for c in sorted(found, key=lambda c: c['index']):
        if merged and (c['index'] - merged[-1]['index']) * spacing < merge_within:
            if c['turn'] > merged[-1]['turn']:
                merged[-1] = c
        else:
            merged.append(c)
    return merged
