# Known issues and limitations

- **No model or factory photography yet.** Product, collection and hero images are studio renders of the garments (front, back, collar detail, fabric macro). They are not photographs of models or of the factory. Upload real photography through Admin → Website content (hero photo, production gallery) and Admin → Products (product photos); the production gallery and testimonials sections stay hidden until genuine content is saved.
- **Testimonials, client logos and certifications** are not shown because none have been supplied. Add genuine testimonials (with the buyer's permission) in Admin → Website content.
- **Emails are queued, not sent,** until a Resend key, verified sender domain and the scheduled `apparel-mailer` function are set up (DEPLOYMENT.md §4). Admin → System shows the queue.
- **Shipment tracking is manual.** Staff enter carrier and tracking number; there is no carrier API integration and the site says so.
- **WhatsApp is click-to-chat only** (wa.me links with a prefilled message). There is no WhatsApp Business API automation.
- **PDF quotations** use the browser's "Print / Save as PDF" on a print-optimised page, not a server-generated PDF file.
- **Currency:** quotations and orders are stored in the currency chosen by staff (USD by default). EUR/GBP shown to verified buyers are approximate display conversions from admin-set rates.
- **Guest quotation requests cannot attach files** (private storage requires an account); guests are pointed to WhatsApp for files.
- **Catalog cache:** visitors' browsers cache the public catalog for up to 5 minutes, so admin catalog edits can take up to 5 minutes to appear for someone already browsing (a new product link always loads fresh).
- **Static product pages** are generated at build time; products created in the admin appear in listings and on `/products/view/?id=…` immediately, and get a static SEO page the next time the site is built.
- **Analytics** are off until a GA4 Measurement ID is provided.
- **Product imagery is rendered, not photographed.** Every product, fabric and collection image is a
  procedural photographic-style render of the actual product design (see `tools/render/`). No AI image
  generator or photo source was available, so there is **no human-model photography**. Real campaign
  photos (your own shoot or licensed images) can be uploaded in Admin → Website content → Homepage hero,
  and product photos per product in Admin → Products; uploaded photos take precedence on the live site.
- Products created later in the admin without uploaded photos fall back to simple illustrated mock-ups
  until photos are uploaded or the renderer is re-run for them.
