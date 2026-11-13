# Known issues and limitations

- **Production database not yet migrated.** Migrations 06–08 are tested on a local Postgres 16 with the same RLS/grant model, but they have not been applied to the live Supabase project because the Supabase connection was unavailable. The live site keeps running the previous version until they are applied together with this front end.
- **Emails are queued, not sent,** until a Resend key, verified sender domain and the scheduled `apparel-mailer` function are set up (DEPLOYMENT.md §4). Admin → System shows the queue.
- **Shipment tracking is manual.** Staff enter carrier and tracking number; there is no carrier API integration and the site says so.
- **WhatsApp is click-to-chat only** (wa.me links with a prefilled message). There is no WhatsApp Business API automation.
- **PDF quotations** use the browser's "Print / Save as PDF" on a print-optimised page, not a server-generated PDF file.
- **Currency:** quotations and orders are stored in the currency chosen by staff (USD by default). EUR/GBP shown to verified buyers are approximate display conversions from admin-set rates.
- **Guest quotation requests cannot attach files** (private storage requires an account); guests are pointed to WhatsApp for files.
- **Catalog cache:** visitors' browsers cache the public catalog for up to 5 minutes, so admin catalog edits can take up to 5 minutes to appear for someone already browsing (a new product link always loads fresh).
- **Static product pages** are generated at build time; products created in the admin appear in listings and on `/products/view/?id=…` immediately, and get a static SEO page the next time the site is built.
- **Analytics** are off until a GA4 Measurement ID is provided.
