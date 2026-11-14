// v3 features: homepage wholesale inquiry → admin pipeline; guest RFQ general fields; CMS gallery / testimonials / social → homepage.
import { chromium } from '/opt/npm-tools/node_modules/playwright/index.mjs';
import { install, createUser, sql } from './emulator.mjs';
import fs from 'node:fs';
const BASE = 'http://localhost:8765', OUT = '/tmp/siddiqiya-e2e3/'; fs.mkdirSync(OUT, { recursive: true });
const stamp = Date.now().toString(36), PW = 'Passw0rd!x';
const su = `super3.${stamp}@test.dev`, rep = `rep3.${stamp}@test.dev`;
for (const [e, r] of [[su, 'super_admin'], [rep, 'sales_rep']]) { const id = createUser(e, PW); sql(`insert into public.apparel_admins (user_id, role) values ('${id}', '${r}')`); }
const res = []; const ok = (n, c, x) => { res.push(c); console.log(c ? 'PASS' : 'FAIL', n, x || ''); };
const browser = await chromium.launch();
async function ctx(viewport = { width: 1440, height: 900 }) {
  const c = await browser.newContext({ viewport }); const p = await c.newPage(); await install(p);
  p.errors = []; p.on('pageerror', (e) => p.errors.push(e.message));
  p.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) p.errors.push(m.text()); });
  return p;
}
async function adminLogin(p, email) { await p.goto(BASE + '/admin/'); await p.fill('#a-email', email); await p.fill('#a-pass', PW); await p.click('[data-admin-login] button[type=submit]'); await p.waitForSelector('.admin-nav'); }
try {
  // 1. Homepage wholesale inquiry (guest)
  const g = await ctx();
  await g.goto(BASE + '/');
  for (const id of ['custom-manufacturing', 'oem-odm', 'private-label', 'process', 'wholesale-inquiry']) ok('homepage section #' + id, await g.locator('#' + id).count() === 1);
  ok('process has 9 steps', (await g.locator('#process li').count()) === 9, String(await g.locator('#process li').count()));
  ok('gallery hidden without real photos', await g.locator('[data-cms-gallery]').isHidden());
  ok('testimonials hidden without real testimonials', await g.locator('[data-cms-testimonials]').isHidden());
  const f = g.locator('section#wholesale-inquiry form');
  await f.locator('button[type=submit]').click();
  ok('required-field validation blocks empty submit', (await f.locator('[aria-invalid=true]').count()) >= 7, String(await f.locator('[aria-invalid=true]').count()));
  await f.locator('[name="Contact person"]').fill('Maria Lopez'); await f.locator('[name=Company]').fill('Lopez Retail ' + stamp);
  await f.locator('[name=Email]').fill(`maria.${stamp}@lopez.test`); await f.locator('[name=Phone]').fill('+34 600 000 000');
  await f.locator('[name=Country]').selectOption('Spain'); await f.locator('[name=Product]').selectOption({ index: 2 });
  await f.locator('[name=Quantity]').fill('1,500 pcs'); await f.locator('[name="Preferred GSM"]').selectOption({ index: 3 });
  await f.locator('[name="Fabric type"]').selectOption({ index: 1 }); await f.locator('[name=Sizes]').fill('S–XL'); await f.locator('[name=Colours]').fill('black, bone');
  await f.locator('[name=Customization]').fill('Woven neck label, screen print front'); await f.locator('[name=Message]').fill('Need samples first');
  await f.locator('button[type=submit]').click();
  await g.waitForSelector('section#wholesale-inquiry .form-done', { timeout: 10000 });
  const done = await g.locator('section#wholesale-inquiry .form-done').textContent();
  const code = (done.match(/INQ-\d{4}-\d+/) || [])[0];
  ok('success confirmation with inquiry ID', !!code, code);
  const row = JSON.parse(sql(`select row_to_json(i) from apparel_inquiries i where code = '${code}'`).out);
  ok('inquiry saved with product + quantity extracted', row.product && row.quantity === 1500 && row.status === 'new', `${row.product} ${row.quantity}`);
  ok('all form fields saved', ['Preferred GSM', 'Fabric type', 'Sizes', 'Colour preferences', 'Customisation requirements', 'Additional message'].every((k) => (row.details || {})[k] || row[k.toLowerCase()]) , JSON.stringify(row.details));
  const mail = sql(`select count(*) from apparel_email_outbox where template = 'inquiry_admin' and data->>'code' = '${code}'`).out.trim();
  ok('admin notification queued', mail === '1', mail);
  // duplicate prevention: same submission again
  const dup = await g.evaluate(async (c) => { try { await window.SB.rpc('apparel_submit_inquiry', { p: c }); await window.SB.rpc('apparel_submit_inquiry', { p: c }); return 'no error'; } catch (e) { return e.message || String(e); } },
    { kind: 'wholesale', email: `dup.${stamp}@x.test`, contact_name: 'Dup', subject: 'dup', message: 'same', details: {} });
  ok('duplicate submission blocked', /already sent|DUPLICATE/.test(dup), dup);

  // 2. Sales rep works the inquiry
  const a = await ctx();
  await adminLogin(a, rep);
  await a.goto(BASE + '/admin/#inquiries'); await a.reload(); await a.waitForSelector('.admin-table');
  await a.fill('[data-filter] [name=q], .filter-bar input[type=search]', 'Lopez Retail').catch(() => {});
  await a.waitForTimeout(400);
  await a.locator('.admin-table .row-link', { hasText: code }).click(); await a.waitForSelector('.drawer-card');
  ok('drawer shows buyer details', /Lopez Retail/.test(await a.locator('.drawer-card').textContent()));
  const opts = await a.locator('.drawer-card [name=status] option').allTextContents();
  ok('7 inquiry statuses', ['New', 'Reviewing', 'Quotation sent', 'Negotiation', 'Confirmed', 'Completed', 'Rejected'].every((s) => opts.includes(s)), opts.join(','));
  await a.selectOption('.drawer-card [name=status]', 'quotation_sent');
  await a.fill('.drawer-card [name=quotation]', 'USD 4.20/pc at 1,500 pcs, lead time 30 days');
  await a.fill('.drawer-card [name=follow_up]', '2026-12-01');
  await a.fill('.drawer-card [name=note]', 'Called buyer');
  await a.click('.drawer-card [data-detail] button[type=submit]'); await a.waitForTimeout(900);
  const r2 = JSON.parse(sql(`select row_to_json(i) from apparel_inquiries i where code = '${code}'`).out);
  ok('status / quotation / follow-up / note saved', r2.status === 'quotation_sent' && /4.20/.test(r2.quotation) && r2.follow_up === '2026-12-01' && r2.admin_note === 'Called buyer', JSON.stringify([r2.status, r2.follow_up]));
  await a.goto(BASE + '/admin/#inquiries'); await a.reload(); await a.waitForSelector('.admin-table');
  ok('list shows product · qty and follow-up', /1,500 pcs/.test(await a.locator('.admin-table').textContent()));
  await a.locator('.admin-table .row-link', { hasText: code }).click(); await a.waitForSelector('.drawer-card');
  ok('history recorded', /quotation/i.test(await a.locator('.drawer-card').textContent()));
  await a.screenshot({ path: OUT + 'admin-inquiry.png' });

  // 3. Guest RFQ with general requirements (no styles in list)
  const q = await ctx({ width: 390, height: 844 });
  await q.goto(BASE + '/quote/');
  await q.fill('#f-contact-person', 'Ken Ito'); await q.fill('#f-company', 'Ito Co').catch(() => {}); await q.fill('#f-email', `ken.${stamp}@ito.test`);
  await q.selectOption('#f-country', 'Japan').catch(() => {});
  await q.click('[data-next]');
  await q.click('[data-next]');
  ok('product + quantity required when quote list empty', (await q.locator('[data-step="2"] [aria-invalid=true]').count()) === 2);
  await q.selectOption('[data-step="2"] [name=Product]', { index: 1 }); await q.fill('[data-step="2"] [name=Quantity]', '800');
  await q.selectOption('[data-step="2"] [name="Preferred GSM"]', { index: 2 }); await q.fill('[data-step="2"] [name=Sizes]', 'M–XXL');
  await q.click('[data-next]');
  await q.selectOption('[name="Order type"]', 'Bulk order'); await q.click('[data-next]');
  ok('review lists general requirements', /800/.test(await q.locator('[data-review]').textContent()));
  await q.click('.quote-wizard button[type=submit]');
  await q.waitForSelector('.form-done', { timeout: 10000 });
  const qc = ((await q.locator('.form-done').textContent()).match(/INQ-\d{4}-\d+/) || [])[0];
  const r3 = JSON.parse(sql(`select row_to_json(i) from apparel_inquiries i where code = '${qc}'`).out);
  ok('guest RFQ saved with product/quantity', r3.quantity === 800 && !!r3.product, qc);
  const ov = await q.evaluate(() => document.documentElement.scrollWidth - innerWidth); ok('quote wizard no overflow @390', ov <= 0, String(ov));

  // 4. CMS: gallery, testimonials, social (super admin)
  const s = await ctx();
  await adminLogin(s, su);
  await s.goto(BASE + '/admin/#content'); await s.reload(); await s.waitForSelector('[data-c="gallery"]');
  await s.setInputFiles('[data-c="gallery"] [data-media-input]', new URL('./fixtures/logo.png', import.meta.url).pathname);
  await s.waitForSelector('[data-c="gallery"] [data-media] li');
  await s.fill('[data-c="gallery"] [name=captions]', 'Sample room');
  await s.click('[data-c="gallery"] button[type=submit]'); await s.waitForTimeout(700);
  await s.fill('[data-c="testimonials"] [name=items]', 'Consistent quality across three re-orders. | Test Buyer | Test Co | Germany');
  await s.click('[data-c="testimonials"] button[type=submit]'); await s.waitForTimeout(700);
  await s.fill('[data-c="social"] [name=instagram]', 'http://insecure.example');
  await s.click('[data-c="social"] button[type=submit]'); await s.waitForTimeout(700);
  ok('non-https social link rejected', /https/.test((await s.locator('.toast').last().textContent().catch(() => '')) || '') || sql(`select count(*) from apparel_content where key='social' and value->>'instagram' like 'http:%'`).out.trim() === '0');
  await s.fill('[data-c="social"] [name=instagram]', 'https://instagram.com/siddiqiya.test');
  await s.click('[data-c="social"] button[type=submit]'); await s.waitForTimeout(700);
  await s.fill('[data-c="contact"] [name=email]', 'sales@example.test');
  await s.click('[data-c="contact"] button[type=submit]'); await s.waitForTimeout(700);
  const h = await ctx();
  await h.goto(BASE + '/');
  await h.waitForSelector('[data-cms-gallery]:not([hidden]) img', { timeout: 10000 });
  ok('gallery photo shows on homepage', true);
  ok('testimonial shows on homepage', /three re-orders/.test(await h.locator('[data-cms-testimonials]').textContent()) && await h.locator('[data-cms-testimonials]').isVisible());
  ok('footer social link', (await h.locator('[data-cms-social] a[href="https://instagram.com/siddiqiya.test"]').count()) === 1);
  ok('footer business email', (await h.locator('footer a[href="mailto:sales@example.test"]').count()) >= 1);
  // clean up CMS test content so later screenshots stay honest
  sql(`delete from apparel_content where key in ('gallery','testimonials','social'); update apparel_content set value = value - 'email' where key = 'contact'`);
  // 5. PDP rows
  await h.goto(BASE + '/products/');
  await h.locator('.card a').first().click(); await h.waitForSelector('.specs');
  const specs = await h.locator('.specs').textContent();
  ok('PDP specs: GSM, fabric, fit, stitching, MOQ, printing, embroidery, private label, lead time', ['GSM', 'Fabric', 'Fit', 'Stitching', 'MOQ', 'Printing', 'Embroidery', 'Private label', 'Lead time'].every((k) => specs.includes(k)));
  for (const p of [g, a, q, s, h]) if (p.errors.length) console.log('errors', p.errors);
  ok('no JS errors', [g, a, q, s, h].every((p) => !p.errors.length));
} catch (e) { console.log('FAIL exception', e.message); res.push(false); }
await browser.close();
console.log(`\n${res.filter(Boolean).length}/${res.length} passed`);
