# SIDDIQIYA Apparel — apparel-manufacturing-platform

International T-shirt design, manufacturing, wholesale and export platform, live at **https://app.hsdmj.com**.

## Current release: public website (Milestone 1)

A static site served by GitHub Pages from this repository's `main` branch.

- Home, 6 collections, 12 category pages, 24 product pages, catalog with filters and sorting
- Fabric library (9 fabrics) with sample-request forms
- Custom design studio: garment mockups (front, back, both sleeves) with defined print areas; artwork is placed inside the print area, keeps its proportions, can be dragged and resized, and supports transparent PNG, JPG, SVG (sanitised) and PDF
- Manufacturing (OEM, ODM, private label + 13 service pages with inquiry forms), wholesale buyer application
- Quote list and wishlist (saved in the visitor's browser), search, size guide, shipping, FAQ, privacy, terms
- SEO: meta tags, Open Graph, JSON-LD, `sitemap.xml`, `robots.txt`

### How forms work today
There is no backend yet. Every form validates input in the browser and opens WhatsApp
(+855 96 733 5609) with the request pre-filled; the visitor presses send. Nothing is stored on a server.

### What is intentionally not shown
Prices, MOQs and lead times are "on request" — they are never invented. Product images are
generated garment illustrations until real photography is supplied.

## Editing content
All content lives in `src/data.mjs` (products, fabrics, categories, collections, services).
Garment and fabric illustrations come from `src/art.mjs`; studio mockup templates and print areas from `src/mockup.mjs`.

```bash
node src/build.mjs      # regenerates every page, image, sitemap and data file
python3 -m http.server  # preview at http://localhost:8000
```
Commit the generated files together with the source changes.

## Next milestones
See the architecture plan: buyer accounts, admin, factory, export and finance need a server and
PostgreSQL (planned on Vercel + Supabase), which replaces the WhatsApp-only forms.
