"""Renders every product colourway (front, back, collar detail, fabric macro) and the fabric library.

Usage: python3 tools/render/render.py [--only slug,...] [--fabrics] [--quick]
Writes WebP files to assets/img/products/<slug>/ and assets/img/fabrics/.
"""
import json
import os
import sys
import time
import numpy as np
import cv2

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from garment import Garment, T, K, UNIT_W, hex_rgb  # noqa: E402
from macro import render_macro  # noqa: E402

ROOT = os.path.abspath(os.path.join(HERE, '..', '..'))
OUT = os.path.join(ROOT, 'assets', 'img')

# print areas in natural units (x, y, w, h); x centred on 200, y = 0 at the shoulder high point
AREAS = {
    'chest-left': (220, 30, 28, 28),
    'chest-center': (176, 32, 48, 18),
    'front-center': (148, 46, 104, 120),
    'front-wide': (138, 44, 124, 62),
    'back-full': (140, 30, 120, 150),
    'back-neck': (182, 8, 36, 10),
    'polo-chest': (222, 40, 24, 26),
}
WIDTH = {'crew': 84, 'heavy': 90, 'oversized': 102, 'drop': 98, 'polo': 84, 'raglan': 80}
FABRIC_TEX = {'pique': 'pique', 'polyester-dry-fit': 'polyester-dry-fit', 'french-terry': 'french-terry', 'fleece': 'fleece', 'rib': 'rib'}


def area_box(name, shape, art_hw, garment_hem):
    if name == 'hem-left':
        x, y, w, h = 232, garment_hem - 24, 16, 9
    else:
        x, y, w, h = AREAS[name]
    f = WIDTH[shape] / 84.0
    if name not in ('back-neck', 'polo-chest'):
        x = 200 + (x - 200) * f
        w, h = w * f, h * f
    # fit artwork aspect inside the area (top-aligned for chest/back blocks)
    ah, aw = art_hw
    ar = aw / ah
    if w / h > ar:
        nw = h * ar
        x += (w - nw) / 2
        w = nw
    else:
        h = w / ar
    p = T((x, y))
    return (float(p[0]), float(p[1]), w * K, h * K)


def save_webp(img, path, q=82, sizes=((1200, ''), (600, '-sm'))):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    bgr = cv2.cvtColor(img, cv2.COLOR_RGB2BGR)
    h, w = bgr.shape[:2]
    for width, suf in sizes:
        im = bgr if width >= w else cv2.resize(bgr, (width, int(h * width / w)), interpolation=cv2.INTER_AREA)
        cv2.imwrite(path.replace('.webp', suf + '.webp'), im, [cv2.IMWRITE_WEBP_QUALITY, q])


def render_colourway(m, quick=False):
    from garment import SHAPES
    hem_nat = SHAPES[m['shape']]['hem_y']
    g = Garment(m['shape'], m['hex'], fabric=m['fabric'], finish=m['finish'], seed=abs(hash(m['slug'])) % 1000,
                sleeve_color=m.get('sleeve'), tipping=m.get('tipping'))
    g.heather = m.get('heather', False)
    prints = []
    for pr in m['prints']:
        art = cv2.imread(os.path.join(HERE, pr['file']), cv2.IMREAD_UNCHANGED)
        art = cv2.cvtColor(art, cv2.COLOR_BGRA2RGBA)
        prints.append({'img': art, 'box': area_box(pr['area'], m['shape'], art.shape[:2], hem_nat), 'view': pr['view'],
                       'kind': pr['kind'], 'stitch_angle': pr.get('stitch_angle', 35)})
    scale = 1.5 if quick else 3.0
    d = os.path.join(OUT, 'products', m['slug'])
    front = g.render('front', scale=scale, prints=prints)
    save_webp(front, os.path.join(d, f"{m['color']}-front.webp"))
    back = g.render('back', scale=scale, prints=prints)
    save_webp(back, os.path.join(d, f"{m['color']}-back.webp"))
    # collar & stitching detail: a tight crop around the neckline at high magnification
    nx = 200 - 66 * K * 1.0
    crop = (200 - 70, Y_neck() - 26, 140, 154)
    det = g.render('front', scale=1200 / 140 if not quick else 4, crop=crop, prints=prints, ss=1)
    save_webp(det, os.path.join(d, f"{m['color']}-detail.webp"), sizes=((1200, ''), (600, '-sm')))
    # fabric macro (the actual knit of this colourway)
    tex = FABRIC_TEX.get(m['fabric'], '100-cotton')
    mac = render_macro(tex, m['hex'], size=1000 if not quick else 400, cell=40, seed=7, heather=m.get('heather', False), washed=m['finish'] == 'vintage')
    save_webp(mac, os.path.join(d, f"{m['color']}-fabric.webp"), sizes=((1000, ''), (500, '-sm')))


def Y_neck():
    from garment import Y0
    return Y0


def render_fabrics(quick=False):
    sys.path.insert(0, ROOT)
    data = json.loads(open(os.path.join(HERE, 'out', 'fabrics.json')).read())
    for f in data['fabrics']:
        tex = FABRIC_TEX.get(f['slug'], {'pique': 'pique'}.get(f['texture'], f['texture'] if f['texture'] in ('rib', 'fleece', 'mesh') else '100-cotton'))
        if f['texture'] == 'terry':
            tex = 'french-terry'
        if f['texture'] == 'mesh':
            tex = 'polyester-dry-fit'
        for c in f['colors']:
            img = render_macro(tex, data['colors'][c], size=900 if not quick else 300, cell=36, seed=11, heather=(c == 'heather' or f['texture'] == 'jersey-heather'),
                               washed=(c == 'washed'))
            save_webp(img, os.path.join(OUT, 'fabrics', f"{f['slug']}-{c}.webp"), sizes=((900, ''), (450, '-sm')))
        print('fabric', f['slug'], flush=True)


if __name__ == '__main__':
    args = sys.argv[1:]
    quick = '--quick' in args
    if '--fabrics' in args:
        render_fabrics(quick)
        sys.exit()
    only = None
    if '--only' in args:
        only = set(args[args.index('--only') + 1].split(','))
    man = json.load(open(os.path.join(HERE, 'out', 'manifest.json')))
    t0 = time.time()
    for i, m in enumerate(man):
        if only and m['slug'] not in only and f"{m['slug']}:{m['color']}" not in only:
            continue
        if '--resume' in args and os.path.exists(os.path.join(OUT, 'products', m['slug'], f"{m['color']}-fabric-sm.webp")):
            continue
        render_colourway(m, quick)
        print(f"{i + 1}/{len(man)} {m['slug']} {m['color']} {time.time() - t0:.0f}s", flush=True)
