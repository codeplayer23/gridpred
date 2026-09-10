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
