// Keeps the static catalog in sync with the admin-managed catalog in the database:
// hides products/fabrics/collections an admin unpublished, shows MOQ / lead time set by admins,
// and lists products added after the last site build (rendered on /products/view/?id=…).
import { teeSVG, teeSideSVG, fabricSVG } from './art.mjs';

const SA = window.SA;
const SB = window.SB;
const KEY = 'sa_catalog';
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const svgUrl = (svg) => 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
const known = new Set(SA.products.map((p) => p.id));
async function catalog(fresh) {
  if (!fresh) try {
    const c = JSON.parse(sessionStorage.getItem(KEY) || 'null');
    if (c && Date.now() - c.t < 5 * 60 * 1000) return c.d;
  } catch (e) { /* ignore */ }
  const d = await SB.rpc('apparel_catalog');
  try { sessionStorage.setItem(KEY, JSON.stringify({ t: Date.now(), d })); } catch (e) { /* ignore */ }
  return d;
}

const fabricOf = (live, slug) => live.fabrics.find((f) => f.slug === slug) || SA.fabrics.find((f) => f.slug === slug) || { name: slug, composition: '' };
const colorHex = (k) => (SA.colors[k] || SA.colors.bone).hex;
function liveImg(p, color, view = 'front') {
  const o = { shape: p.shape, color: colorHex(color), print: p.print || '', finish: p.finish || '', uid: view[0] + p.id.replace(/\D/g, '') };
  return svgUrl(view === 'side' ? teeSideSVG(o) : teeSVG({ ...o, view: view === 'neck' || view === 'detail' ? 'front' : view, crop: view === 'neck' || view === 'detail' }));
}
function liveCard(p, live) {
  const f = fabricOf(live, p.fabric);
  const c0 = p.colors[0];
  return `<article class="card in" data-id="${esc(p.id)}" data-cat="${esc(p.category)}" data-fabric="${esc(p.fabric)}" data-gsm="${p.gsm}" data-fit="${esc(p.fit)}" data-colors="${esc(p.colors.join(' '))}" data-name="${esc(p.name)}" data-live>
<a class="card-media" href="/products/view/?id=${encodeURIComponent(p.id)}" aria-label="${esc(p.name)}"><img class="main" src="${liveImg(p, c0)}" alt="${esc(p.name)}" width="400" height="440"><img class="alt" src="${liveImg(p, c0, 'back')}" alt="" width="400" height="440"><span class="card-badge">${p.gsm} GSM</span></a>
<div class="card-body"><a class="card-title" href="/products/view/?id=${encodeURIComponent(p.id)}">${esc(p.name)}</a><span class="card-spec">${esc(f.name)} · ${p.gsm} GSM</span><span class="card-comp">${esc(f.composition)}</span>
<div class="swatches">${p.colors.map((k) => `<span class="sw" style="background:${colorHex(k)}" title="${esc((SA.colors[k] || {}).name || k)}"></span>`).join('')}</div><span class="sizes">${esc(p.fit)} fit · ${esc(p.sizes[0])}–${esc(p.sizes[p.sizes.length - 1])}</span>
<div class="card-foot"><span class="price">Price &amp; MOQ on request</span><a class="card-quote" href="/products/view/?id=${encodeURIComponent(p.id)}#quote">Request quote +</a></div></div></article>`;
}

async function run() {
  let live;
  try { live = await catalog(); } catch (e) { return; } // static pages stay as built
  if (!live || !Array.isArray(live.products)) return;
  // A product link newer than the cached catalog: fetch a fresh copy once.
  const wanted = document.querySelector('[data-live-product]') && new URLSearchParams(location.search).get('id');
  if (wanted && !live.products.some((p) => p.id === wanted)) { try { live = await catalog(true); } catch (e) { /* keep cached */ } }
  const liveIds = new Set(live.products.map((p) => p.id));
  const hidden = new Set(live.hidden || []);
  const liveFabrics = new Set(live.fabrics.map((f) => f.slug));
  const liveCollections = new Set(live.collections.map((c) => c.slug));
  window.SA_LIVE = live;

  // Hide unpublished products everywhere.
  document.querySelectorAll('.card[data-id]').forEach((card) => {
    const id = card.getAttribute('data-id');
    if (hidden.has(id) || (known.has(id) && !liveIds.has(id))) card.remove();
  });
  document.querySelectorAll('a.fab[href^="/fabrics/"], a.swatch-tile[href^="/fabrics/"]').forEach((a) => {
    const slug = a.getAttribute('href').split('/')[2];
    if (slug && !liveFabrics.has(slug)) a.remove();
  });
  document.querySelectorAll('a.coll[href^="/collections/"]').forEach((a) => {
    const slug = a.getAttribute('href').split('/')[2];
    if (slug && !liveCollections.has(slug)) a.remove();
  });

  // Product page: unpublished → notice; MOQ / lead time from admin.
  const pdp = document.querySelector('[data-product]');
  if (pdp) {
    const id = pdp.getAttribute('data-product');
    const p = live.products.find((x) => x.id === id);
    if (!p) {
      pdp.insertAdjacentHTML('beforebegin', '<div class="wrap"><div class="portal-notice">This style is no longer in our current catalog. <a href="/products/">Browse current products</a>.</div></div>');
      pdp.querySelectorAll('[data-add-detail], #sample-request button, #wholesale-inquiry button').forEach((b) => { b.disabled = true; });
    } else {
      if (p.moq) document.querySelectorAll('[data-live-moq]').forEach((el) => { el.textContent = p.moq; });
      if (p.lead_time) document.querySelectorAll('[data-live-lead]').forEach((el) => { el.textContent = p.lead_time; });
    }
  }

  // New products (added in the admin after the last build).
  const extra = live.products.filter((p) => !known.has(p.id));
  extra.forEach((p) => {
    const f = fabricOf(live, p.fabric);
    window.SA.products.push({ id: p.id, sku: p.sku, slug: '', name: p.name, cat: p.category, catName: (SA.categories.find((c) => c.slug === p.category) || {}).name || p.category, fabric: p.fabric, fabricName: f.name, comp: f.composition, gsm: p.gsm, fit: p.fit, colors: p.colors, sizes: p.sizes, desc: p.description || '', shape: p.shape, print: p.print || '', finish: p.finish || '', live: true });
  });
  window.SA_liveImg = (p, c, v) => liveImg({ ...p, shape: p.shape }, c, v);
  document.dispatchEvent(new CustomEvent('sa:live'));
  if (extra.length) {
    const grid = document.querySelector('[data-catalog]');
    if (grid) {
      grid.insertAdjacentHTML('beforeend', extra.map((p) => liveCard(p, live)).join(''));
      grid.dispatchEvent(new CustomEvent('catalog:updated', { bubbles: true }));
    }
    const catPage = location.pathname.match(/^\/categories\/([^/]+)\//);
    if (catPage) {
      const g = document.querySelector('main .grid');
      const add = extra.filter((p) => p.category === catPage[1]);
      if (g && add.length) g.insertAdjacentHTML('beforeend', add.map((p) => liveCard(p, live)).join(''));
    }
  }
  const count = document.querySelector('[data-result-count]');
  if (count) count.dispatchEvent(new CustomEvent('catalog:updated', { bubbles: true }));

  // Dynamic product page.
  const dyn = document.querySelector('[data-live-product]');
  if (dyn) renderLiveProduct(dyn, live);

  applyContent(live.content || {});
  applyMedia(live);
  applyPrices(live);
}

/* ---------- admin-managed website content ---------- */
function applyContent(c) {
  const get = (path) => path.split('.').reduce((o, k) => (o && o[k] != null ? o[k] : null), c);
  document.querySelectorAll('[data-cms]').forEach((el) => { const v = get(el.dataset.cms); if (typeof v === 'string' && v.trim()) el.textContent = v.trim(); });
  document.querySelectorAll('[data-cms-show]').forEach((el) => { const v = get(el.dataset.cmsShow); if (v) el.hidden = false; });
  document.querySelectorAll('[data-cms-mail]').forEach((el) => { const v = get(el.dataset.cmsMail); if (v) { el.textContent = v; el.href = 'mailto:' + v; } });
  const ann = document.querySelector('[data-cms-announce] .wrap');
  const items = (c.announcements && c.announcements.items || []).filter(Boolean).slice(0, 4);
  if (ann && items.length) ann.innerHTML = items.map((t, i) => `${i ? '<i></i>' : ''}<span${i ? '' : ' class="on"'}>${esc(t)}</span>`).join('');
  const heroImg = c.hero && c.hero.image;
  const heroPhoto = document.querySelector('[data-cms-hero-photo]');
  if (heroImg && heroPhoto) {
    heroPhoto.src = /^https:/.test(heroImg) ? heroImg : SB.publicUrl('apparel-media', heroImg);
    heroPhoto.alt = (c.hero.image_alt || 'SIDDIQIYA Apparel campaign');
    heroPhoto.hidden = false;
    heroPhoto.closest('[data-hero-art]').classList.add('has-photo');
    heroPhoto.closest('[data-hero-art]').removeAttribute('aria-hidden');
  }
  const faq = document.querySelector('[data-cms-faq]');
  const qa = (c.faq && c.faq.items || []).filter((x) => x && x.q && x.a);
  if (faq && qa.length) faq.innerHTML = qa.map((x) => `<details class="acc"><summary>${esc(x.q)}</summary><div>${esc(x.a)}</div></details>`).join('');
}

/* ---------- photos uploaded in the admin ---------- */
const media = (path) => (/^https?:/.test(path) ? path : SB.publicUrl('apparel-media', path));
function applyMedia(live) {
  const byId = new Map(live.products.map((p) => [p.id, p]));
  document.querySelectorAll('.card[data-id]').forEach((card) => {
    const p = byId.get(card.getAttribute('data-id'));
    if (!p || !p.images || !p.images.length) return;
    const main = card.querySelector('img.main'), alt = card.querySelector('img.alt');
    if (main) { main.src = media(p.images[0]); main.classList.add('photo'); }
    if (alt) { if (p.images[1]) { alt.src = media(p.images[1]); alt.classList.add('photo'); } else alt.remove(); }
  });
  const pdp = document.querySelector('[data-product]');
  if (pdp) {
    const p = byId.get(pdp.getAttribute('data-product'));
    if (p && p.sku) pdp.querySelectorAll('[data-live-sku]').forEach((el) => { el.textContent = p.sku; });
    const gal = pdp.querySelector('.gallery');
    if (p && p.images && p.images.length && gal) {
      gal.insertAdjacentHTML('afterbegin', p.images.map((im, i) => `<figure class="photo${i ? '' : ' wide'}"><img src="${esc(media(im))}" alt="${esc(p.name)} photo ${i + 1}" loading="${i ? 'lazy' : 'eager'}"></figure>`).join(''));
    }
  }
  // Fabric and collection pages: first uploaded image / banner.
  const fab = location.pathname.match(/^\/fabrics\/([^/]+)\/$/);
  if (fab) {
    const f = live.fabrics.find((x) => x.slug === fab[1]);
    const hero = document.querySelector('.page-hero--split .swatch-tile img');
    if (f && f.images && f.images.length && hero) { hero.src = media(f.images[0]); hero.classList.add('photo'); }
  }
  const col = location.pathname.match(/^\/collections\/([^/]+)\/$/);
  if (col) {
    const c = live.collections.find((x) => x.slug === col[1]);
    const art = document.querySelector('.page-hero--split .coll');
    if (c && c.banner && art) art.innerHTML = `<img class="photo coll-banner" src="${esc(media(c.banner))}" alt="${esc(c.name)}">`;
  }
  document.querySelectorAll('a.fab[href^="/fabrics/"]').forEach((a) => {
    const f = live.fabrics.find((x) => x.slug === a.getAttribute('href').split('/')[2]);
    const im = a.querySelector('img');
    if (f && f.images && f.images.length && im) { im.src = media(f.images[0]); im.classList.add('photo'); }
  });
}

/* ---------- wholesale prices (verified buyers only; enforced by the database) ---------- */
async function applyPrices(live) {
  if (!SB.user()) return;
  let prices;
  try { prices = await SB.rpc('apparel_buyer_prices'); } catch (e) { return; }
  if (!prices || !Object.keys(prices).length) return;
  const fx = live.fx || {};
  const usd = (v) => 'USD ' + Number(v).toFixed(2);
  const alt = (v) => ['EUR', 'GBP'].filter((c) => fx[c]).map((c) => `≈ ${c} ${(v * fx[c]).toFixed(2)}`).join(' · ');
  const from = (pr) => { const all = [pr.wholesale_price].concat((pr.tiers || []).map((t) => t.unit_price)).filter((x) => x != null).map(Number); return all.length ? Math.min(...all) : null; };
  document.querySelectorAll('.card[data-id]').forEach((card) => {
    const pr = prices[card.getAttribute('data-id')], el = card.querySelector('.price');
    const v = pr && from(pr);
    if (el && v != null) el.textContent = 'Wholesale from ' + usd(v);
  });
  const pdp = document.querySelector('[data-product]');
  const pr = pdp && prices[pdp.getAttribute('data-product')];
  const box = pdp && pdp.querySelector('.pdp-price');
  if (pr && box) {
    const tiers = (pr.tiers || []).slice().sort((a, b) => a.min_qty - b.min_qty);
    box.innerHTML = `<b>${pr.wholesale_price != null ? usd(pr.wholesale_price) + ' / pc' : 'Volume pricing'}</b><span class="muted" style="font-size:13px">Your verified wholesale price${pr.wholesale_price != null && alt(pr.wholesale_price) ? ' · ' + alt(pr.wholesale_price) : ''}. Final pricing is confirmed on your quotation.</span>` +
      (tiers.length ? `<table class="data-table tiers"><thead><tr><th>Quantity</th><th class="num">Price / pc</th></tr></thead><tbody>${tiers.map((t) => `<tr><td>${Number(t.min_qty).toLocaleString()}+ pcs</td><td class="num">${usd(t.unit_price)}</td></tr>`).join('')}</tbody></table>` : '');
  }
}

function renderLiveProduct(root, live) {
  const id = new URLSearchParams(location.search).get('id') || '';
  const p = live.products.find((x) => x.id === id);
  if (!p) {
    const st = SA.products.find((x) => x.id === id && x.slug);
    if (st) { location.replace(`/products/${st.slug}/`); return; }
    root.innerHTML = '<div class="empty-state"><p>This product is not available.</p><a class="btn" href="/products/">Browse products</a></div>';
    return;
  }
  if (known.has(p.id)) { location.replace(`/products/${p.slug}/`); return; }
  const f = fabricOf(live, p.fabric);
  const cat = SA.categories.find((c) => c.slug === p.category) || { name: p.category };
  document.title = `${p.name} | SIDDIQIYA Apparel`;
  let color = p.colors[0];
  const views = [['front', 'Front'], ['back', 'Back'], ['detail', 'Collar & stitching']];
  const swatch = (c) => svgUrl(fabricSVG({ texture: f.texture || 'jersey', color: colorHex(c), uid: 'lf' }));
  root.innerHTML = `<nav class="crumbs" aria-label="Breadcrumb"><a href="/">Home</a><span aria-hidden="true">/</span><a href="/products/">Products</a><span aria-hidden="true">/</span><a href="/categories/${esc(p.category)}/">${esc(cat.name)}</a><span aria-hidden="true">/</span><span aria-current="page">${esc(p.name)}</span></nav>
<section class="pdp" data-product="${esc(p.id)}"><div class="gallery">${views.map(([v, l]) => `<figure><img data-view="${v}" src="${liveImg(p, color, v)}" alt="${esc(p.name)} ${l.toLowerCase()}" width="400" height="440"><figcaption>${l}</figcaption></figure>`).join('')}<figure class="fabric wide"><img data-view="fabric" src="${swatch(color)}" alt="${esc(f.name)} close-up"><figcaption>Fabric close-up</figcaption></figure></div>
<div class="pdp-info"><span class="pdp-id">${esc(p.id)} · ${esc(cat.name)}</span><h1 class="h1">${esc(p.name)}</h1><p class="muted" style="margin:0">${esc(p.description || '')}</p>
<div class="pdp-price"><b>Price on request</b><span class="muted" style="font-size:13px">Retail and wholesale prices are quoted by quantity.</span></div>
<div class="pdp-block"><div class="row"><span class="caps" style="font-size:11px">Colour — <span data-color-name>${esc(SA.colors[color] ? SA.colors[color].name : color)}</span></span></div><div class="opts">${p.colors.map((k, i) => `<button class="color-btn" type="button" data-live-color="${esc(k)}" aria-pressed="${i === 0}" aria-label="${esc((SA.colors[k] || {}).name || k)}" style="background:${colorHex(k)}"></button>`).join('')}</div></div>
<div class="pdp-block" id="quote"><div class="row"><span class="caps" style="font-size:11px">Quantity by size</span></div><div class="size-grid">${p.sizes.map((s) => `<label>${esc(s)}<input class="input" type="number" min="0" step="1" inputmode="numeric" placeholder="0" data-size="${esc(s)}"></label>`).join('')}</div></div>
<div class="actions" style="margin-top:8px"><button class="btn" style="flex:1" type="button" data-live-add>Add to quote list</button></div>
<div class="pdp-more"><a class="btn btn--ghost btn--sm" href="/contact/">Request a sample</a><a class="btn btn--ghost btn--sm" href="/wholesale/#apply">Wholesale inquiry</a></div>
<dl class="specs"><div><dt>Product ID</dt><dd>${esc(p.id)}</dd></div><div><dt>SKU</dt><dd data-live-sku>${esc(p.sku || '')}</dd></div><div><dt>Fabric</dt><dd>${esc(f.name)} — ${esc(f.composition)}</dd></div><div><dt>Weight</dt><dd>${p.gsm} GSM</dd></div><div><dt>Fit</dt><dd>${esc(p.fit)}</dd></div><div><dt>Sizes</dt><dd>${p.sizes.map(esc).join(' · ')}</dd></div><div><dt>Customisation</dt><dd>Available — print, embroidery, labels, packaging</dd></div><div><dt>MOQ</dt><dd>${esc(p.moq || 'Confirmed with your quotation')}</dd></div><div><dt>Lead time</dt><dd>${esc(p.lead_time || 'Confirmed with your quotation')}</dd></div></dl></div></section>`;
  root.querySelectorAll('[data-live-color]').forEach((b) => b.addEventListener('click', () => {
    color = b.dataset.liveColor;
    root.querySelectorAll('[data-live-color]').forEach((x) => x.setAttribute('aria-pressed', x === b));
    root.querySelector('[data-color-name]').textContent = SA.colors[color] ? SA.colors[color].name : color;
    views.forEach(([v]) => { root.querySelector(`[data-view="${v}"]`).src = liveImg(p, color, v); });
    root.querySelector('[data-view="fabric"]').src = swatch(color);
  }));
  root.querySelector('[data-live-add]').addEventListener('click', () => {
    const sizes = {};
    let bad = false;
    root.querySelectorAll('[data-size]').forEach((i) => { const v = i.value.trim(); if (!v) return; if (!/^\d+$/.test(v)) { bad = true; return; } if (+v > 0) sizes[i.dataset.size] = +v; });
    if (bad) { window.SAStore.toast('Quantities must be whole numbers.'); return; }
    const list = window.SAStore.load('sa_quote');
    list.push({ id: p.id, color, sizes, fabric: p.fabric, gsm: p.gsm });
    window.SAStore.save('sa_quote', list);
    window.SAStore.updateCounts();
    window.SAStore.toast(`${p.name} added to your quote list`);
    root.querySelectorAll('[data-size]').forEach((i) => { i.value = ''; });
  });
}

if (SB) run();
