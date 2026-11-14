"""Macro fabric renders: knit structure as a height field with raking studio light."""
import math
import numpy as np
import cv2
from garment import blur, noise, srgb_to_lin, lin_to_srgb, hex_rgb


def knit_height(h, w, kind, cell, rng):
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    # gentle cloth undulation so the macro does not look like a flat texture tile
    wav = blur(noise(h, w, w / 3, rng, 2), w / 40) * cell * 1.6
    yy2 = yy + wav * 0.6
    xx2 = xx + blur(noise(h, w, w / 4, rng, 2), w / 40) * cell * 0.6
    if kind in ('pique',):
        a, b = cell * 1.2, cell * 1.04
        cx = (xx2 / a) % 1.0 - 0.5
        row = np.floor(yy2 / b)
        cx = np.where(row % 2 == 0, cx, ((xx2 / a + 0.5) % 1.0) - 0.5)
        cy = (yy2 / b) % 1.0 - 0.5
        d = np.sqrt(cx ** 2 + (cy * 1.1) ** 2)
        H = np.clip(1 - d * 2.1, 0, 1) ** 0.6 * 0.4 + np.clip(np.abs(d - 0.36) * -6 + 1, 0, 1) * 0.9
    elif kind == 'rib':
        a = cell * 1.1
        ph = (xx2 / a) % 1.0
        wale = np.where(ph < 0.62, np.sin(ph / 0.62 * math.pi), -0.4)
        loop = np.abs(((yy2 / (cell * 0.75)) % 1.0) - 0.5)
        H = wale * (0.8 + 0.2 * np.cos(loop * math.pi * 2))
    elif kind in ('mesh', 'polyester-dry-fit'):
        a = cell * 0.9
        cx = (xx2 / a) % 1.0 - 0.5
        cy = (yy2 / a) % 1.0 - 0.5
        d = np.sqrt(cx ** 2 + cy ** 2)
        H = np.clip((d - 0.17) * 6, 0, 1) * (0.7 + 0.3 * np.cos(cx * math.pi * 2))
    elif kind in ('fleece', 'french-terry'):
        # looped reverse with short fibres
        a = cell * 0.8
        cx = (xx2 / a) % 1.0 - 0.5
        cy = ((yy2 / (a * 1.15)) + np.floor(xx2 / a) * 0.5) % 1.0 - 0.5
        d = np.sqrt(cx ** 2 + cy ** 2)
        H = np.clip(1 - np.abs(d - 0.3) * 7, 0, 1)
        H = H * 0.7 + blur(noise(h, w, cell * 0.25, rng, 1), cell * 0.08) * 0.6
    else:
        # single jersey: interlocking V-shaped loops in wales
        a = cell * 0.9           # wale width
        b = cell * 0.78          # course height
        u = (xx2 / a) % 1.0
        v = (yy2 / b) % 1.0
        side = np.where(u < 0.5, 1.0, -1.0)
        uu = np.where(u < 0.5, u, 1 - u)               # 0..0.5 from wale edge to centre
        # each half-loop is a slanted ellipse forming a V
        ex = (uu - 0.27) / 0.2
        ey = (v - 0.5 - (uu - 0.25) * 0.9) / 0.62
        leg = np.clip(1 - (ex ** 2 + ey ** 2), 0, 1) ** 0.5
        H = leg - 0.15
    fib = blur(noise(h, w, max(2, cell * 0.12), rng, 1), max(0.6, cell * 0.04))
    return H.astype(np.float32) + fib * 0.08 + wav / (cell * 6)


def render_macro(kind, color, size=1200, cell=46, seed=3, heather=False, washed=False, print_edge=None):
    rng = np.random.default_rng(seed)
    ss = 2
    h = w = size * ss
    H = knit_height(h, w, kind, cell * ss, rng)
    gy, gx = np.gradient(blur(H, 0.8 * ss))
    k = cell * ss * 0.55
    nx, ny, nz = -gx * k, -gy * k, np.ones_like(H)
    inv = 1 / np.sqrt(nx ** 2 + ny ** 2 + nz ** 2)
    nx, ny, nz = nx * inv, ny * inv, nz * inv
    L = np.array([-0.62, -0.55, 0.56]); L /= np.linalg.norm(L)
    diff = np.clip(nx * L[0] + ny * L[1] + nz * L[2], 0, 1)
    ao = np.clip(0.55 + H * 0.5, 0.25, 1.1)
    base = srgb_to_lin(hex_rgb(color))
    A = np.ones((h, w, 3), np.float32) * base
    yarn = blur(noise(h, w, cell * ss * 0.5, rng, 2), cell * ss * 0.05)
    A *= (1 + yarn[..., None] * 0.07)
    if heather:
        fleck = noise(h, w, cell * ss * 0.12, rng, 1)
        A *= (1 + np.clip(fleck * 1.4, -1.2, 1.2)[..., None] * 0.22)
    if washed:
        mott = blur(noise(h, w, w / 3, rng, 3), w / 30)
        A = A * (1 + mott[..., None] * 0.18) + 0.01
    if print_edge is not None:
        A = print_edge(A, H, h, w)
    shade = (0.12 + 1.05 * diff) * ao
    # gradient falloff of the studio light across the frame
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    fall = 1.08 - ((xx / w) * 0.18 + (yy / h) * 0.22)
    img = A * (shade * fall)[..., None]
    Hv = L + np.array([0, 0, 1]); Hv /= np.linalg.norm(Hv)
    spec = np.clip(nx * Hv[0] + ny * Hv[1] + nz * Hv[2], 0, 1) ** 30
    img += (spec * (0.08 if kind in ('polyester-dry-fit', 'mesh') else 0.025))[..., None]
    out = lin_to_srgb(img)
    out = cv2.resize(out, (size, size), interpolation=cv2.INTER_AREA)
    # shallow depth of field toward the far corner, like a macro lens
    yy, xx = np.mgrid[0:size, 0:size].astype(np.float32)
    dof = np.clip(((xx / size) + (yy / size) - 1.15) * 1.6, 0, 1)[..., None]
    out = out * (1 - dof) + cv2.GaussianBlur(out, (0, 0), 3.2) * dof
    return (np.clip(out, 0, 1) * 255 + 0.5).astype(np.uint8)
