"""SIDDIQIYA Apparel — procedural garment renderer.

Produces photographic-style product renders (ghost-mannequin front/back views, collar
and fabric close-ups) from garment geometry, a fold height-field, fabric micro-texture,
studio lighting and artwork that is warped and shaded with the cloth.

Pure numpy / OpenCV; artwork PNGs are produced by tools/render/art.mjs.
"""
import math
import numpy as np
import cv2

UNIT_W, UNIT_H = 400.0, 440.0


# ---------------------------------------------------------------- geometry helpers
def bez(p0, p1, p2, p3, n=24):
    t = np.linspace(0, 1, n)[:, None]
    p0, p1, p2, p3 = map(np.array, (p0, p1, p2, p3))
    return (1 - t) ** 3 * p0 + 3 * (1 - t) ** 2 * t * p1 + 3 * (1 - t) * t ** 2 * p2 + t ** 3 * p3


def quad(p0, p1, p2, n=20):
    t = np.linspace(0, 1, n)[:, None]
    p0, p1, p2 = map(np.array, (p0, p1, p2))
    return (1 - t) ** 2 * p0 + 2 * (1 - t) * t * p1 + t ** 2 * p2


def line(a, b, n=8):
    t = np.linspace(0, 1, n)[:, None]
    return (1 - t) * np.array(a) + t * np.array(b)


def chain(*segs):
    out = [segs[0]]
    for s in segs[1:]:
        out.append(s[1:])
    return np.vstack(out)


def mirror(pts):
    p = np.array(pts, dtype=float).copy()
    p[:, 0] = UNIT_W - p[:, 0]
    return p


class Shape:
    """Garment outline in a 400x440 unit space. All parts are polygons."""

    def __init__(self, kind):
        self.kind = kind
        g = transform_shape(SHAPES[kind])
        self.g = g
        nx, ny = g['neck_side']
        sx, sy = g['shoulder']
        cuo, cui = g['cuff_out'], g['cuff_in']
        ua = g['underarm']
        hem_y = g['hem_y']
        hx = g['hem_x']
        # right side (viewer's right), from neck side to hem centre
        shoulder = line((UNIT_W - nx, ny), (sx, sy), 10)
        armhole = quad((sx, sy), (sx - g['arm_curve'], (sy + ua[1]) * .5), ua, 18)  # shoulder -> underarm
        side = bez(ua, (ua[0] + g['waist'], ua[1] + 80), (hx + g['waist'], hem_y - 90), (hx, hem_y), 30)
        hem = quad((hx, hem_y), (UNIT_W / 2 + (hx - UNIT_W / 2) * .5, hem_y + g['hem_curve']), (UNIT_W / 2, hem_y + g['hem_curve']), 16)
        self.armhole_r = armhole
        self.sleeve_r = chain(line((sx, sy), cuo, 12), line(cuo, cui, 6), line(cui, ua, 10), armhole[::-1])
        body_r = chain(shoulder, armhole, side, hem)
        rng = np.random.default_rng(len(kind) * 31 + 7)
        def wob(pts, amp=0.9):
            pts = resample(pts, 2.0)
            nz = np.convolve(rng.standard_normal(len(pts) + 20), np.ones(9) / 9, 'same')[10:10 + len(pts)]
            nz = nz * np.sin(np.linspace(0, np.pi, len(pts)))
            o = offset(pts, 1.0) - pts
            return pts + o * nz[:, None] * amp * 2.2
        side_i = len(shoulder) + len(armhole) - 2
        body_r = np.vstack([body_r[:side_i], wob(body_r[side_i:])])
        self.body_r = body_r
        self.neck_front = bez((nx, ny), (nx + 10, ny + g['neck_depth']), (UNIT_W - nx - 10, ny + g['neck_depth']), (UNIT_W - nx, ny), 30)
        self.neck_back = bez((nx, ny), (nx + 16, ny + g['back_depth']), (UNIT_W - nx - 16, ny + g['back_depth']), (UNIT_W - nx, ny), 30)
        self.sleeve_l = mirror(self.sleeve_r)
        self.armhole_l = mirror(self.armhole_r)
        self.hem_y = hem_y
        self.cuffs = [(cuo, cui), (tuple(mirror([cuo])[0]), tuple(mirror([cui])[0]))]
        self.ua = ua

    def body_poly(self, view):
        neck = self.neck_front if view == 'front' else self.neck_back
        # hem centre -> left side -> left neck -> neckline -> right neck -> right side -> hem centre
        return np.vstack([mirror(self.body_r)[::-1], neck[1:-1], self.body_r])


# Natural units: 1 unit ~ 0.3 cm on a size M garment, x centred on 200, y = 0 at the
# high point of the shoulder (neck side). Shape.T maps them onto the 400 x 440 frame.
SHAPES = {
    'crew': dict(neck_side=(168, 0), shoulder=(286, 18), cuff_out=(330, 82), cuff_in=(298, 104), underarm=(282, 84),
                 hem_y=252, hem_x=284, waist=-3, hem_curve=2, arm_curve=5, neck_depth=26, back_depth=6, rib=6),
    'heavy': dict(neck_side=(166, 0), shoulder=(292, 20), cuff_out=(338, 86), cuff_in=(302, 110), underarm=(288, 88),
                  hem_y=246, hem_x=290, waist=0, hem_curve=1, arm_curve=4, neck_depth=24, back_depth=6, rib=8),
    'oversized': dict(neck_side=(166, 0), shoulder=(310, 34), cuff_out=(346, 112), cuff_in=(306, 130), underarm=(298, 112),
                      hem_y=246, hem_x=302, waist=0, hem_curve=1, arm_curve=2, neck_depth=25, back_depth=6, rib=7),
    'drop': dict(neck_side=(166, 0), shoulder=(306, 32), cuff_out=(342, 106), cuff_in=(304, 124), underarm=(296, 106),
                 hem_y=236, hem_x=298, waist=-1, hem_curve=2, arm_curve=2, neck_depth=25, back_depth=6, rib=5),
    'polo': dict(neck_side=(170, 0), shoulder=(286, 18), cuff_out=(330, 80), cuff_in=(298, 102), underarm=(282, 84),
                 hem_y=258, hem_x=284, waist=-3, hem_curve=3, arm_curve=5, neck_depth=14, back_depth=5, rib=8),
    'raglan': dict(neck_side=(170, 0), shoulder=(286, 22), cuff_out=(330, 84), cuff_in=(299, 106), underarm=(280, 84),
                   hem_y=250, hem_x=280, waist=-5, hem_curve=3, arm_curve=5, neck_depth=25, back_depth=6, rib=5),
}
K = 1.24
Y0 = 58.0


def T(p):
    p = np.asarray(p, float)
    return np.c_[UNIT_W / 2 + (p[..., 0] - UNIT_W / 2) * K, Y0 + p[..., 1] * K] if p.ndim > 1 else np.array([UNIT_W / 2 + (p[0] - UNIT_W / 2) * K, Y0 + p[1] * K])


def transform_shape(g):
    out = {}
    for k, v in g.items():
        if isinstance(v, tuple):
            out[k] = tuple(T(v))
        elif k == 'hem_y':
            out[k] = Y0 + v * K
        elif k == 'hem_x':
            out[k] = UNIT_W / 2 + (v - UNIT_W / 2) * K
        else:
            out[k] = v * K
    return out


# ---------------------------------------------------------------- raster helpers
class Canvas:
    def __init__(self, scale, ox=0.0, oy=0.0, w=None, h=None):
        self.s = scale
        self.ox, self.oy = ox, oy
        self.w = int(w if w else UNIT_W * scale)
        self.h = int(h if h else UNIT_H * scale)

    def px(self, pts):
        p = (np.asarray(pts, dtype=float) - [self.ox, self.oy]) * self.s
        return (p * 16).astype(np.int32)  # 4 fractional bits for cv2 shift

    def mask(self, *polys):
        m = np.zeros((self.h, self.w), np.uint8)
        for p in polys:
            cv2.fillPoly(m, [self.px(p)], 255, cv2.LINE_AA, shift=4)
        return m.astype(np.float32) / 255.0

    def stroke(self, img, pts, width, value=1.0):
        cv2.polylines(img, [self.px(pts)], False, value, max(1, int(round(width * self.s))), cv2.LINE_AA, shift=4)


def blur(a, sigma):
    if sigma <= 0:
        return a
    k = int(sigma * 3) * 2 + 1
    return cv2.GaussianBlur(a, (k, k), sigma)


def noise(h, w, scale, rng, octaves=3):
    out = np.zeros((h, w), np.float32)
    amp, total = 1.0, 0.0
    for o in range(octaves):
        sh, sw = max(2, int(h / scale) + 2), max(2, int(w / scale) + 2)
        n = rng.standard_normal((sh, sw)).astype(np.float32)
        n = cv2.resize(n, (w, h), interpolation=cv2.INTER_CUBIC)
        out += n * amp
        total += amp
        amp *= 0.5
        scale /= 2.0
    return out / total


def srgb_to_lin(c):
    c = np.asarray(c, np.float32)
    return np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)


def lin_to_srgb(c):
    c = np.clip(c, 0, 1)
    return np.where(c <= 0.0031308, c * 12.92, 1.055 * np.power(c, 1 / 2.4) - 0.055)


def hex_rgb(h):
    h = h.lstrip('#')
    return np.array([int(h[i:i + 2], 16) / 255.0 for i in (0, 2, 4)], np.float32)


# ---------------------------------------------------------------- curve utilities
def resample(pts, step):
    pts = np.asarray(pts, float)
    d = np.r_[0, np.cumsum(np.hypot(*np.diff(pts, axis=0).T))]
    if d[-1] == 0:
        return pts
    n = max(2, int(d[-1] / step) + 1)
    t = np.linspace(0, d[-1], n)
    return np.c_[np.interp(t, d, pts[:, 0]), np.interp(t, d, pts[:, 1])]


def offset(pts, dist):
    """Offset an open polyline by dist (positive = left of travel direction, in unit coords)."""
    pts = np.asarray(pts, float)
    t = np.gradient(pts, axis=0)
    t /= np.maximum(np.hypot(t[:, 0], t[:, 1])[:, None], 1e-6)
    nrm = np.c_[t[:, 1], -t[:, 0]]
    return pts + nrm * dist


def dashes(pts, dash, gap):
    pts = resample(pts, 0.5)
    out, acc, cur, on = [], 0.0, [pts[0]], True
    for a, b in zip(pts[:-1], pts[1:]):
        acc += float(np.hypot(*(b - a)))
        cur.append(b)
        if on and acc >= dash:
            out.append(np.array(cur)); cur, acc, on = [b], 0.0, False
        elif not on and acc >= gap:
            cur, acc, on = [b], 0.0, True
    return out


def band(pts, w):
    """Closed polygon of a band of width w on the left side of a polyline."""
    pts = resample(pts, 1.0)
    return np.vstack([pts, offset(pts, w)[::-1]])


# ---------------------------------------------------------------- fabric textures
def knit_texture(h, w, s, kind, rng):
    """Micro-texture in [-1,1] at pixel scale s (px per unit). A unit is ~3 mm."""
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    if kind in ('pique',):
        period = max(2.0, 0.9 * s)
        a = np.sin(xx / period * math.pi * 2) * np.sin(yy / (period * 0.86) * math.pi * 2)
        tex = np.abs(a) * 2 - 1
    elif kind in ('mesh', 'polyester-dry-fit'):
        period = max(2.0, 0.7 * s)
        tex = (np.sin(xx / period * math.pi * 2) + np.sin(yy / period * math.pi * 2)) * 0.5
    elif kind == 'rib':
        period = max(2.0, 0.8 * s)
        tex = np.sin(xx / period * math.pi * 2)
    elif kind in ('fleece', 'french-terry'):
        tex = noise(h, w, max(2, 0.4 * s), rng, 2)
    else:  # single jersey: columns of V loops
        col = max(2.0, 0.45 * s)
        row = col * 1.25
        v = np.abs(((xx / col) % 1.0) - 0.5) * 2
        r = ((yy / row) % 1.0)
        tex = np.cos((r - v * 0.5) * math.pi * 2) * 0.6 + np.cos(xx / col * math.pi * 2) * 0.4
    fib = noise(h, w, max(1.5, 0.25 * s), rng, 1) * 0.35
    return (tex * 0.8 + fib).astype(np.float32)


# ---------------------------------------------------------------- folds per silhouette
def fold_set(shape, view, rng):
    """(polyline, width, amplitude, crisp) in unit space. Positive = ridge, negative = valley."""
    g = shape.g
    ua = np.array(g['underarm']); hx, hy = g['hem_x'], g['hem_y']
    cx = UNIT_W / 2
    j = lambda v=4: rng.uniform(-v, v)
    f = []
    for side in (1, -1):
        X = lambda x: cx + (x - cx) * side
        # soft drag folds from the underarm toward the lower centre
        f.append((np.array([[X(ua[0] - 4), ua[1] + 6], [X(ua[0] - 22 + j()), ua[1] + 40], [X(ua[0] - 40 + j()), ua[1] + 86 + j(8)]]), 15, -0.75, 0.9))
        f.append((np.array([[X(ua[0] - 12), ua[1] + 2], [X(ua[0] - 30 + j()), ua[1] + 30], [X(ua[0] - 52 + j()), ua[1] + 70]]), 13, 0.55, 0))
        # sleeve: gentle diagonal crease and fullness near the armhole
        sx, sy = g['shoulder']; co = np.array(g['cuff_out']); ci = np.array(g['cuff_in'])
        mid = (np.array([sx, sy]) + ua) / 2
        cuffm = (co + ci) / 2
        f.append((np.array([[X(mid[0] + 6), mid[1] + 8], [X((mid[0] + cuffm[0]) / 2 + j(3)), (mid[1] + cuffm[1]) / 2 + 6]]), 10, -0.35, 0))
        f.append((np.array([[X(ua[0] + 8), ua[1] - 6], [X(ci[0] - 10 + j(3)), ci[1] - 12]]), 9, 0.3, 0))
        # side-seam softness
        f.append((np.array([[X(hx - 12), ua[1] + 60], [X(hx - 16 + j(3)), hy - 50], [X(hx - 20), hy - 6]]), 16, 0.3, 0))
    # a few soft waves along the hem
    for i, x in enumerate(np.linspace(cx - (hx - cx) * 0.6, cx + (hx - cx) * 0.6, 4)):
        f.append((np.array([[x + j(8), hy - 2], [x + j(10), hy - 26 - rng.uniform(0, 18)]]), 18, 0.22 if i % 2 else -0.2, 0))
    ny = g['neck_side'][1]
    f.append((np.array([[cx - 70, ny + 70 + j(6)], [cx, ny + 80 + j(6)], [cx + 70, ny + 70 + j(6)]]), 30, 0.2 if view == 'front' else 0.12, 0))
    f.append((np.array([[cx - 80, hy - 90 + j(10)], [cx + j(10), hy - 80 + j(8)], [cx + 80, hy - 94 + j(10)]]), 34, -0.18, 0))
    return f


# ---------------------------------------------------------------- main renderer
class Garment:
    def __init__(self, kind, color, fabric='100-cotton', finish='plain', seed=1, sleeve_color=None, tipping=None, side_panels=None):
        self.shape = Shape(kind)
        self.kind = kind
        self.color = hex_rgb(color)
        self.sleeve_color = hex_rgb(sleeve_color) if sleeve_color else None
        self.tipping = hex_rgb(tipping) if tipping else None
        self.side_panels = hex_rgb(side_panels) if side_panels else None
        self.fabric = fabric
        self.finish = finish
        self.seed = seed

    # parts ------------------------------------------------------------
    def parts(self, c, view):
        sh, g = self.shape, self.shape.g
        P = {}
        body = sh.body_poly(view)
        sl_r, sl_l = sh.sleeve_r, sh.sleeve_l
        if self.kind == 'raglan':
            nx, ny = g['neck_side']
            neck = sh.neck_front if view == 'front' else sh.neck_back
            # raglan seam: from the neckline (a little in from the side) to the underarm
            k = 5 if view == 'front' else 6
            npR, npL = neck[-k], neck[k - 1]
            sl_r = np.vstack([[npR], [[nx + (UNIT_W - 2 * nx), ny]], sh.sleeve_r[:-len(sh.armhole_r) + 1][1:], [sh.ua]])
            sl_r = np.vstack([[npR], sl_r[1:]])
            sl_r = np.vstack([[npR], [g['shoulder']], [g['cuff_out']], [g['cuff_in']], [g['underarm']]])
            sl_l = mirror(sl_r)
            self.raglan_seams = [np.array([npR, g['underarm']]), mirror(np.array([npR, g['underarm']]))]
        P['body'] = c.mask(body)
        P['sleeve_r'] = c.mask(sl_r)
        P['sleeve_l'] = c.mask(sl_l)
        P['body'] = np.clip(P['body'] - np.maximum(P['sleeve_r'], P['sleeve_l']), 0, 1)
        rib = g['rib']
        if view == 'front':
            backtop = sh.neck_back - [0, 2.5]
            P['rib_back'] = c.mask(band(backtop[::-1], rib * 0.8))  # inside face of the back collar
            P['inside'] = np.clip(c.mask(np.vstack([backtop, sh.neck_front[::-1]])) - P['rib_back'], 0, 1)
            P['rib_front'] = c.mask(band(sh.neck_front[::-1], rib))  # below the front neckline
        else:
            # seen from behind: the back neck band, and a sliver of the inside front through the opening
            P['rib_back'] = c.mask(band(sh.neck_back[::-1], rib))
            lip = sh.neck_back - [0, 3.0]
            P['inside'] = c.mask(np.vstack([lip, sh.neck_back[::-1]]))
            P['rib_front'] = np.zeros((c.h, c.w), np.float32)
        if self.kind == 'polo':
            self._polo_parts(c, view, P)
        sil = np.zeros((c.h, c.w), np.float32)
        for k, m in P.items():
            if k.startswith(('body', 'sleeve', 'inside', 'rib', 'collar', 'placket')):
                sil = np.maximum(sil, m)
        P['sil'] = sil
        return P

    def _polo_parts(self, c, view, P):
        N = lambda pts: T(np.asarray(pts, float))
        if view == 'front':
            # collar leaf (viewer's right) lying over the shoulder and pointing to the placket
            outer = bez((228, -9), (258, -2), (246, 30), (214, 44), 24)
            inner = bez((214, 44), (214, 26), (220, 8), (220, -6), 16)
            flap_r = N(np.vstack([outer, inner[1:]]))
            P['collar_r'] = c.mask(flap_r)
            P['collar_l'] = c.mask(mirror(flap_r))
            top = bez((164, -2), (180, -10), (220, -10), (236, -2), 20)
            P['collar_back'] = c.mask(N(band(top[::-1], 6)))
            hole = c.mask(N(np.vstack([top, bez((236, -2), (226, 14), (174, 14), (164, -2), 20)[::-1][1:-1]])))
            P['inside'] = np.clip(np.maximum(P['inside'], hole) - P['collar_back'], 0, 1)
            P['placket'] = c.mask(N(np.array([[191, 14], [209, 14], [209, 66], [191, 66]])))
            self.flaps = [flap_r, mirror(flap_r)]
            self.buttons = [T((200, y)) for y in (26, 42, 58)]
        else:
            P['collar_back'] = c.mask(N(band(bez((236, 2), (220, -10), (180, -10), (164, 2), 20), 12)))
            self.flaps = []
            self.buttons = []

    # height field -----------------------------------------------------
    def height(self, c, view, P, rng):
        s = c.s
        H = np.zeros((c.h, c.w), np.float32)
        g = self.shape.g
        yy, xx = np.mgrid[0:c.h, 0:c.w].astype(np.float32)
        ux, uy = xx / s + c.ox, yy / s + c.oy
        cx = UNIT_W / 2
        hw = g['hem_x'] - cx + 10
        u = np.clip((ux - cx) / hw, -0.999, 0.999)
        cyl = np.sqrt(1 - u ** 2) * 34
        # chest is fuller than the hem; the torso tapers into the collar
        cyl *= 0.75 + 0.25 * np.clip(1 - (uy - 150) / 300, 0.3, 1)
        H += cyl * P['body']
        for side, k in ((1, 'sleeve_r'), (-1, 'sleeve_l')):
            sx, sy = g['shoulder']; ua = np.array(g['underarm'], float)
            co, ci = np.array(g['cuff_out'], float), np.array(g['cuff_in'], float)
            if side < 0:
                sx = UNIT_W - sx; ua[0] = UNIT_W - ua[0]; co[0] = UNIT_W - co[0]; ci[0] = UNIT_W - ci[0]
            a0 = (np.array([sx, sy]) + ua) / 2; a1 = (co + ci) / 2
            ax = a1 - a0; ln = np.linalg.norm(ax); ax /= ln
            nrm = np.array([-ax[1], ax[0]])
            half = np.linalg.norm(co - ci) / 2 + 6
            d = ((ux - a0[0]) * nrm[0] + (uy - a0[1]) * nrm[1]) / half
            d = np.clip(d, -0.999, 0.999)
            H += (np.sqrt(1 - d ** 2) * 16 + 18) * P[k]
        for k in ('body', 'sleeve_r', 'sleeve_l'):
            m = (P[k] > 0.5).astype(np.uint8)
            if m.any():
                dd = cv2.distanceTransform(m, cv2.DIST_L2, 5) / s
                H += (1 - np.exp(-dd / 5.0)) * 3.0 * P[k]
        H = blur(H, 1.2 * s)
        # folds
        F = np.zeros_like(H)
        for pts, w, amp, crisp in fold_set(self.shape, view, rng):
            layer = np.zeros_like(H)
            c.stroke(layer, bez(pts[0], pts[0] + (pts[-1] - pts[0]) * .33 + rng.uniform(-3, 3, 2), pts[-1] - (pts[-1] - pts[0]) * .33, pts[-1], 16) if len(pts) == 2 else resample(pts, 2), w * 0.45, 1.0)
            F += blur(layer, w * s * 0.42) * amp * 8
            # a crisper crease inside every valley
            if crisp:
                F += blur(layer, w * s * 0.14) * amp * 2.2 * crisp
        F += blur(noise(c.h, c.w, 60 * s, rng, 3), 4 * s) * 2.2
        H += F * P['sil']
        # seams: shallow grooves along the armholes, shoulders and hems
        G = np.zeros_like(H)
        sh, g = self.shape, self.shape.g
        seams = [sh.armhole_r, sh.armhole_l] if self.kind != 'raglan' else getattr(self, 'raglan_seams', [])
        nx, ny = g['neck_side']
        seams += [line((UNIT_W - nx, ny), g['shoulder']), mirror(line((UNIT_W - nx, ny), g['shoulder']))] if self.kind != 'raglan' else []
        for sm in seams:
            c.stroke(G, resample(sm, 1), 1.3, 1.0)
        hem = np.array([[g['hem_x'], g['hem_y'] - 9], [UNIT_W / 2, g['hem_y'] - 9 + g['hem_curve']], [UNIT_W - g['hem_x'], g['hem_y'] - 9]])
        c.stroke(G, quad(*hem), 1.0, 0.8)
        for co, ci in sh.cuffs:
            co, ci = np.array(co), np.array(ci)
            inward = (np.array(g['shoulder']) - co) if co[0] > UNIT_W / 2 else (mirror([g['shoulder']])[0] - co)
            inward = inward / np.linalg.norm(inward) * 8
            c.stroke(G, line(co + inward, ci + inward), 1.0, 0.8)
        self.groove = blur(G, 0.9 * s)
        H -= self.groove * 2.2
        # rib bands sit slightly proud
        for k in ('rib_front', 'rib_back', 'collar_back', 'placket'):
            if k in P:
                H += blur(P[k], 0.8 * s) * 1.6
        for k in ('collar_r', 'collar_l'):
            if k in P:
                m = (P[k] > 0.5).astype(np.uint8)
                d = cv2.distanceTransform(m, cv2.DIST_L2, 5) / s
                lift = blur(H, 2 * s) + 3 + np.sqrt(np.minimum(d, 3.5)) * 2.2
                H = H * (1 - P[k]) + P[k] * lift
        self.F = F
        return H

    # render -----------------------------------------------------------
    def render(self, view='front', scale=3.0, crop=None, prints=(), bg='studio', light=None, out_size=None, ss=2):
        """Return sRGB uint8 image. crop=(x, y, w, h) in unit space renders that window at `scale`."""
        rng = np.random.default_rng(self.seed + (0 if view == 'front' else 7))
        s = scale * ss
        if crop:
            x, y, w, h = crop
            c = Canvas(s, x, y, w * s, h * s)
        else:
            c = Canvas(s)
        P = self.parts(c, view)
        H = self.height(c, view, P, rng)
        sil = P['sil']

        # albedo ---------------------------------------------------------
        base = srgb_to_lin(self.color)
        A = np.ones((c.h, c.w, 3), np.float32) * base
        if self.sleeve_color is not None:
            sl = np.maximum(P['sleeve_r'], P['sleeve_l'])[..., None]
            A = A * (1 - sl) + srgb_to_lin(self.sleeve_color) * sl
        lum = float(base.mean())
        kind = 'rib' if False else self.fabric
        tex = knit_texture(c.h, c.w, s, kind, rng)
        ribtex = knit_texture(c.h, c.w, s, 'rib', rng)
        texamp = 0.06 if lum > 0.05 else 0.12
        ribm = np.zeros_like(sil)
        for k in ('rib_front', 'rib_back', 'collar_back', 'collar_r', 'collar_l'):
            if k in P:
                ribm = np.maximum(ribm, P[k])
        T = tex * (1 - ribm) + ribtex * ribm * 1.2
        A *= (1 + T[..., None] * texamp)
        if self.fabric in ('100-cotton', 'cotton-polyester') and self.color_name_is_heather():
            fleck = noise(c.h, c.w, 0.35 * s, rng, 1)
            A *= (1 + np.clip(fleck, -1.5, 1.5)[..., None] * 0.10)
        if self.finish == 'vintage':
            mott = blur(noise(c.h, c.w, 30 * s, rng, 3), 2 * s)
            ridge = np.clip(self.F / 6.0, 0, 1)
            A = A * (1 + mott[..., None] * 0.10) + (ridge[..., None] * 0.06 + 0.015)
            gray = A.mean(axis=2, keepdims=True)
            A = A * 0.82 + gray * 0.18
        if self.side_panels is not None:
            pass
        if self.tipping is not None and self.kind == 'polo':
            tip = np.zeros_like(sil)
            for fl in getattr(self, 'flaps', []):
                c.stroke(tip, resample(fl[:20], 1), 2.2, 1.0)
            for co, ci in self.shape.cuffs:
                c.stroke(tip, line(np.array(co), np.array(ci)), 2.0, 1.0)
            tip = blur(tip, 0.4 * s) * sil
            A = A * (1 - tip[..., None]) + srgb_to_lin(self.tipping) * tip[..., None]

        inside = P['inside'][..., None]
        A = A * (1 - inside * 0.45)

        # prints applied in albedo/height space
        spec_mask = np.zeros_like(sil)
        for pr in prints:
            if pr.get('view', 'front') != view:
                continue
            H, A, spec_mask = self.apply_print(c, pr, H, A, spec_mask, sil, rng)

        # buttons (polo)
        if self.kind == 'polo' and view == 'front':
            for bx, by in self.buttons:
                bm = np.zeros_like(sil)
                cv2.circle(bm, (int((bx - c.ox) * s), int((by - c.oy) * s)), int(3.0 * s), 1.0, -1, cv2.LINE_AA)
                H += blur(bm, 0.6 * s) * 3
                A = A * (1 - bm[..., None]) + (srgb_to_lin(self.color) * 0.92 + 0.02) * bm[..., None]
                spec_mask = np.maximum(spec_mask, bm * 0.6)

        # lighting -------------------------------------------------------
        gy, gx = np.gradient(H)
        k = c.s
        nxx, nyy, nzz = -gx * k, -gy * k, np.ones_like(H)
        inv = 1.0 / np.sqrt(nxx ** 2 + nyy ** 2 + nzz ** 2)
        nxx, nyy, nzz = nxx * inv, nyy * inv, nzz * inv
        L = np.array(light or (-0.45, -0.65, 0.62), np.float32); L /= np.linalg.norm(L)
        ndl = nxx * L[0] + nyy * L[1] + nzz * L[2]
        wrap = 0.35
        diff = np.clip((ndl + wrap) / (1 + wrap), 0, 1)
        fill = np.clip(nxx * 0.6 + nzz * 0.8, 0, 1) * 0.12
        ao = np.clip(blur(sil, 14 * s) * 1.25, 0, 1) ** 0.6
        ao *= 1 - np.clip(self.groove, 0, 1) * 0.35
        # contact shadow under polo collar flaps
        if self.kind == 'polo' and view == 'front':
            fl = np.maximum(P.get('collar_r', 0), P.get('collar_l', 0))
            sh_ = blur(np.roll(np.roll(fl, int(2.5 * s), 0), int(1.5 * s), 1), 1.6 * s) * (1 - fl)
            ao *= 1 - sh_ * 0.6
            ring = np.clip(blur(cv2.dilate(fl, np.ones((int(1.2 * s) * 2 + 1,) * 2, np.uint8)), 0.6 * s) - fl, 0, 1)
            ao *= 1 - ring * 0.55
        # inside of the neck is in shadow
        ao *= 1 - blur(P['inside'], 2 * s) * 0.6
        shade = (0.16 + 0.95 * diff + fill) * ao
        img = A * shade[..., None]
        # specular / sheen
        Hv = L + np.array([0, 0, 1], np.float32); Hv /= np.linalg.norm(Hv)
        ndh = np.clip(nxx * Hv[0] + nyy * Hv[1] + nzz * Hv[2], 0, 1)
        sheen = {'polyester-dry-fit': 0.10, 'modal-blend': 0.05, 'cotton-polyester': 0.03}.get(self.fabric, 0.018)
        img += (ndh ** 24 * sheen)[..., None] * ao[..., None]
        img += (ndh ** 40 * 0.22 * spec_mask)[..., None]

        # composite on background -----------------------------------------
        if bg == 'none':
            rgb = lin_to_srgb(img)
            rgba = np.dstack([rgb, sil])
            if ss > 1:
                rgba = cv2.resize(rgba, (c.w // ss, c.h // ss), interpolation=cv2.INTER_AREA)
            return (np.clip(rgba, 0, 1) * 255 + 0.5).astype(np.uint8)
        bgimg = self.background(c, bg, sil)
        a = sil[..., None]
        out = bgimg * (1 - a) + img * a
        out = lin_to_srgb(out)
        if ss > 1:
            out = cv2.resize(out, (c.w // ss, c.h // ss), interpolation=cv2.INTER_AREA)
        if out_size:
            out = cv2.resize(out, out_size, interpolation=cv2.INTER_AREA)
        return (np.clip(out, 0, 1) * 255 + 0.5).astype(np.uint8)

    def color_name_is_heather(self):
        return abs(float(self.color[0]) - float(self.color[2])) < 0.04 and 0.3 < float(self.color.mean()) < 0.8 and getattr(self, 'heather', False)

    def background(self, c, bg, sil):
        h, w = c.h, c.w
        yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
        if isinstance(bg, (tuple, list)):
            top, bot = srgb_to_lin(hex_rgb(bg[0])), srgb_to_lin(hex_rgb(bg[1]))
        else:
            top, bot = srgb_to_lin(hex_rgb('#efece6')), srgb_to_lin(hex_rgb('#e2ddd4'))
        t = (yy / h)[..., None]
        B = top * (1 - t) + bot * t
        # vignette
        vx, vy = (xx / w - 0.5), (yy / h - 0.45)
        vig = 1 - np.clip((vx ** 2 + vy ** 2) * 0.55, 0, 0.25)
        B = B * vig[..., None]
        # soft drop shadow of the garment (ghost mannequin hanging slightly off the sweep)
        sh = np.zeros_like(sil)
        M = np.float32([[1, 0, 0.012 * w], [0, 1, 0.022 * h]])
        sh = cv2.warpAffine(sil, M, (w, h))
        sh = blur(sh, 0.018 * w)
        B = B * (1 - sh[..., None] * 0.28)
        return B

    # artwork ------------------------------------------------------------
    def apply_print(self, c, pr, H, A, spec_mask, sil, rng):
        art = pr['img']  # HxWx4 uint8 sRGB, straight alpha
        x, y, w, h = pr['box']
        pw, ph = max(2, int(w * c.s)), max(2, int(h * c.s))
        art = cv2.resize(art, (pw, ph), interpolation=cv2.INTER_AREA if pw < art.shape[1] else cv2.INTER_CUBIC).astype(np.float32) / 255.0
        L = np.zeros((c.h, c.w, 4), np.float32)
        px, py = int((x - c.ox) * c.s), int((y - c.oy) * c.s)
        x0, y0 = max(px, 0), max(py, 0)
        x1, y1 = min(px + pw, c.w), min(py + ph, c.h)
        if x1 <= x0 or y1 <= y0:
            return H, A, spec_mask
        L[y0:y1, x0:x1] = art[y0 - py:y1 - py, x0 - px:x1 - px]
        # warp with the cloth
        Hb = blur(H, 3 * c.s)
        gy, gx = np.gradient(Hb)
        k = 0.6
        yy, xx = np.mgrid[0:c.h, 0:c.w].astype(np.float32)
        L = cv2.remap(L, xx + gx * k, yy + gy * k, cv2.INTER_LINEAR, borderMode=cv2.BORDER_CONSTANT)
        alpha = L[..., 3] * sil
        ink = srgb_to_lin(L[..., :3])
        kind = pr.get('kind', 'screen')
        if kind in ('vintage', 'discharge'):
            crack = noise(c.h, c.w, 1.6 * c.s, rng, 2)
            wear = blur(noise(c.h, c.w, 25 * c.s, rng, 2), 2 * c.s)
            keep = np.clip((crack + 0.9 + wear * 0.8) * 2.5, 0, 1)
            alpha = alpha * keep * (0.82 if kind == 'vintage' else 0.9)
            ink = ink * 0.85 + A * 0.15
        if kind in ('screen', 'vintage', 'discharge', 'reflective'):
            grain = 1 + noise(c.h, c.w, 0.5 * c.s, rng, 1)[..., None] * 0.04
            A = A * (1 - alpha[..., None]) + ink * grain * alpha[..., None]
            H = H + blur(alpha, 0.4 * c.s) * 0.35
            if kind == 'reflective':
                spec_mask = np.maximum(spec_mask, alpha * 0.9)
        elif kind == 'puff':
            A = A * (1 - alpha[..., None]) + ink * alpha[..., None]
            H = H + blur(alpha, 1.0 * c.s) * 4.5
            spec_mask = np.maximum(spec_mask, alpha * 0.15)
        elif kind in ('embroidery', 'label'):
            ang = math.radians(pr.get('stitch_angle', 35))
            per = max(1.6, 0.32 * c.s)
            thread = np.sin((xx * math.cos(ang) + yy * math.sin(ang)) / per * math.pi * 2)
            thread2 = noise(c.h, c.w, 0.6 * c.s, rng, 1) * 0.3
            raised = blur(alpha, 0.5 * c.s)
            dome = blur(raised, 0.9 * c.s)
            H = H + dome * (3.2 if kind == 'embroidery' else 1.4) + raised * (thread * 0.45 + thread2) * 0.9
            A = A * (1 - alpha[..., None]) + ink * (1 + thread[..., None] * 0.06) * alpha[..., None]
            spec_mask = np.maximum(spec_mask, alpha * (0.55 if kind == 'embroidery' else 0.25))
            # thread shadow on the base cloth
            halo = np.clip(blur(alpha, 1.2 * c.s) - alpha, 0, 1)
            A = A * (1 - halo[..., None] * 0.35)
        return H, A, spec_mask
