"""Collection scenes and homepage hero cut-outs, composed from rendered garments.

Usage: python3 tools/render/compose.py
"""
import json
import os
import sys
import math
import numpy as np
import cv2

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from garment import Garment, blur, noise, srgb_to_lin, lin_to_srgb, hex_rgb  # noqa: E402
from render import area_box  # noqa: E402
from garment import SHAPES  # noqa: E402

ROOT = os.path.abspath(os.path.join(HERE, '..', '..'))
OUT = os.path.join(ROOT, 'assets', 'img')
MAN = {(m['slug'], m['color']): m for m in json.load(open(os.path.join(HERE, 'out', 'manifest.json')))}
CACHE = {}


def cutout(slug, color, view='front', scale=2.6):
    key = (slug, color, view, scale)
    if key in CACHE:
        return CACHE[key]
    m = MAN[(slug, color)]
    g = Garment(m['shape'], m['hex'], fabric=m['fabric'], finish=m['finish'], seed=abs(hash(m['slug'])) % 1000,
                sleeve_color=m.get('sleeve'), tipping=m.get('tipping'))
    g.heather = m.get('heather', False)
    prints = []
    for pr in m['prints']:
        art = cv2.cvtColor(cv2.imread(os.path.join(HERE, pr['file']), cv2.IMREAD_UNCHANGED), cv2.COLOR_BGRA2RGBA)
        prints.append({'img': art, 'box': area_box(pr['area'], m['shape'], art.shape[:2], SHAPES[m['shape']]['hem_y']), 'view': pr['view'],
                       'kind': pr['kind'], 'stitch_angle': pr.get('stitch_angle', 35)})
    im = g.render(view, scale=scale, prints=prints, bg='none')
    CACHE[key] = im
    return im


def place(canvas_lin, shadow_acc, rgba, cx, cy, height, angle, shadow=(0.03, 0.05, 0.035, 0.45)):
    """Paste a garment cut-out (sRGB RGBA uint8) onto a linear canvas, with a soft cast shadow."""
    H, W = canvas_lin.shape[:2]
    ys, xs = np.where(rgba[..., 3] > 8)
    crop = rgba[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
    k = height / crop.shape[0]
    crop = cv2.resize(crop, (int(crop.shape[1] * k), int(height)), interpolation=cv2.INTER_AREA)
    h, w = crop.shape[:2]
    M = cv2.getRotationMatrix2D((w / 2, h / 2), angle, 1.0)
    M[0, 2] += cx - w / 2
    M[1, 2] += cy - h / 2
    warped = cv2.warpAffine(crop, M, (W, H), flags=cv2.INTER_LINEAR, borderMode=cv2.BORDER_CONSTANT).astype(np.float32) / 255
    a = warped[..., 3:4]
    dx, dy, sig, op = shadow
    S = cv2.warpAffine(a[..., 0], np.float32([[1, 0, dx * W], [0, 1, dy * H]]), (W, H))
    S = blur(S, sig * W)
    canvas_lin *= (1 - S[..., None] * op)
    canvas_lin[:] = canvas_lin * (1 - a) + srgb_to_lin(warped[..., :3]) * a
    return canvas_lin


def grad(H, W, top, bottom, angle=90):
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    a = math.radians(angle)
    t = ((xx / W - 0.5) * math.cos(a) + (yy / H - 0.5) * math.sin(a)) + 0.5
    t = np.clip(t, 0, 1)[..., None]
    return srgb_to_lin(hex_rgb(top)) * (1 - t) + srgb_to_lin(hex_rgb(bottom)) * t


def light(H, W, cx, cy, r, gain=0.35):
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    d = np.sqrt(((xx - cx * W) / (r * W)) ** 2 + ((yy - cy * H) / (r * H)) ** 2)
    return (1 + gain * np.exp(-d ** 2))[..., None] * (1 - 0.35 * np.clip(d - 0.6, 0, 1.4)[..., None] / 1.4)


def backdrop(name, H, W, rng):
    if name == 'linen':
        B = grad(H, W, '#efe7da', '#ddd1bf', 100)
        weave = (np.sin(np.arange(W) / 1.6)[None, :] * 0.5 + np.sin(np.arange(H) / 1.7)[:, None] * 0.5)
        B *= (1 + (weave * 0.018 + blur(noise(H, W, 3, rng, 1), 0.8) * 0.03))[..., None]
        B *= light(H, W, 0.3, 0.2, 0.8, 0.25)
    elif name == 'plaster':
        B = grad(H, W, '#d8c8ad', '#bfa98a', 120)
        B *= (1 + blur(noise(H, W, 40, rng, 4), 3) * 0.07)[..., None]
        yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
        band = ((xx * 0.55 + yy) / W) % 0.62
        win = blur(((band > 0.08) & (band < 0.36)).astype(np.float32), W * 0.012)
        B *= (0.78 + 0.32 * win)[..., None]
    elif name == 'concrete':
        B = grad(H, W, '#3a3632', '#1d1b19', 90)
        B *= (1 + (noise(H, W, 2.5, rng, 1) * 0.06 + blur(noise(H, W, 60, rng, 4), 6) * 0.12))[..., None]
        B *= light(H, W, 0.5, 0.15, 0.6, 1.1)
    elif name == 'block':
        B = grad(H, W, '#f1ece2', '#e5ddcf', 90)
        B *= (1 + noise(H, W, 2.0, rng, 1) * 0.015)[..., None]
        x0, x1, y0, y1 = int(W * 0.52), int(W * 0.94), int(H * 0.08), int(H * 0.74)
        blk = np.zeros((H, W), np.float32); blk[y0:y1, x0:x1] = 1
        B = B * (1 - blk[..., None]) + srgb_to_lin(hex_rgb('#a5482f')) * blk[..., None] * (1 + noise(H, W, 2, rng, 1) * 0.02)[..., None]
        ln = np.zeros((H, W), np.float32); ln[int(H * 0.86):int(H * 0.86) + 3, int(W * 0.06):int(W * 0.94)] = 1
        B = B * (1 - ln[..., None]) + srgb_to_lin(hex_rgb('#1b1a18')) * ln[..., None]
    elif name == 'stone':
        B = grad(H, W, '#d7d8d4', '#a9aea8', 110)
        B *= (1 + blur(noise(H, W, 30, rng, 3), 2) * 0.05)[..., None]
        B *= light(H, W, 0.7, 0.25, 0.7, 0.3)
    elif name == 'cobalt':
        B = grad(H, W, '#1f3a78', '#0b1020', 115)
        yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
        streak = np.zeros((H, W), np.float32)
        for k, (o, w) in enumerate([(0.15, 0.03), (0.32, 0.012), (0.62, 0.05), (0.8, 0.01)]):
            d = np.abs(((xx - yy * 0.7) / W) - o)
            streak += np.exp(-(d / w) ** 2) * (0.5 if k % 2 else 0.3)
        B *= (1 + streak * 0.6)[..., None]
    else:  # cream with dappled leaf shadows
        B = grad(H, W, '#f3ecdf', '#e4d8c4', 95)
        leaves = blur(noise(H, W, 70, rng, 3), 4)
        dapple = blur((leaves > 0.25).astype(np.float32), W * 0.01)
        B *= (1 - dapple * 0.16)[..., None]
        B *= light(H, W, 0.25, 0.1, 0.9, 0.2)
    return B.astype(np.float32)


SCENES = {
    'essential': ('linen', [('core-crew-tee', 'white', 'front', 0.27, 0.55, 0.50, -8), ('supima-style-combed-tee', 'black', 'front', 0.75, 0.50, 0.51, 7), ('everyday-crew-tee', 'bone', 'front', 0.50, 0.62, 0.53, -1)]),
    'oversized': ('plaster', [('studio-oversized-tee', 'heather', 'back', 0.29, 0.50, 0.48, -6), ('box-oversized-tee', 'sand', 'back', 0.66, 0.55, 0.56, 4)]),
    'streetwear': ('concrete', [('block-street-tee', 'bone', 'front', 0.27, 0.55, 0.50, -7), ('street-heavy-tee', 'black', 'back', 0.68, 0.53, 0.58, 5)]),
    'graphic': ('block', [('arc-graphic-tee', 'black', 'front', 0.71, 0.46, 0.50, 6), ('horizon-graphic-tee', 'white', 'front', 0.32, 0.55, 0.53, -5)]),
    'polo': ('stone', [('classic-pique-polo', 'white', 'front', 0.25, 0.52, 0.48, -7), ('classic-pique-polo', 'forest', 'front', 0.75, 0.50, 0.48, 7), ('classic-pique-polo', 'navy', 'front', 0.50, 0.58, 0.53, 0)]),
    'sportswear': ('cobalt', [('team-raglan-tee', 'navy', 'back', 0.30, 0.52, 0.50, -6), ('pace-training-tee', 'white', 'front', 0.68, 0.56, 0.53, 5)]),
    'premium-cotton': ('cream', [('organic-heavy-tee', 'sand', 'back', 0.29, 0.52, 0.50, -5), ('atelier-crew-tee', 'charcoal', 'front', 0.71, 0.55, 0.53, 4)]),
}


def scene(name, size=1500):
    bg, items = SCENES[name]
    rng = np.random.default_rng(len(name) * 13)
    C = backdrop(bg, size, size, rng)
    for slug, color, view, x, y, h, ang in items:
        dark_bg = bg in ('concrete', 'cobalt')
        C = place(C, None, cutout(slug, color, view), x * size, y * size, h * size, ang,
                  shadow=(0.02, 0.035, 0.03, 0.62 if dark_bg else 0.4))
    out = (np.clip(lin_to_srgb(C), 0, 1) * 255 + 0.5).astype(np.uint8)
    return out


def save(img, path, q=80, sizes=((1500, ''), (800, '-sm'))):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    bgr = cv2.cvtColor(img, cv2.COLOR_RGB2BGR) if img.shape[2] == 3 else cv2.cvtColor(img, cv2.COLOR_RGBA2BGRA)
    for w, suf in sizes:
        h = int(bgr.shape[0] * w / bgr.shape[1])
        im = bgr if w >= bgr.shape[1] else cv2.resize(bgr, (w, h), interpolation=cv2.INTER_AREA)
        cv2.imwrite(path.replace('.webp', suf + '.webp'), im, [cv2.IMWRITE_WEBP_QUALITY, q])


if __name__ == '__main__':
    only = sys.argv[1:] or list(SCENES) + ['hero']
    for n in only:
        if n == 'hero':
            for slug, color, view, tag in [('box-oversized-tee', 'bone', 'back', 't1'), ('street-heavy-tee', 'black', 'back', 't2'), ('drop-shoulder-tee', 'stone', 'front', 't3')]:
                im = cutout(slug, color, view, scale=3.0)
                ys, xs = np.where(im[..., 3] > 8)
                im = im[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
                save(im, os.path.join(OUT, 'campaign', f'hero-{tag}.webp'), q=84, sizes=((900, ''), (500, '-sm')))
            print('hero', flush=True)
            continue
        save(scene(n), os.path.join(OUT, 'collections', f'{n}.webp'))
        print(n, flush=True)
