# SIDDIQIYA Apparel — apparel-manufacturing-platform

International T-shirt design, manufacturing, wholesale and export platform, live at **https://app.hsdmj.com**.

## Platform

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
- **Quotation requests** (`/quote/`): 4 steps — buyer details, products (colour, fabric, GSM, size quantities),
  project details (order type, destination, target date, budget, printing, embroidery, customisation) and
  artwork upload (JPG, PNG, PDF, AI, PSD; private storage, signed-in buyers). Reference ID, duplicate
  prevention, confirmation email and admin notification (queued).
- **Buyers** (`/account/`): overview, quotations (accept / request changes / decline, revisions, printable
  PDF at `/quotation/?id=…`), orders with production stages and shipments, samples, documents, support
  messages, delivery addresses, profile & password, wishlist. Verified wholesale buyers see trade prices.
- **Admin** (`/admin/`), 8 roles (Super Admin, Admin, Sales Manager, Sales Rep, Production Manager,
  QC Manager, Shipping Manager, Support) — each module shown only to roles that may use it and enforced
  again in the database: overview metrics (quoted value is kept separate from confirmed order value),
  quotations (quote builder, quantity tiers, shipping, tax, validity, revisions), orders (13 statuses,
  payments, documents), production (9 stages) and QC checklists with photos, shipping & export documents,
  samples, inquiries, buyers with message threads, CRM (leads, pipeline, follow-ups, activity history),
  suppliers, products (SKU, gallery upload and ordering, wholesale price and tiers, private label,
  manufacturing notes), fabrics, collections (banner, product assignment, order), website content (hero,
  announcements, about, contact, FAQ, notification email, FX rates), reports with CSV export, users & roles,
  email queue and audit log.
- **Email**: `supabase/functions/apparel-mailer` sends the queued emails through Resend once configured.

Docs: `docs/DEPLOYMENT.md`, `docs/BACKUP_RECOVERY.md`, `docs/TESTING_REPORT.md`, `docs/KNOWN_ISSUES.md`,
`docs/CREDENTIALS_CHECKLIST.md`, `.env.example`. Tests: `supabase/tests/platform_test.sql`, `tests/e2e/`.

### What is intentionally not shown
Public prices, MOQs and lead times are "on request" — they are never invented; wholesale prices entered by staff are shown only to verified buyers. Product images are
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
Inventory and finance modules; carrier API tracking if a carrier account is provided.
