# Product image renderer

All product, fabric, collection and campaign images on the site are renders produced here and
committed under `assets/img/`. The site build (`node src/build.mjs`) only references them and fails
if any referenced image is missing — it never regenerates or overwrites them.

```
node tools/render/art.mjs            # artwork PNGs for every product colourway (Playwright + Chromium)
python3 tools/render/render.py       # front, back, collar detail, fabric macro per colourway (~40 min)
python3 tools/render/render.py --only box-oversized-tee:black   # one colourway
python3 tools/render/render.py --fabrics                         # fabric library macros
python3 tools/render/compose.py      # collection scenes + homepage hero cut-outs
node src/build.mjs
```

- `designs.mjs` — the original artwork for each product (typography, graphics, embroidery marks).
- `garment.py` — garment geometry, fold height-field, knit micro-texture, studio lighting, print / puff /
  embroidery compositing that follows the cloth.
- `macro.py` — macro knit structures (jersey, pique, rib, mesh, terry/fleece).

Fonts used for artwork: Inter, TeX Gyre (Heros Cn, Bonum, Chorus), Lora, Poppins — all open-licence.
These are renders, not photographs; real campaign photography can be uploaded in Admin → Website content.
