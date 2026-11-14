// Site content. Every value here is either from the owner's specification
// or descriptive copy. No prices, MOQs, lead times or statistics are invented:
// those are confirmed per quotation.

export const site = {
  brand: 'SIDDIQIYA Apparel',
  short: 'SIDDIQIYA',
  domain: 'https://app.hsdmj.com',
  whatsapp: '855967335609',
  whatsappDisplay: '+855 96 733 5609',
  address: 'Phnom Penh, Cambodia 120101',
  tagline: 'Premium T-Shirt Design, Custom Manufacturing and Global Apparel Solutions.',
  parent: 'SIDDIQIYA Technology',
  // Google Analytics 4 Measurement ID (e.g. 'G-XXXXXXXXXX'). Empty = no analytics script is loaded.
  gaId: process.env.GA_MEASUREMENT_ID || '',
};

export const colors = {
  black: { name: 'Black', hex: '#1c1c1c' },
  white: { name: 'Optic White', hex: '#f5f3ef' },
  bone: { name: 'Bone', hex: '#e7dfd0' },
  sand: { name: 'Sand', hex: '#cdb898' },
  stone: { name: 'Stone', hex: '#a69d8f' },
  charcoal: { name: 'Charcoal', hex: '#3b3b3b' },
  heather: { name: 'Heather Grey', hex: '#b7b5b0' },
  navy: { name: 'Navy', hex: '#1f2a3b' },
  olive: { name: 'Olive', hex: '#5b5a40' },
  sage: { name: 'Sage', hex: '#9ba390' },
  brick: { name: 'Brick', hex: '#8b4a3b' },
  forest: { name: 'Forest', hex: '#2f4035' },
  cobalt: { name: 'Cobalt', hex: '#2e4a86' },
  washed: { name: 'Washed Black', hex: '#45423e' },
  clay: { name: 'Clay', hex: '#b58a6c' },
};

export const sizesStd = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];
export const sizesExt = ['S', 'M', 'L', 'XL', 'XXL', '3XL'];

export const fabrics = [
  { slug: '100-cotton', name: '100% Cotton', composition: '100% cotton single jersey', gsm: [140, 160, 180, 200], texture: 'jersey',
    description: 'The everyday foundation. Soft, breathable single jersey with a clean surface that takes print and dye evenly.',
    colors: ['white', 'black', 'heather', 'navy', 'bone', 'olive'], applications: ['Basic T-shirts', 'Promotional runs', 'Retail essentials', 'Screen and DTG printing'],
    care: ['Machine wash cold, inside out', 'Do not bleach', 'Tumble dry low', 'Iron on reverse, avoid print'] },
  { slug: 'combed-cotton', name: 'Combed Cotton', composition: '100% combed ring-spun cotton', gsm: [160, 180, 200, 220], texture: 'jersey-fine',
    description: 'Short fibres combed out and yarn ring-spun for a smoother, stronger knit with a refined hand feel and less pilling.',
    colors: ['white', 'black', 'bone', 'sand', 'navy', 'charcoal'], applications: ['Premium basics', 'Brand essentials', 'Fine-line screen printing'],
    care: ['Machine wash 30°C', 'Wash with similar colours', 'Dry flat or tumble low', 'Warm iron'] },
  { slug: 'organic-cotton', name: 'Organic Cotton', composition: '100% organic cotton (certification on request)', gsm: [160, 180, 200, 240], texture: 'jersey-slub',
    description: 'Cotton grown without synthetic pesticides or fertilisers. Certification documents are shared per order, never assumed.',
    colors: ['bone', 'white', 'sage', 'sand', 'clay', 'black'], applications: ['Sustainable lines', 'Premium retail', 'Baby and family ranges'],
    care: ['Machine wash cold', 'Mild detergent', 'Line dry', 'Cool iron'] },
  { slug: 'cotton-polyester', name: 'Cotton Polyester', composition: 'Cotton / polyester blend (60/40 or 65/35)', gsm: [140, 160, 180], texture: 'jersey-heather',
    description: 'A durable, low-shrink blend that keeps shape through heavy wear and frequent washing. Ideal for uniforms and events.',
    colors: ['heather', 'navy', 'charcoal', 'cobalt', 'white', 'black'], applications: ['Corporate uniforms', 'Event merchandise', 'Workwear'],
    care: ['Machine wash 40°C', 'Tumble dry low', 'Low iron'] },
  { slug: 'french-terry', name: 'French Terry', composition: 'Cotton-rich looped-back knit', gsm: [240, 280, 320], texture: 'terry',
    description: 'Flat face, soft loops on the reverse. Structured and warm without bulk, for heavier tees and layering pieces.',
    colors: ['heather', 'bone', 'black', 'olive', 'stone'], applications: ['Heavyweight tees', 'Streetwear', 'Lounge and layering'],
    care: ['Machine wash cold', 'Do not tumble dry hot', 'Reshape while damp'] },
  { slug: 'pique', name: 'Pique Fabric', composition: 'Cotton or cotton-blend pique knit', gsm: [180, 200, 220, 240], texture: 'pique',
    description: 'A textured honeycomb weave that breathes well and holds a crisp collar. The classic polo fabric.',
    colors: ['white', 'navy', 'black', 'forest', 'brick', 'cobalt'], applications: ['Polo shirts', 'Corporate wear', 'Club and hospitality uniforms'],
    care: ['Machine wash 40°C', 'Button up before washing', 'Iron collar on reverse'] },
  { slug: 'polyester-dry-fit', name: 'Polyester Dry Fit', composition: '100% polyester moisture-wicking knit', gsm: [140, 160, 180], texture: 'mesh',
    description: 'Lightweight performance knit that moves sweat away from the skin and dries quickly. Takes sublimation printing well.',
    colors: ['black', 'white', 'cobalt', 'navy', 'brick', 'charcoal'], applications: ['Sportswear', 'Team kits', 'Running and training', 'Sublimation'],
    care: ['Machine wash cold', 'No fabric softener', 'Line dry', 'Do not iron print'] },
  { slug: 'modal-blend', name: 'Modal Blend', composition: 'Modal / cotton blend', gsm: [140, 160, 180], texture: 'jersey-fine',
    description: 'Fluid drape and a cool, silky hand. Modal keeps colour depth wash after wash, suited to elevated basics.',
    colors: ['black', 'bone', 'charcoal', 'sage', 'navy'], applications: ['Luxury basics', 'Fitted tees', 'Sleep and lounge'],
    care: ['Machine wash cold, gentle', 'Dry flat', 'Cool iron'] },
  { slug: 'heavyweight-cotton', name: 'Heavyweight Cotton', composition: '100% cotton, tightly knit heavy jersey', gsm: [240, 280, 320], texture: 'jersey-heavy',
    description: 'Dense, structured jersey that hangs with weight and holds its silhouette. The base for premium oversized and boxy fits.',
    colors: ['black', 'bone', 'washed', 'stone', 'olive', 'white'], applications: ['Heavyweight tees', 'Oversized fits', 'Streetwear labels'],
    care: ['Machine wash cold, inside out', 'Line dry to limit shrinkage', 'Warm iron on reverse'] },
  { slug: 'fleece', name: 'Fleece', composition: 'Cotton / polyester brushed-back fleece (80/20 or 60/40)', gsm: [280, 320, 360], texture: 'fleece',
    description: 'A smooth face with a soft, brushed reverse that traps warmth. Used for heavier tees, sweatshirts and cold-season programmes.',
    colors: ['heather', 'black', 'navy', 'bone', 'olive'], applications: ['Sweatshirts', 'Heavy long-sleeve tees', 'Cold-season merchandise'],
    care: ['Machine wash cold, inside out', 'Do not tumble dry hot', 'Do not iron print'] },
  { slug: 'rib', name: 'Rib Fabric', composition: 'Cotton / elastane 1×1 or 2×2 rib knit', gsm: [180, 200, 240], texture: 'rib',
    description: 'Vertical ribs that stretch and recover. Used for fitted tees, neck bands, cuffs and hems.',
    colors: ['black', 'white', 'bone', 'charcoal', 'sage'], applications: ['Fitted tees', 'Neck bands and cuffs', 'Layering pieces'],
    care: ['Machine wash cold', 'Dry flat to keep shape', 'Cool iron'] },
];

export const gsmOptions = [140, 160, 180, 200, 220, 240, 280, 320];

// shape: crew | oversized | drop | polo | raglan | heavy ; finish: plain | vintage ; print: none | graphic code
export const categories = [
  { slug: 'basic-t-shirts', name: 'Basic T-Shirts', shape: 'crew', lead: 'Clean crew-neck essentials in breathable cotton, built for everyday wear and large programmes.', fabric: '100-cotton' },
  { slug: 'oversized-t-shirts', name: 'Oversized T-Shirts', shape: 'oversized', lead: 'Generous, relaxed proportions with extended length and wider body for a modern silhouette.', fabric: 'heavyweight-cotton' },
  { slug: 'drop-shoulder-t-shirts', name: 'Drop Shoulder T-Shirts', shape: 'drop', lead: 'Shoulder seams set below the natural line for an easy, slouched drape.', fabric: 'combed-cotton' },
  { slug: 'streetwear-t-shirts', name: 'Streetwear T-Shirts', shape: 'oversized', lead: 'Boxy cuts, heavier hand feel and bold placements for street and youth labels.', fabric: 'heavyweight-cotton' },
  { slug: 'graphic-t-shirts', name: 'Graphic T-Shirts', shape: 'crew', lead: 'Print-ready bodies and in-house graphic development for artwork-led collections.', fabric: 'combed-cotton' },
  { slug: 'polo-t-shirts', name: 'Polo T-Shirts', shape: 'polo', lead: 'Pique and jersey polos with ribbed collars and clean plackets for corporate and retail.', fabric: 'pique' },
  { slug: 'sports-t-shirts', name: 'Sports T-Shirts', shape: 'raglan', lead: 'Moisture-wicking performance tees with raglan sleeves for movement.', fabric: 'polyester-dry-fit' },
  { slug: 'premium-cotton-t-shirts', name: 'Premium Cotton T-Shirts', shape: 'crew', lead: 'Combed, ring-spun cotton with refined finishing for elevated essentials.', fabric: 'combed-cotton' },
  { slug: 'organic-cotton-t-shirts', name: 'Organic Cotton T-Shirts', shape: 'crew', lead: 'Organic cotton bodies for sustainable lines, with certification shared per order.', fabric: 'organic-cotton' },
  { slug: 'vintage-wash-t-shirts', name: 'Vintage Wash T-Shirts', shape: 'drop', lead: 'Garment-washed for a softened hand and lived-in, faded colour.', fabric: 'heavyweight-cotton' },
  { slug: 'heavyweight-t-shirts', name: 'Heavyweight T-Shirts', shape: 'heavy', lead: 'Dense 240–320 GSM jersey that holds shape and hangs with weight.', fabric: 'heavyweight-cotton' },
  { slug: 'custom-printed-t-shirts', name: 'Custom Printed T-Shirts', shape: 'crew', lead: 'Your artwork, logos and labels, produced by screen, DTG or embroidery.', fabric: '100-cotton' },
];

export const collections = [
  { slug: 'essential', name: 'Essential Collection', kicker: 'Everyday foundations', lead: 'Clean lines, honest fabrics and colours that work season after season.', cats: ['basic-t-shirts', 'premium-cotton-t-shirts'], tone: 'bone', shirts: ['white', 'bone', 'black'] },
  { slug: 'oversized', name: 'Oversized Collection', kicker: 'Relaxed proportion', lead: 'Extended length, wide body and dropped shoulders for a contemporary drape.', cats: ['oversized-t-shirts', 'drop-shoulder-t-shirts'], tone: 'stone', shirts: ['sand', 'washed', 'bone'] },
  { slug: 'streetwear', name: 'Streetwear Collection', kicker: 'Built for the street', lead: 'Heavy, boxy and bold — bodies made to carry statement graphics.', cats: ['streetwear-t-shirts', 'vintage-wash-t-shirts'], tone: 'dark', shirts: ['black', 'olive', 'washed'] },
  { slug: 'premium-cotton', name: 'Premium Cotton Collection', kicker: 'Fibre first', lead: 'Combed, organic and heavyweight cottons chosen for hand feel and longevity.', cats: ['premium-cotton-t-shirts', 'organic-cotton-t-shirts', 'heavyweight-t-shirts'], tone: 'beige', shirts: ['bone', 'sage', 'stone'] },
  { slug: 'graphic', name: 'Graphic Collection', kicker: 'Print-led design', lead: 'Artwork-ready bodies and placement options for graphic-driven ranges.', cats: ['graphic-t-shirts', 'custom-printed-t-shirts'], tone: 'bone', shirts: ['white', 'black', 'brick'] },
  { slug: 'polo', name: 'Polo Collection', kicker: 'Collared classics', lead: 'Pique and jersey polos with crisp collars and clean plackets for retail, clubs and corporate programmes.', cats: ['polo-t-shirts'], tone: 'stone', shirts: ['navy', 'white', 'forest'] },
  { slug: 'sportswear', name: 'Sportswear Collection', kicker: 'Performance in motion', lead: 'Dry fit and pique pieces engineered for training, teams and clubs.', cats: ['sports-t-shirts', 'polo-t-shirts'], tone: 'dark', shirts: ['cobalt', 'black', 'white'] },
];

const p = (o) => o;
export const products = [
  p({ name: 'Core Crew Tee', cat: 'basic-t-shirts', fabric: '100-cotton', gsm: 160, fit: 'Regular', colors: ['white', 'black', 'heather', 'navy', 'olive'], sizes: sizesStd, desc: 'A precise everyday crew neck in breathable single jersey. Taped neck seam, twin-needle hems and a clean regular fit.' }),
  p({ name: 'Everyday Crew Tee', cat: 'basic-t-shirts', fabric: '100-cotton', gsm: 180, fit: 'Regular', colors: ['bone', 'black', 'heather', 'sand'], sizes: sizesStd, desc: 'A slightly heavier everyday tee with a soft hand and a durable 1×1 ribbed collar.' }),
  p({ name: 'Box Oversized Tee', cat: 'oversized-t-shirts', fabric: 'heavyweight-cotton', gsm: 240, fit: 'Oversized', colors: ['sand', 'black', 'bone', 'washed'], sizes: sizesExt, desc: 'Extended length, wide body and a thick ribbed neck. The definitive oversized silhouette.', print: 'atelier' }),
  p({ name: 'Studio Oversized Tee', cat: 'oversized-t-shirts', fabric: 'french-terry', gsm: 280, fit: 'Oversized', colors: ['heather', 'olive', 'bone'], sizes: sizesExt, desc: 'French terry body with a matte face and structured drape for elevated oversized programmes.', print: 'topography' }),
  p({ name: 'Drop Shoulder Tee', cat: 'drop-shoulder-t-shirts', fabric: 'combed-cotton', gsm: 200, fit: 'Relaxed', colors: ['stone', 'black', 'white', 'sage'], sizes: sizesStd, desc: 'A relaxed body with lowered shoulder seams and a slightly cropped sleeve for an easy drape.', print: 'crest' }),
  p({ name: 'Lounge Drop Tee', cat: 'drop-shoulder-t-shirts', fabric: 'modal-blend', gsm: 180, fit: 'Relaxed', colors: ['charcoal', 'bone', 'sage'], sizes: sizesStd, desc: 'Modal-cotton drop shoulder with fluid drape and a cool, silky hand.' }),
  p({ name: 'Street Heavy Tee', cat: 'streetwear-t-shirts', fabric: 'heavyweight-cotton', gsm: 280, fit: 'Boxy', colors: ['black', 'olive', 'clay'], sizes: sizesExt, desc: 'Boxy, heavy and built for large back prints. Wide neck rib and dropped shoulders.', print: 'back-type' }),
  p({ name: 'Block Street Tee', cat: 'streetwear-t-shirts', fabric: 'heavyweight-cotton', gsm: 240, fit: 'Boxy', colors: ['bone', 'washed', 'brick'], sizes: sizesExt, desc: 'A cropped boxy body with a bold chest placement. Designed for youth and street labels.', print: 'technical' }),
  p({ name: 'Horizon Graphic Tee', cat: 'graphic-t-shirts', fabric: 'combed-cotton', gsm: 180, fit: 'Regular', colors: ['white', 'bone', 'black'], sizes: sizesStd, desc: 'A print-ready combed cotton body shown with a horizon line artwork in water-based ink.', print: 'horizon' }),
  p({ name: 'Arc Graphic Tee', cat: 'graphic-t-shirts', fabric: 'combed-cotton', gsm: 200, fit: 'Relaxed', colors: ['black', 'navy', 'sand'], sizes: sizesStd, desc: 'Relaxed graphic tee with a large arc composition across the chest.', print: 'arc' }),
  p({ name: 'Classic Pique Polo', cat: 'polo-t-shirts', fabric: 'pique', gsm: 220, fit: 'Regular', colors: ['navy', 'white', 'black', 'forest'], sizes: sizesStd, desc: 'Cotton pique polo with a ribbed collar, two-button placket and side vents.' }),
  p({ name: 'Club Jersey Polo', cat: 'polo-t-shirts', fabric: 'cotton-polyester', gsm: 180, fit: 'Regular', colors: ['heather', 'cobalt', 'brick'], sizes: sizesStd, desc: 'A soft jersey polo for hospitality, retail and corporate uniform programmes.' }),
  p({ name: 'Pace Training Tee', cat: 'sports-t-shirts', fabric: 'polyester-dry-fit', gsm: 140, fit: 'Athletic', colors: ['black', 'cobalt', 'white'], sizes: sizesStd, desc: 'Lightweight moisture-wicking knit with raglan sleeves for full range of motion.' }),
  p({ name: 'Team Raglan Tee', cat: 'sports-t-shirts', fabric: 'polyester-dry-fit', gsm: 160, fit: 'Regular', colors: ['navy', 'brick', 'charcoal'], sizes: sizesExt, desc: 'Team-ready dry fit raglan, suited to sublimated numbers, crests and sponsor placements.' }),
  p({ name: 'Supima-Style Combed Tee', cat: 'premium-cotton-t-shirts', fabric: 'combed-cotton', gsm: 180, fit: 'Tailored', colors: ['white', 'black', 'navy', 'bone'], sizes: sizesStd, desc: 'A tailored premium essential in combed ring-spun cotton with a refined, smooth face.' }),
  p({ name: 'Atelier Crew Tee', cat: 'premium-cotton-t-shirts', fabric: 'combed-cotton', gsm: 220, fit: 'Regular', colors: ['stone', 'charcoal', 'bone'], sizes: sizesStd, desc: 'Mid-weight combed cotton with a bound neck and clean finishing inside and out.' }),
  p({ name: 'Organic Crew Tee', cat: 'organic-cotton-t-shirts', fabric: 'organic-cotton', gsm: 180, fit: 'Regular', colors: ['bone', 'sage', 'clay', 'white'], sizes: sizesStd, desc: 'Organic cotton essential with a natural slub texture. Certification shared per order.' }),
  p({ name: 'Organic Heavy Tee', cat: 'organic-cotton-t-shirts', fabric: 'organic-cotton', gsm: 240, fit: 'Relaxed', colors: ['sand', 'black', 'sage'], sizes: sizesStd, desc: 'A relaxed heavier organic tee with a substantial hand feel.' }),
  p({ name: 'Faded Vintage Tee', cat: 'vintage-wash-t-shirts', fabric: 'heavyweight-cotton', gsm: 240, fit: 'Relaxed', colors: ['washed', 'olive', 'brick'], sizes: sizesExt, desc: 'Garment-washed after sewing for a softened hand and a faded, lived-in colour.', finish: 'vintage' }),
  p({ name: 'Sun Wash Tee', cat: 'vintage-wash-t-shirts', fabric: '100-cotton', gsm: 200, fit: 'Regular', colors: ['clay', 'sage', 'stone'], sizes: sizesStd, desc: 'Sun-washed colour with a gentle enzyme finish and a broken-in feel from the first wear.', finish: 'vintage' }),
  p({ name: 'Heavyweight 280 Tee', cat: 'heavyweight-t-shirts', fabric: 'heavyweight-cotton', gsm: 280, fit: 'Boxy', colors: ['black', 'bone', 'stone', 'white'], sizes: sizesExt, desc: 'Dense 280 GSM jersey with a thick neck rib. Holds its shape and hangs with weight.', print: 'atelier' }),
  p({ name: 'Heavyweight 320 Tee', cat: 'heavyweight-t-shirts', fabric: 'heavyweight-cotton', gsm: 320, fit: 'Boxy', colors: ['washed', 'olive', 'bone'], sizes: sizesExt, desc: 'Our heaviest jersey. Structured, durable and made for premium streetwear labels.', print: 'topography' }),
  p({ name: 'Logo Print Tee', cat: 'custom-printed-t-shirts', fabric: '100-cotton', gsm: 180, fit: 'Regular', colors: ['white', 'black', 'navy', 'heather'], sizes: sizesStd, desc: 'A blank built for your logo — screen printed, DTG or embroidered at the placement you choose.', print: 'logo' }),
  p({ name: 'Brand Merch Tee', cat: 'custom-printed-t-shirts', fabric: 'combed-cotton', gsm: 200, fit: 'Relaxed', colors: ['bone', 'black', 'forest'], sizes: sizesStd, desc: 'Relaxed merch body for events, launches and brand programmes, with front and back placements.', print: 'merch' }),
].map((x, i) => ({
  ...x,
  id: `PRD-${String(i + 1).padStart(4, '0')}`,
  // Same rule as the database backfill (migration 06): SA-<first 3 letters of category>-<number>.
  sku: `SA-${x.cat.replace(/-t-shirts$/, '').slice(0, 3).toUpperCase()}-${String(i + 1).padStart(4, '0')}`,
  slug: x.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''),
}));

export const services = [
  { slug: 'custom-neck-labels', name: 'Custom Neck Labels', group: 'Branding', text: 'Printed or woven neck labels with your brand, size and care information, positioned to your spec.' },
  { slug: 'woven-labels', name: 'Woven Labels', group: 'Branding', text: 'Damask and satin woven labels with fine detail, folded or flat, sewn at neck, hem or side seam.' },
  { slug: 'printed-labels', name: 'Printed Labels', group: 'Branding', text: 'Tagless heat-transfer and printed satin labels for comfort and a clean interior finish.' },
  { slug: 'hang-tags', name: 'Hang Tags', group: 'Branding', text: 'Branded hang tags in a range of boards and finishes, with barcode and pricing fields if required.' },
  { slug: 'custom-packaging', name: 'Custom Packaging', group: 'Branding', text: 'Branded polybags, tissue, stickers and boxes, packed and folded to your retail standard.' },
  { slug: 'logo-embroidery', name: 'Logo Embroidery', group: 'Decoration', text: 'Flat and 3D puff embroidery for logos and marks, digitised and sampled before bulk.' },
  { slug: 'screen-printing', name: 'Screen Printing', group: 'Decoration', text: 'Plastisol and water-based screen printing for sharp, durable prints on bulk orders.' },
  { slug: 'digital-printing', name: 'Digital Printing', group: 'Decoration', text: 'DTG and DTF printing for full-colour artwork, photographic detail and smaller runs.' },
  { slug: 'custom-color-production', name: 'Custom Color Production', group: 'Development', text: 'Fabric dyed to your Pantone or physical standard, with lab dips approved before production.' },
  { slug: 'custom-pattern-development', name: 'Custom Pattern Development', group: 'Development', text: 'New fits and grading developed from your tech pack, reference garment or measurements.' },
  { slug: 'private-label-production', name: 'Private Label Production', group: 'Manufacturing', text: 'Our proven bodies, finished entirely under your brand — labels, tags and packaging included.' },
  { slug: 'oem-manufacturing', name: 'OEM Manufacturing', group: 'Manufacturing', text: 'We manufacture to your complete design and specifications, from tech pack to packed cartons.' },
  { slug: 'odm-manufacturing', name: 'ODM Manufacturing', group: 'Manufacturing', text: 'We design and develop the product with you, then manufacture it for your brand.' },
];

export const howItWorks = [
  ['Submit requirements', 'Send your styles, fabrics, quantities and artwork through a quotation request.'],
  ['Receive quotation', 'Our sales team replies with pricing, MOQ, lead time and shipping terms.'],
  ['Approve sample', 'A pre-production sample is made to your specification for approval.'],
  ['Confirm production', 'Purchase order and payment terms are agreed and production is scheduled.'],
  ['Quality inspection', 'Goods are inspected against the approved sample before packing.'],
  ['International shipping', 'Orders are packed, documented and shipped on the agreed Incoterms.'],
];

export const productionSteps = [
  ['Design & requirement', 'We confirm the style, artwork, quantities, sizes and target delivery with you in writing.'],
  ['Fabric selection', 'Composition, GSM and colour are agreed; swatches or lab dips are shared for approval.'],
  ['Sampling', 'Patterns are developed and a sample is made and approved before bulk production.'],
  ['Cutting', 'Lays are planned and cut by size and colour breakdown.'],
  ['Sewing & stitching', 'Panels are assembled with consistent stitch density and seam finishing.'],
  ['Printing & embroidery', 'Decoration is applied to the approved placements, colours and techniques.'],
  ['Quality inspection', 'Measurements, workmanship and decoration are checked against the approved sample.'],
  ['Packaging', 'Garments are folded, labelled and packed to your standard.'],
  ['Shipment preparation', 'Cartons, packing list and commercial documents are prepared for dispatch.'],
];
