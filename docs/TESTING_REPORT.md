# Testing report — platform v2 (2026-11-13)

## Environment
- Local PostgreSQL 16 with a Supabase shim (roles `anon`/`authenticated`/`service_role`, `auth.uid()` from JWT claims, `storage.objects` with RLS) and migrations 01–08 applied.
- Browser tests: Playwright Chromium against the built static site, with a test emulator (`tests/e2e/emulator.mjs`) that executes every RPC and storage call as the signed-in user against that database — no mocked business logic.

## Database suite — `supabase/tests/platform_test.sql`
Runs in a rolled-back transaction across all roles: permissions per role, RFQ submission/validation/dedupe, quotation revisions and totals, buyer responses, order creation, production stages, QC, shipments, files visibility, CRM linkage, messages, addresses, content, FX, reports, audit. Result: **ALL PLATFORM TESTS PASSED**.

## End-to-end suite — `tests/e2e/platform.e2e.mjs` — 66/66 passed
- Buyer registration → portal; 4-step quotation form (profile prefill, step validation, future-date check, JPG/PNG/PDF upload with signature check, rejected fake PNG); RFQ code; files stored privately; confirmation + admin emails queued; duplicate submission blocked.
- Admin: download buyer artwork; quotation builder with tiers/shipping/tax; server-side totals; send; buyer negotiates; revision 2 supersedes revision 1; buyer accepts; printable quotation.
- Order from quotation; status/payment updates with buyer message; document upload shared with buyer; production order, stage updates; QC checklist with defects and photo; shipment by Shipping Manager.
- Role enforcement: Shipping Manager and Sales Rep see only their modules and are refused by the database for others.
- Buyer: order timeline with production stages and shipment; downloads shared invoice; cannot download internal QC photo; support messages; staff reply; CRM lead auto-created and linked; activity log.
- Catalog: product created with SKU, uploaded image, wholesale price and tiers; appears in public catalog with photo; public API exposes no wholesale/manufacturing fields; only verified buyer sees tier prices.
- CMS hero and announcement bar applied on the live homepage; reports + CSV export; suppliers; audit log; all admin views render.
- Mobile 320 / 375 / 430 px: no horizontal overflow in buyer orders, quote wizard and admin drawer; no JS errors.

## Site regression crawl — every page at 1440 / 360 / 320 px
No horizontal overflow, all images decode, all buttons wired, no JS errors; existing forms (contact, samples, wholesale) still save.

## Not testable here
Live Supabase (connector unavailable), real email delivery (needs Resend), Google Analytics (needs ID).
