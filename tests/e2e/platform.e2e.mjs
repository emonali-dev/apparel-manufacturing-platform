// End-to-end platform test: buyer + staff flows in a real browser against the local database.
import { chromium } from 'playwright';
import { install, createUser, sql, log } from './emulator.mjs';

const BASE = 'http://localhost:8765';
const OUT = process.env.OUT || './test-results/';
import fs from 'node:fs';
fs.mkdirSync(OUT, { recursive: true });
const stamp = Date.now().toString(36);
const users = {
  super: `super.${stamp}@test.dev`, sales: `sales.${stamp}@test.dev`, qc: `qc.${stamp}@test.dev`, ship: `ship.${stamp}@test.dev`, buyer: `buyer.${stamp}@test.dev`,
};
const PW = 'Passw0rd!x';
for (const [k, r] of [['super', 'super_admin'], ['sales', 'sales_rep'], ['qc', 'qc_manager'], ['ship', 'shipping_manager']]) {
  const id = createUser(users[k], PW);
  sql(`insert into public.apparel_admins (user_id, role) values ('${id}', '${r}')`);
}

const results = [];
const ok = (name, cond, extra) => { results.push([cond ? 'PASS' : 'FAIL', name, extra || '']); console.log(cond ? 'PASS' : 'FAIL', name, extra || ''); };
const browser = await chromium.launch();

async function ctx(viewport = { width: 1440, height: 900 }) {
  const c = await browser.newContext({ viewport, acceptDownloads: true });
  const page = await c.newPage();
  await install(page);
  page.errors = [];
  page.on('pageerror', (e) => page.errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource.*(404|400|403|ERR_TUNNEL)/.test(m.text())) page.errors.push(m.text()); });
  page.on('dialog', async (d) => { page.lastDialog = d.message(); if (d.type() === 'prompt') await d.accept(page.promptAnswer || 'Please reduce the unit price by 5%'); else await d.accept(); });
  return page;
}
async function login(page, email, path = '/admin/') {
  await page.goto(BASE + path);
  if (path === '/admin/') {
    await page.fill('#a-email', email); await page.fill('#a-pass', PW);
    await page.click('[data-admin-login] button[type=submit]');
    await page.waitForSelector('.admin-nav');
  } else {
    await page.fill('#f-email', email); await page.fill('#f-password', PW);
    await page.click('[data-login] button[type=submit]');
    await page.waitForSelector('.portal-nav');
  }
}
const toast = async (page) => (await page.locator('.toast').last().textContent().catch(() => '')) || '';

try {
  /* ---------- Buyer registers ---------- */
  const b = await ctx();
  await b.goto(BASE + '/account/register/');
  await b.fill('#f-email', users.buyer);
  await b.fill('#f-password', PW); await b.fill('#f-confirm-password', PW);
  await b.fill('#f-contact-person', 'Alex Buyer'); await b.fill('#f-company', 'Northwind ' + stamp);
  await b.fill('#f-phone', '+44 20 7946 0000'); await b.selectOption('#f-country', 'United Kingdom');
  await b.selectOption('#f-business-type', 'Retailer'); await b.check('[name=terms]');
  await b.click('[data-register] button[type=submit]');
  await b.waitForURL('**/account/?welcome=1');
  await b.waitForSelector('.portal-nav');
  ok('buyer registration → portal', (await b.locator('[data-portal-title]').textContent()).includes('Alex'));

  /* ---------- 4-step quote ---------- */
  await b.evaluate(() => localStorage.setItem('sa_quote', JSON.stringify([{ id: 'PRD-0001', color: 'black', sizes: {} }, { id: 'PRD-0003', color: 'sand', sizes: {} }])));
  await b.goto(BASE + '/quote/');
  await b.waitForFunction(() => document.querySelector('[name="Contact person"]').value === 'Alex Buyer');
  ok('quote step 1 prefilled from profile', true);
  await b.click('[data-next]');
  await b.waitForSelector('[data-step="2"]:not([hidden])');
  const sizeInputs = b.locator('[data-step="2"] [data-s="M"]');
  await sizeInputs.nth(0).fill('300'); await sizeInputs.nth(1).fill('200');
  await b.locator('[data-step="2"] [data-s="L"]').nth(0).fill('250');
  await b.click('[data-next]');
  await b.waitForSelector('[data-step="3"]:not([hidden])');
  await b.click('[data-next]');
  ok('quote step 3 requires order type', !(await b.isHidden('[data-step="3"]')) && (await b.getAttribute('[name="Order type"]', 'aria-invalid')) === 'true');
  await b.selectOption('[name="Order type"]', 'Bulk order');
  await b.fill('[name="Destination"]', 'London, UK');
  const future = new Date(Date.now() + 60 * 864e5).toISOString().slice(0, 10);
  await b.fill('[name="Target date"]', future);
  await b.selectOption('[name="Printing"]', 'Screen printing');
  await b.fill('[name="Customization"]', 'Woven neck label, polybag with barcode');
  await b.click('[data-next]');
  await b.waitForSelector('[data-step="4"]:not([hidden])');
  await b.setInputFiles('[data-files]', ['tests/e2e/fixtures/logo.png', 'tests/e2e/fixtures/doc.pdf']);
  await b.waitForFunction(() => document.querySelectorAll('[data-file-list] li').length === 2);
  // A fake PNG (wrong signature) must be rejected client-side.
  fs.writeFileSync('' + OUT + 'bad.png', 'not really a png');
  await b.setInputFiles('[data-files]', ['' + OUT + 'bad.png']);
  await b.waitForFunction(() => document.querySelectorAll('[data-file-list] li').length === 3);
  ok('invalid file flagged', (await b.locator('[data-file-list] li').nth(2).textContent()).includes('does not look like'));
  await b.locator('[data-rm-file="2"]').click();
  await b.screenshot({ path: OUT + 'quote-step4.png', fullPage: true });
  await b.click('[data-include-quote] button[type=submit]');
  await b.waitForSelector('.form-done', { timeout: 15000 });
  const rfqCode = (await b.locator('.form-done-code b').textContent()).trim();
  ok('RFQ submitted with files', /^RFQ-/.test(rfqCode), rfqCode);
  const nfiles = sql(`select count(*) from apparel_files f join apparel_rfqs r on r.id = f.entity_id and f.entity = 'rfq' where r.code = '${rfqCode}'`).out;
  ok('2 files attached to RFQ in DB', nfiles === '2', nfiles);
  const outbox = sql(`select string_agg(template, ',') from apparel_email_outbox where data ->> 'code' = '${rfqCode}'`).out;
  ok('confirmation + admin emails queued', /rfq_received/.test(outbox) && /rfq_admin/.test(outbox), outbox);

  // Duplicate prevention: same payload again within 10 minutes.
  const dup = await b.evaluate(async () => { try { await window.SB.rpc('apparel_submit_rfq', { p: { items: [{ product_id: 'PRD-0001', color: 'black', sizes: { M: 1 } }], requirements: 'dup' } }); await window.SB.rpc('apparel_submit_rfq', { p: { items: [{ product_id: 'PRD-0001', color: 'black', sizes: { M: 1 } }], requirements: 'dup' } }); return 'no error'; } catch (e) { return e.code; } });
  ok('duplicate RFQ blocked', dup === 'DUPLICATE_REQUEST', dup);

  /* ---------- Admin prepares and sends quotation ---------- */
  const a = await ctx();
  await login(a, users.super);
  ok('super admin sees all modules', (await a.locator('.admin-nav nav a').count()) === 17, String(await a.locator('.admin-nav nav a').count()));
  await a.screenshot({ path: OUT + 'admin-overview.png', fullPage: true });
  await a.goto(BASE + '/admin/#rfqs'); await a.waitForSelector('.admin-table');
  await a.locator('.row-link', { hasText: rfqCode }).click();
  await a.waitForSelector('.drawer-card');
  ok('RFQ drawer shows buyer files', (await a.locator('.drawer-card .doc-list li').count()) === 2);
  const [dl] = await Promise.all([a.waitForEvent('download'), a.locator('.drawer-card [data-file]').first().click()]);
  ok('admin downloads buyer artwork', (await dl.path()) && fs.statSync(await dl.path()).size > 10);
  await a.click('[data-q-new]');
  await a.waitForSelector('[data-quote-form]');
  const prices = a.locator('[data-line] [name=p]');
  await prices.nth(0).fill('4.80'); await prices.nth(1).fill('7.25');
  await a.locator('[data-line] [name=t]').nth(0).fill('1000:4.50, 3000:4.20');
  await a.fill('#e-shipping_cost', '350'); await a.fill('#e-tax_percent', '0'); await a.fill('#e-lead_time', '35 days after sample approval');
  await a.screenshot({ path: OUT + 'admin-quote-editor.png', fullPage: false });
  await a.click('[data-act="save"]');
  await a.waitForSelector('[data-quote-form]', { state: 'detached' });
  await a.locator('.row-link', { hasText: rfqCode }).click();
  await a.waitForSelector('[data-q-send]');
  await a.click('[data-q-send]');
  await a.waitForSelector('.drawer-card', { state: 'detached' }).catch(() => {});
  await a.waitForTimeout(500);
  const q = JSON.parse(sql(`select row_to_json(q) from apparel_quotes q join apparel_rfqs r on r.id = q.rfq_id where r.code = '${rfqCode}'`).out);
  // 550*4.80 + 200*7.25 + 350 = 2640 + 1450 + 350 = 4440
  ok('quote saved, sent, totals computed by server', q.status === 'sent' && Number(q.total) === 4440, q.status + ' ' + q.total);
  ok('RFQ status → quotation_sent', sql(`select status from apparel_rfqs where code = '${rfqCode}'`).out === 'quotation_sent');

  /* ---------- Buyer negotiates, admin revises, buyer accepts ---------- */
  await b.goto(BASE + '/account/?tab=quotations');
  await b.waitForSelector('[data-q-act="accept"]');
  await b.screenshot({ path: OUT + 'buyer-quote.png', fullPage: true });
  await b.click('[data-q-act="negotiate"]');
  await b.waitForFunction(() => /Your response: Please reduce/.test(document.querySelector('.portal-main').textContent));
  ok('buyer negotiation recorded', sql(`select status from apparel_rfqs where code = '${rfqCode}'`).out === 'negotiation');
  // Revision 2
  await a.goto(BASE + '/admin/#rfqs'); await a.reload(); await a.waitForSelector('.admin-table');
  await a.locator('.row-link', { hasText: rfqCode }).click();
  await a.click('[data-q-new]');
  await a.waitForSelector('[data-quote-form]');
  await a.locator('[data-line] [name=p]').nth(0).fill('4.56');
  await a.click('[data-act="send"]');
  await a.waitForSelector('[data-quote-form]', { state: 'detached' });
  const revs = sql(`select string_agg(revision || ':' || q.status, ',' order by revision) from apparel_quotes q join apparel_rfqs r on r.id = q.rfq_id where r.code = '${rfqCode}'`).out;
  ok('revision 2 sent, revision 1 superseded', revs === '1:superseded,2:sent', revs);
  await b.reload(); await b.waitForSelector('[data-q-act="accept"]');
  await b.click('[data-q-act="accept"]');
  await b.waitForFunction(() => !document.querySelector('[data-q-act]'));
  ok('buyer accepted → approved', sql(`select status from apparel_rfqs where code = '${rfqCode}'`).out === 'approved');

  // Printable quotation
  const qid = sql(`select q.id from apparel_quotes q join apparel_rfqs r on r.id = q.rfq_id where r.code = '${rfqCode}' and revision = 2`).out;
  await b.goto(BASE + '/quotation/?id=' + qid);
  await b.waitForSelector('.quote-doc');
  ok('printable quotation renders', (await b.locator('.quote-doc .total').textContent()).includes('4,308.00'), (await b.locator('.quote-doc .total').textContent()));
  await b.screenshot({ path: OUT + 'quotation-doc.png', fullPage: true });
  await b.emulateMedia({ media: 'print' });
  await b.pdf ? null : null;
  await b.emulateMedia({ media: 'screen' });

  /* ---------- Order, production, QC, shipping ---------- */
  await a.goto(BASE + '/admin/#rfqs'); await a.reload(); await a.waitForSelector('.admin-table');
  await a.locator('.row-link', { hasText: rfqCode }).click();
  await a.click('[data-q-order]');
  await a.waitForFunction(() => location.hash === '#orders');
  await a.waitForSelector('.admin-table');
  const orderCode = sql(`select o.code from apparel_orders o join apparel_rfqs r on r.id = o.rfq_id where r.code = '${rfqCode}'`).out;
  ok('order created from quote', /^ORD-/.test(orderCode), orderCode);
  await a.locator('.row-link', { hasText: orderCode }).click();
  await a.waitForSelector('[data-detail]');
  await a.selectOption('[data-detail] [name=status]', 'sample_development');
  await a.selectOption('[data-detail] [name=payment_status]', 'deposit_received');
  await a.fill('[data-detail] [name=payment_info]', 'Deposit USD 1,292 received by bank transfer');
  await a.fill('[data-detail] [name=message]', 'Deposit received — sample development has started.');
  await a.click('[data-detail] button[type=submit]');
  await a.waitForSelector('.drawer-card', { state: 'detached' });
  await a.locator('.row-link', { hasText: orderCode }).click();
  await a.waitForSelector('[data-upload]');
  await a.selectOption('[data-upload] [name=kind]', 'commercial_invoice');
  await a.setInputFiles('[data-upload] [name=file]', 'tests/e2e/fixtures/doc.pdf');
  await a.check('[data-upload] [name=visible]');
  await a.click('[data-upload] button[type=submit]');
  await a.waitForFunction(() => document.querySelectorAll('.drawer-card .doc-list li').length === 1);
  ok('order document uploaded + shared', sql(`select visible_to_buyer from apparel_files where entity = 'order' order by id desc limit 1`).out === 't');
  await a.click('[data-mk-prod]');
  await a.waitForSelector('[data-prod-form]');
  await a.fill('[data-prod-form] [name=expected_completion]', future);
  await a.fill('[data-prod-form] [name=assigned_team]', 'Line 3');
  await a.click('[data-prod-form] button[type=submit]');
  await a.waitForFunction(() => location.hash === '#production');
  await a.waitForSelector('.admin-table');
  await a.locator('.admin-table tr', { hasText: orderCode }).locator('.row-link').click();
  await a.waitForSelector('[data-stage]');
  await a.selectOption('[data-stage="order_confirmation"]', 'done');
  await a.waitForFunction(() => document.querySelector('[data-stage="order_confirmation"]') && document.querySelector('[data-stage="order_confirmation"]').value === 'done' && /Done/.test(document.querySelector('.stage-list li').textContent));
  await a.selectOption('[data-stage="cutting"]', 'in_progress');
  await a.waitForTimeout(800);
  const stages = sql(`select string_agg(stage || '=' || st.status, ',' order by position) from apparel_production_stages st join apparel_production p on p.id = st.production_id join apparel_orders o on o.id = p.order_id where o.code = '${orderCode}' and st.status <> 'pending'`).out;
  ok('production stages updated', stages === 'order_confirmation=done,cutting=in_progress', stages);
  await a.waitForSelector('[data-qc-form]');
  await a.selectOption('[data-qc-form] [name=chk_stitching]', 'fail');
  await a.fill('[data-qc-form] [name=inspector]', 'Sokha');
  await a.fill('[data-qc-form] [name=sample_size]', '80'); await a.fill('[data-qc-form] [name=defects_found]', '3');
  await a.fill('[data-qc-form] [name=defects]', '3 pcs uneven hem');
  await a.selectOption('[data-qc-form] [name=result]', 'fail');
  await a.click('[data-qc-form] button[type=submit]');
  await a.waitForFunction(() => document.querySelectorAll('.drawer-card .quote-card').length === 1);
  await a.setInputFiles('.quote-card [data-upload] [name=file]', 'tests/e2e/fixtures/logo.png');
  await a.click('.quote-card [data-upload] button[type=submit]');
  await a.waitForFunction(() => document.querySelectorAll('.quote-card .doc-list li').length === 1);
  ok('QC inspection + photo saved', sql(`select result || ':' || defects_found from apparel_qc order by id desc limit 1`).out === 'fail:3');
  await a.screenshot({ path: OUT + 'admin-production.png', fullPage: false });

  // Shipping manager adds the shipment
  const s = await ctx();
  await login(s, users.ship);
  const shipNav = await s.locator('.admin-nav nav a').allTextContents();
  ok('shipping manager limited nav', !shipNav.some((t) => /Products|Users|CRM|Production/.test(t)) && shipNav.some((t) => /Shipping/.test(t)), shipNav.join('|'));
  await s.goto(BASE + '/admin/#orders'); await s.waitForSelector('.admin-table');
  await s.locator('.row-link', { hasText: orderCode }).click();
  await s.click('[data-mk-ship]');
  await s.waitForSelector('[data-ship-form]');
  await s.selectOption('[data-ship-form] [name=method]', 'air_freight');
  await s.fill('[data-ship-form] [name=provider]', 'DHL Global Forwarding');
  await s.fill('[data-ship-form] [name=tracking_number]', '1234567890');
  await s.selectOption('[data-ship-form] [name=status]', 'dispatched');
  await s.click('[data-ship-form] button[type=submit]');
  await s.waitForFunction(() => location.hash === '#shipping');
  await s.waitForSelector('.admin-table');
  ok('shipment saved', sql(`select tracking_number from apparel_shipments order by id desc limit 1`).out === '1234567890');
  const denied = await s.evaluate(async () => { try { await window.SB.rpc('apparel_admin_save_product', { p: { name: 'x' } }); return 'allowed'; } catch (e) { return e.code; } });
  ok('shipping manager cannot edit products (DB)', denied === 'NOT_AUTHORIZED', denied);

  /* ---------- Buyer sees order, docs, messages ---------- */
  await b.goto(BASE + '/account/?tab=orders');
  await b.waitForSelector('.order-steps');
  const ordTxt = await b.locator('.portal-main').textContent();
  ok('buyer order tracking shows production + shipment', ordTxt.includes(orderCode) && ordTxt.includes('1234567890') && ordTxt.includes('Cutting'));
  ok('buyer does not see admin note / shipment cost', !ordTxt.includes('admin_note'));
  await b.screenshot({ path: OUT + 'buyer-orders.png', fullPage: true });
  await b.goto(BASE + '/account/?tab=documents');
  await b.waitForSelector('.doc-list');
  const [d2] = await Promise.all([b.waitForEvent('download'), b.locator('[data-file]', { hasText: 'doc.pdf' }).first().click()]);
  ok('buyer downloads shared invoice', fs.statSync(await d2.path()).size > 10);
  // QC photo is not shared with the buyer — direct download must fail.
  const qcPath = sql(`select path from apparel_files where entity = 'qc' order by id desc limit 1`).out;
  const qcRes = await b.evaluate(async (p) => { try { await window.SB.download('apparel-files', p); return 'downloaded'; } catch (e) { return 'blocked'; } }, qcPath);
  ok('buyer cannot download internal QC photo', qcRes === 'blocked', qcRes);
  await b.goto(BASE + '/account/?tab=messages');
  await b.fill('#m-body', 'Could you share the sample photos when ready?');
  await b.click('[data-msg] button[type=submit]');
  await b.waitForSelector('.msg--me');
  ok('buyer message sent', true);

  // Sales rep replies via buyers screen
  const r = await ctx();
  await login(r, users.sales);
  const salesNav = await r.locator('.admin-nav nav a').allTextContents();
  ok('sales rep nav excludes production/products/users', !salesNav.some((t) => /Production|Products|Users|Reports/.test(t)), salesNav.join('|'));
  await r.goto(BASE + '/admin/#buyers'); await r.waitForSelector('.admin-table');
  await r.locator('.row-link', { hasText: 'Northwind ' + stamp }).click();
  await r.waitForSelector('[data-msg]');
  await r.fill('[data-msg] textarea', 'Yes — photos will be uploaded to your order documents this week.');
  await r.click('[data-msg] button[type=submit]');
  await r.waitForFunction(() => document.querySelectorAll('.drawer-card .msg').length === 2);
  ok('staff reply in thread', true);
  // CRM lead exists, linked
  await r.goto(BASE + '/admin/#crm'); await r.waitForSelector('.admin-table');
  const crmTxt = await r.locator('.admin-table tr', { hasText: 'Northwind ' + stamp }).textContent();
  ok('CRM lead auto-created and linked', crmTxt.includes('Northwind ' + stamp) && /\d RFQ · 1 orders/.test(crmTxt), crmTxt.slice(0, 200));
  await r.locator('.admin-table tr', { hasText: 'Northwind ' + stamp }).locator('.row-link').click();
  await r.waitForSelector('[data-act-form]');
  await r.fill('[data-act-form] textarea', 'Called buyer, confirmed sample timeline.');
  await r.click('[data-act-form] button[type=submit]');
  await r.waitForFunction(() => /Called buyer/.test(document.querySelector('.drawer-card').textContent));
  ok('CRM activity logged', true);

  /* ---------- Catalog: product with photo, content ---------- */
  await a.goto(BASE + '/admin/#products'); await a.reload(); await a.waitForSelector('.admin-table');
  await a.click('[data-new]');
  await a.waitForSelector('[data-edit-form]');
  await a.fill('#e-name', 'Club Pique Polo ' + stamp);
  await a.selectOption('#e-category', 'polo-t-shirts');
  await a.selectOption('#e-collection', 'polo');
  await a.fill('#e-gsm', '220');
  await a.locator('[name=colors][value=navy] + span').click();
  await a.locator('[name=colors][value=white] + span').click();
  await a.setInputFiles('[data-media-input]', 'tests/e2e/fixtures/logo.png');
  await a.waitForSelector('[data-media] li');
  await a.fill('#e-wholesale_price', '6.40'); await a.fill('#e-tiers', '500:6.10, 2000:5.70');
  await a.check('#e-featured').catch(() => {});
  await a.click('[data-edit-form] button[type=submit]');
  await a.waitForSelector('[data-edit-form]', { state: 'detached' });
  const np = JSON.parse(sql(`select row_to_json(p) from apparel_products p where name = 'Club Pique Polo ${stamp}'`).out);
  ok('product created with SKU, image, tiers', /^SA-POL-/.test(np.sku) && np.images.length === 1 && np.price_tiers.length === 2, np.sku);
  // Public catalog shows it with the photo; wholesale price hidden from public
  const pub = await ctx();
  await pub.goto(BASE + '/products/');
  await pub.waitForSelector(`.card[data-id="${np.id}"] img.photo`, { timeout: 10000 });
  ok('new product live in public catalog with photo', true);
  ok('public sees no wholesale price', !(await pub.locator(`.card[data-id="${np.id}"] .price`).textContent()).includes('USD'));
  const cat = await pub.evaluate(async () => JSON.stringify(await window.SB.rpc('apparel_catalog')));
  ok('catalog API hides wholesale/manufacturing fields', !/wholesale_price|manufacturing_notes|price_tiers/.test(cat));
  // Buyer is not verified → no prices; verify, then prices show
  sql(`update apparel_buyers set status = 'verified' where email = '${users.buyer}'`);
  await b.goto(BASE + '/products/view/?id=' + np.id);
  await b.waitForSelector('.pdp-price .tiers', { timeout: 10000 });
  ok('verified buyer sees wholesale tiers', (await b.locator('.pdp-price').textContent()).includes('6.40'));
  await b.screenshot({ path: OUT + 'buyer-pdp-price.png' });

  await a.goto(BASE + '/admin/#content'); await a.waitForSelector('[data-c="hero"]');
  await a.fill('[data-c="hero"] [name=title]', 'Made for brands that ship worldwide.');
  await a.fill('[data-c="announcements"] [name=items]', 'Free sampling on orders over 1,000 pcs\nNew: Polo collection');
  await a.click('[data-c="hero"] button[type=submit]');
  await a.click('[data-c="announcements"] button[type=submit]');
  await a.waitForTimeout(800);
  await pub.evaluate(() => sessionStorage.clear());
  await pub.goto(BASE + '/');
  await pub.waitForFunction(() => /brands that ship/.test(document.querySelector('[data-cms="hero.title"]').textContent), null, { timeout: 8000 });
  ok('CMS hero + announcements applied', (await pub.locator('[data-cms-announce]').textContent()).includes('Polo collection'));

  /* ---------- Remaining admin screens render ---------- */
  for (const v of ['overview', 'reports', 'team', 'system', 'suppliers', 'fabrics', 'collections', 'inquiries', 'samples']) {
    await a.goto(BASE + '/admin/#' + v); await a.reload();
    await a.waitForSelector('.admin-head h1');
    const err = await a.locator('.admin-main .form-error').count();
    ok('admin view renders: ' + v, err === 0);
  }
  await a.goto(BASE + '/admin/#reports'); await a.reload(); await a.waitForSelector('.report-grid');
  await a.screenshot({ path: OUT + 'admin-reports.png', fullPage: true });
  const [csv] = await Promise.all([a.waitForEvent('download'), a.locator('[data-exp="product_inquiries"]').click()]);
  ok('report CSV export', fs.readFileSync(await csv.path(), 'utf8').includes('product'));
  // Supplier CRUD
  await a.goto(BASE + '/admin/#suppliers'); await a.reload(); await a.waitForSelector('[data-new]');
  await a.click('[data-new]'); await a.fill('#e-name', 'Mekong Knit Mills'); await a.fill('#e-country', 'Cambodia');
  await a.locator('[name=categories][value=Fabric] + span').click();
  await a.click('[data-sup-form] button[type=submit]');
  await a.waitForSelector('.row-link >> text=Mekong Knit Mills');
  ok('supplier created', true);
  // Audit trail
  ok('audit log records actions', +sql(`select count(*) from apparel_audit`).out > 5);

  /* ---------- Mobile layouts ---------- */
  for (const w of [320, 375, 430]) {
    const m = await ctx({ width: w, height: 800 });
    await login(m, users.buyer, '/account/login/?next=/account/?tab=orders');
    await m.goto(BASE + '/account/?tab=orders'); await m.waitForSelector('.order-steps');
    const over = await m.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    ok(`buyer orders no overflow @${w}`, over <= 0, String(over));
    if (w === 375) await m.screenshot({ path: OUT + 'm-orders.png', fullPage: true });
    await m.goto(BASE + '/quote/'); await m.waitForSelector('.wizard-steps');
    const over2 = await m.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    ok(`quote wizard no overflow @${w}`, over2 <= 0, String(over2));
    const ma = await ctx({ width: w, height: 800 });
    await login(ma, users.super);
    await ma.goto(BASE + '/admin/#rfqs'); await ma.waitForSelector('.admin-table');
    await ma.locator('.admin-table .row-link').first().click(); await ma.waitForSelector('.drawer-card');
    const over3 = await ma.evaluate(() => document.querySelector('.drawer-card').scrollWidth - document.querySelector('.drawer-card').clientWidth);
    ok(`admin drawer no overflow @${w}`, over3 <= 0, String(over3));
    if (w === 375) await ma.screenshot({ path: OUT + 'm-admin.png', fullPage: false });
    if (m.errors.length || ma.errors.length) ok('mobile JS errors @' + w, false, m.errors.concat(ma.errors).join(' | '));
  }

  for (const [n, pg] of [['buyer', b], ['admin', a], ['ship', s], ['sales', r], ['public', pub]]) ok('no JS errors: ' + n, pg.errors.length === 0, pg.errors.join(' | ').slice(0, 500));
} catch (e) {
  ok('EXCEPTION', false, e.stack.split('\n').slice(0, 4).join(' '));
}
const rpcErr = log.filter((x) => x.err && !/DUPLICATE_REQUEST|NOT_AUTHORIZED/.test(x.err));
ok('no unexpected RPC errors', rpcErr.length === 0, JSON.stringify(rpcErr).slice(0, 600));
await browser.close();
const fails = results.filter((r) => r[0] === 'FAIL');
console.log(`\n${results.length - fails.length}/${results.length} passed`);
fs.writeFileSync(OUT + 'results.json', JSON.stringify(results, null, 1));
