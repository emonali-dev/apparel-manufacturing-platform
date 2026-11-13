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

### Backend (Supabase)
Buyer accounts, requests and the admin dashboard use the Supabase project `ketzuhfolwhofrnliirf`
(shared with other SIDDIQIYA apps; every object here is prefixed `apparel_`). Schema and functions are in
`supabase/migrations/`. Tables have row-level security with no direct access — the browser can only call
the `apparel_*` SECURITY DEFINER functions, which check the signed-in user, validate input and rate-limit.

- **Forms**: every form (contact, service, wholesale, samples, studio, RFQ, newsletter) is saved to the
  database and returns a reference number; WhatsApp (+855 96 733 5609) is offered as a follow-up/fallback.
- **Buyers** (`/account/`): register, sign in, reset password, company profile, wholesale application,
  consolidated RFQs (multiple products with colour, fabric, GSM and size quantities), sample requests,
  status history and messages from the sales team.
- **Admin** (`/admin/`): overview counts, quotations, orders, samples (courier + tracking), inquiries,
  buyer verification, and products / fabrics / collections management. Admins are listed in
  `apparel_admins`. Catalog changes show on the public site immediately (`assets/js/live.mjs`);
  products added in the admin get a page at `/products/view/?id=…` until the next build.
- **Notifications**: new requests appear as badges in the admin dashboard. Email notifications are not
  set up (they need an email provider such as Resend).

### What is intentionally not shown
Prices, MOQs and lead times are "on request" — they are never invented. Product images are
generated garment illustrations until real photography is supplied.

## Editing content
All content lives in `src/data.mjs` (products, fabrics, categories, collections, services).
Garment and fabric illustrations come from `src/art.mjs`; studio mockup templates and print areas from `src/mockup.mjs`.

```bash
node src/build.mjs      # regenerates every page, image, sitemap and data file
node src/seed-sql.mjs   # prints SQL that seeds the database catalog from src/data.mjs
python3 -m http.server  # preview at http://localhost:8000
```
Commit the generated files together with the source changes.

## Next milestones
Factory/production, inventory, export documents and finance modules from the architecture plan.
