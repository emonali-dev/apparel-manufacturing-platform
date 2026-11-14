/* SIDDIQIYA Apparel — site behaviour (no dependencies) */
(function () {
  'use strict';
  var rpcArg = function (o) { return { p: o }; };
  var SA = window.SA || { products: [], colors: {}, fabrics: [], categories: [] };
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var byId = {};
  SA.products.forEach(function (p) { byId[p.id] = p; });
  var esc = function (s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var img = function (p, c, v) { return p.live && window.SA_liveImg ? window.SA_liveImg(p, c, v) : '/assets/img/products/' + p.slug + '/' + c + '-' + (v || 'front') + '-sm.webp'; };
  var imgFull = function (p, c, v) { return p.live && window.SA_liveImg ? window.SA_liveImg(p, c, v) : '/assets/img/products/' + p.slug + '/' + c + '-' + v + '.webp'; };
  var pHref = function (p) { return p.live ? '/products/view/?id=' + encodeURIComponent(p.id) : '/products/' + p.slug + '/'; };

  /* ---------- storage ---------- */
  function load(k) { try { return JSON.parse(localStorage.getItem(k)) || []; } catch (e) { return []; } }
  function save(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* storage unavailable */ } }
  var WISH = 'sa_wishlist', QUOTE = 'sa_quote';

  function updateCounts() {
    var w = load(WISH).length, q = load(QUOTE).length;
    $$('[data-wish-count]').forEach(function (el) { el.textContent = w || ''; el.setAttribute('data-n', w); });
    $$('[data-quote-count]').forEach(function (el) { el.textContent = q || ''; el.setAttribute('data-n', q); });
    var wl = load(WISH);
    $$('[data-wish]').forEach(function (b) { b.setAttribute('aria-pressed', wl.indexOf(b.getAttribute('data-wish')) > -1 ? 'true' : 'false'); });
  }

  var toastTimer;
  function toast(msg) {
    var t = $('.toast'); if (!t) return;
    $('[data-toast-text]', t).textContent = msg;
    t.setAttribute('data-show', 'true');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.setAttribute('data-show', 'false'); }, 3800);
  }

  function addToQuote(id, color, sizes) {
    var p = byId[id]; if (!p) return;
    var list = load(QUOTE);
    color = color || p.colors[0];
    var ex = list.filter(function (x) { return x.id === id && x.color === color; })[0];
    if (ex) {
      Object.keys(sizes || {}).forEach(function (s) { ex.sizes[s] = (ex.sizes[s] || 0) + sizes[s]; });
    } else {
      list.push({ id: id, color: color, sizes: sizes || {} });
    }
    save(QUOTE, list); updateCounts();
    toast(p.name + ' (' + SA.colors[color].name + ') added to your quote list');
  }
  function toggleWish(id) {
    var l = load(WISH), i = l.indexOf(id);
    if (i > -1) l.splice(i, 1); else l.push(id);
    save(WISH, l); updateCounts();
    var p = byId[id];
    if (p) toast(i > -1 ? p.name + ' removed from wishlist' : p.name + ' saved to wishlist');
    return i === -1;
  }

  /* ---------- WhatsApp ---------- */
  function openWhatsApp(text) {
    var url = 'https://wa.me/' + SA.wa + '?text=' + encodeURIComponent(text);
    var w = window.open(url, '_blank', 'noopener');
    if (!w) window.location.href = url;
  }
  function labelFor(el) {
    if (el.getAttribute('data-label')) return el.getAttribute('data-label');
    var l = el.id ? document.querySelector('label[for="' + el.id + '"]') : null;
    return l ? l.textContent.replace('*', '').trim() : el.name;
  }
  function validate(form) {
    var ok = true, first = null;
    $$('input, select, textarea', form).forEach(function (el) {
      if (!el.name || el.type === 'checkbox' || el.type === 'radio' || el.type === 'file') return;
      var err = el.parentNode.querySelector('.err');
      var v = el.value.trim(), msg = '';
      if (el.required && !v) msg = 'This field is required.';
      else if (v && el.type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v)) msg = 'Enter a valid email address.';
      else if (v && el.type === 'url' && !/^https?:\/\/\S+\.\S+/.test(v)) msg = 'Enter a full web address starting with https://';
      else if (v && el.type === 'tel' && !/^[+()\d\s-]{6,20}$/.test(v)) msg = 'Enter a valid phone number.';
      else if (v && el.type === 'number' && (!/^\d+$/.test(v) || +v < 0)) msg = 'Enter a whole number.';
      if (v.length > 2000) msg = 'Please keep this under 2,000 characters.';
      el.setAttribute('aria-invalid', msg ? 'true' : 'false');
      if (err) err.textContent = msg;
      if (msg) { ok = false; if (!first) first = el; }
    });
    if (first) first.focus();
    return ok;
  }
  function fieldValue(el) {
    if (el.tagName === 'SELECT') return el.value ? el.options[el.selectedIndex].text.trim() : '';
    return el.value.trim();
  }
  function fields(form) {
    return $$('input, select, textarea', form).filter(function (el) {
      return el.name && ['file', 'checkbox', 'radio', 'password', 'hidden'].indexOf(el.type) === -1 && fieldValue(el);
    });
  }
  function collect(form) {
    return fields(form).map(function (el) { return labelFor(el) + ': ' + fieldValue(el); });
  }
  function waUrl(text) { return 'https://wa.me/' + SA.wa + '?text=' + encodeURIComponent(text); }

  /* ---------- saving requests to the database ---------- */
  function inquiryPayload(form, kind, extra) {
    var map = {};
    fields(form).forEach(function (el) { map[el.name.toLowerCase()] = { label: labelFor(el), value: fieldValue(el) }; });
    var pick = function () { for (var i = 0; i < arguments.length; i++) { if (map[arguments[i]]) return map[arguments[i]].value; } return ''; };
    var details = {};
    Object.keys(map).forEach(function (k) { details[map[k].label] = map[k].value; });
    Object.keys(extra || {}).forEach(function (k) { details[k] = extra[k]; });
    return {
      kind: kind, subject: form.getAttribute('data-wa'),
      contact_name: pick('contact person', 'name'), email: pick('email'), company: pick('company'),
      country: pick('country'), phone: pick('phone'),
      message: pick('details', 'message', 'requirements', 'instructions', 'notes', 'delivery address', 'shipping address'),
      details: details,
    };
  }
  async function saveForm(form, extra) {
    if (!window.SB) throw new Error('Saving is unavailable right now.');
    var sample = form.getAttribute('data-sample');
    if (sample && SB.user()) {
      var parts = sample.split(':');
      var get = function (n) { var el = form.querySelector('[name="' + n + '"]'); return el ? el.value.trim() : ''; };
      var sp = parts[0] === 'product'
        ? { kind: 'product', product_id: parts[1], color: get('Sample colour'), size: get('Sample size'), delivery_address: get('Delivery address'), notes: get('Notes') }
        : { kind: 'fabric', fabric: parts[1], gsm: get('GSM'), color: get('Colours'), delivery_address: get('Shipping address'), notes: get('Notes') };
      try {
        var r = await SB.rpc('apparel_request_sample', rpcArg(sp));
        return { code: r.code, tracked: true };
      } catch (e) {
        if (['PROFILE_REQUIRED', 'NOT_AUTHENTICATED'].indexOf(e.code) === -1) throw e;
      }
    }
    var r2 = await SB.rpc('apparel_submit_inquiry', rpcArg(inquiryPayload(form, form.getAttribute('data-kind') || 'contact', extra)));
    return { code: r2.code, tracked: false };
  }
  function showDone(form, res, waText) {
    var d = document.createElement('div');
    d.className = 'form-done';
    d.setAttribute('role', 'status');
    d.setAttribute('tabindex', '-1');
    var track = res.tracked
      ? 'Follow its status in your <a href="/account/">buyer account</a>.'
      : (SB.user() ? 'Our team will reply by email or WhatsApp.' : 'Our team will reply by email or WhatsApp. <a href="/account/register/">Create a buyer account</a> to track requests online.');
    d.innerHTML = '<p class="eyebrow">Request received</p><p class="form-done-code">Reference <b>' + esc(res.code) + '</b></p><p>' + track + '</p>' +
      '<div class="actions"><a class="btn btn--ghost btn--sm" target="_blank" rel="noopener" href="' + waUrl(waText + '\nReference: ' + res.code) + '">Also message us on WhatsApp</a>' +
      '<button type="button" class="btn btn--ghost btn--sm" data-again>Send another request</button></div>';
    form.hidden = true;
    form.parentNode.insertBefore(d, form.nextSibling);
    d.querySelector('[data-again]').addEventListener('click', function () { d.remove(); form.reset(); form.hidden = false; });
    d.focus({ preventScroll: true });
    d.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
  function showError(form, err, waText) {
    var box = form.querySelector('.form-error');
    if (!box) { box = document.createElement('div'); box.className = 'form-error'; box.setAttribute('role', 'alert'); form.appendChild(box); }
    box.innerHTML = '<p>' + esc(SB ? SB.message(err) : err.message) + '</p><a class="link" target="_blank" rel="noopener" href="' + waUrl(waText) + '">Send it on WhatsApp instead</a>';
  }
  function busy(form, on) {
    var b = form.querySelector('[type="submit"]');
    if (!b) return;
    if (on) { b.dataset.label = b.textContent; b.textContent = 'Sending…'; b.disabled = true; }
    else { b.textContent = b.dataset.label || b.textContent; b.disabled = false; }
  }
  $$('form[data-wa]').forEach(function (form) {
    if (form.hasAttribute('data-include-quote')) return; // handled by the quote page
    form.addEventListener('submit', async function (e) {
      e.preventDefault();
      if (!validate(form)) return;
      var old = form.querySelector('.form-error'); if (old) old.remove();
      var waText = ['*' + form.getAttribute('data-wa') + '* — via app.hsdmj.com', ''].concat(collect(form)).join('\n');
      busy(form, true);
      try {
        var res = await saveForm(form);
        if (form.hasAttribute('data-compact')) { form.reset(); toast('Thank you — you are on the list (' + res.code + ').'); }
        else showDone(form, res, waText);
      } catch (err) {
        showError(form, err, waText);
      } finally { busy(form, false); }
    });
  });

  /* ---------- header, menu, search ---------- */
  var drawer = $('#drawer');
  function setDrawer(open) {
    if (!drawer) return;
    drawer.setAttribute('data-open', open); drawer.setAttribute('aria-hidden', !open);
    var b = $('[data-menu-open]'); if (b) b.setAttribute('aria-expanded', open);
    document.body.style.overflow = open ? 'hidden' : '';
    document.body.classList.toggle('float-off', open);
  }
  $$('[data-menu-open]').forEach(function (b) { b.addEventListener('click', function () { setDrawer(true); }); });
  $$('[data-menu-close]').forEach(function (b) { b.addEventListener('click', function () { setDrawer(false); }); });
  var so = $('.search-ov');
  function setSearch(open) { if (!so) return; so.setAttribute('data-open', open); document.body.classList.toggle('float-off', open); if (open) setTimeout(function () { $('#q-top').focus(); }, 30); }
  $$('[data-search-open]').forEach(function (b) { b.addEventListener('click', function () { setSearch(true); }); });
  $$('[data-search-close]').forEach(function (b) { b.addEventListener('click', function () { setSearch(false); }); });
  if (drawer) drawer.addEventListener('click', function (e) { var a = e.target.closest('a[href]'); if (a && a.getAttribute('href').indexOf('#') === -1) setDrawer(false); });
  // Hide the floating WhatsApp button while typing on small screens so it never covers inputs or buttons.
  document.addEventListener('focusin', function (e) { if (e.target.matches && e.target.matches('input, textarea, select') && window.innerWidth < 960) document.body.classList.add('float-off'); });
  document.addEventListener('focusout', function () { if (!(drawer && drawer.getAttribute('data-open') === 'true')) document.body.classList.remove('float-off'); });
  if (so) so.addEventListener('click', function (e) { if (e.target === so) setSearch(false); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') { setSearch(false); setDrawer(false); closeModal(); setFilters(false); } });

  // Announcement rotation (single line on small screens)
  var ann = $$('.announce span');
  if (ann.length > 1) {
    var ai = 0;
    setInterval(function () { ann[ai].classList.remove('on'); ai = (ai + 1) % ann.length; ann[ai].classList.add('on'); }, 3500);
  }

  // Reveal on scroll
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (es) { es.forEach(function (en) { if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); } }); }, { rootMargin: '0px 0px -8% 0px' });
    $$('.rv').forEach(function (el) { io.observe(el); });
  } else { $$('.rv').forEach(function (el) { el.classList.add('in'); }); }

  /* ---------- cards ---------- */
  function cardHTML(p) {
    var c0 = p.colors[0];
    return '<article class="card in" data-id="' + p.id + '"><a class="card-media" href="' + pHref(p) + '" aria-label="' + esc(p.name) + '"><img class="main" src="' + img(p, c0) + '" alt="' + esc(p.name) + '" width="400" height="440" loading="lazy"><img class="alt" src="' + img(p, c0, 'back') + '" alt="" width="400" height="440" loading="lazy"><span class="card-badge">' + p.gsm + ' GSM</span></a>' +
      '<button class="icon-btn card-wish" data-wish="' + p.id + '" aria-pressed="false" aria-label="Save ' + esc(p.name) + ' to wishlist"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/></svg></button>' +
      '<div class="card-quick"><button class="btn btn--sm" data-quick="' + p.id + '">Quick view</button></div>' +
      '<div class="card-body"><a class="card-title" href="' + pHref(p) + '">' + esc(p.name) + '</a><span class="card-spec">' + esc(p.fabricName) + ' · ' + p.gsm + ' GSM</span><span class="card-comp">' + esc(p.comp) + '</span><div class="swatches">' + p.colors.map(function (c) { return '<span class="sw" style="background:' + SA.colors[c].hex + '" title="' + SA.colors[c].name + '"></span>'; }).join('') + '</div><span class="sizes">' + p.fit + ' fit · ' + p.sizes[0] + '–' + p.sizes[p.sizes.length - 1] + '</span>' +
      '<div class="card-foot"><span class="price">Price &amp; MOQ on request</span><button data-add="' + p.id + '" aria-label="Request a quote for ' + esc(p.name) + '">Request quote +</button></div></div></article>';
  }

  document.addEventListener('click', function (e) {
    var t = e.target.closest ? e.target.closest('[data-wish],[data-add],[data-quick],[data-modal-close],[data-wa-product],[data-open-chart]') : null;
    if (!t) { if (e.target.classList && e.target.classList.contains('modal')) closeModal(); return; }
    if (t.hasAttribute('data-wish')) { e.preventDefault(); toggleWish(t.getAttribute('data-wish')); if ($('[data-wish-grid]')) renderWishlist(); }
    else if (t.hasAttribute('data-add')) { e.preventDefault(); addToQuote(t.getAttribute('data-add'), t.getAttribute('data-color')); }
    else if (t.hasAttribute('data-quick')) { e.preventDefault(); openModal(t.getAttribute('data-quick')); }
    else if (t.hasAttribute('data-modal-close')) { closeModal(); }
    else if (t.hasAttribute('data-wa-product')) {
      e.preventDefault();
      var p = byId[t.getAttribute('data-wa-product')];
      var col = ($('.color-btn[aria-pressed="true"]') || {}).getAttribute ? $('.color-btn[aria-pressed="true"]').getAttribute('data-color') : p.colors[0];
      openWhatsApp('Hello ' + 'SIDDIQIYA Apparel, I would like pricing and MOQ for ' + p.name + ' [' + p.id + '] in ' + SA.colors[col].name + ' (' + p.fabricName + ', ' + p.gsm + ' GSM). ' + location.href);
    } else if (t.hasAttribute('data-open-chart')) { var d = $('#size-chart'); if (d) d.open = true; }
  });

  /* ---------- quick view modal ---------- */
  var modal = $('.modal'), lastFocus;
  function openModal(id) {
    var p = byId[id]; if (!p || !modal) return;
    lastFocus = document.activeElement;
    var c = p.colors[0];
    $('.media', modal).innerHTML = '<img src="' + img(p, c) + '" alt="' + esc(p.name) + '" width="400" height="440">';
    $('.body', modal).innerHTML = '<span class="pdp-id">' + p.id + ' · ' + esc(p.catName) + '</span><h2 class="h2" style="font-size:34px;margin:10px 0 12px">' + esc(p.name) + '</h2><p class="muted">' + esc(p.desc) + '</p>' +
      '<dl class="specs"><div><dt>Fabric</dt><dd>' + esc(p.fabricName) + '</dd></div><div><dt>Weight</dt><dd>' + p.gsm + ' GSM</dd></div><div><dt>Fit</dt><dd>' + p.fit + '</dd></div><div><dt>Sizes</dt><dd>' + p.sizes.join(' · ') + '</dd></div><div><dt>Price</dt><dd>On request</dd></div></dl>' +
      '<div class="opts" style="margin:20px 0" data-qv-colors>' + p.colors.map(function (k, i) { return '<button class="color-btn" type="button" aria-pressed="' + (i === 0) + '" data-qv-color="' + k + '" aria-label="' + SA.colors[k].name + '" title="' + SA.colors[k].name + '" style="background:' + SA.colors[k].hex + '"></button>'; }).join('') + '</div>' +
      '<div class="actions" style="margin-top:8px"><button class="btn" data-add="' + p.id + '" data-color="' + c + '">Add to quote</button><a class="btn btn--ghost" href="' + pHref(p) + '">Full details</a></div>';
    $$('[data-qv-color]', modal).forEach(function (b) {
      b.addEventListener('click', function () {
        var k = b.getAttribute('data-qv-color');
        $$('[data-qv-color]', modal).forEach(function (x) { x.setAttribute('aria-pressed', x === b); });
        $('.media img', modal).src = img(p, k);
        $('[data-add]', modal).setAttribute('data-color', k);
      });
    });
    modal.setAttribute('data-open', 'true');
    document.body.style.overflow = 'hidden';
    document.body.classList.add('float-off');
    $('[data-modal-close]', modal).focus();
  }
  function closeModal() {
    if (!modal || modal.getAttribute('data-open') !== 'true') return;
    modal.setAttribute('data-open', 'false'); document.body.style.overflow = ''; document.body.classList.remove('float-off');
    if (lastFocus) lastFocus.focus();
  }

  /* ---------- product detail ---------- */
  var pdp = $('[data-product]');
  if (pdp) {
    var P = byId[pdp.getAttribute('data-product')];
    var current = P.colors[0];
    $$('.color-btn', pdp).forEach(function (b) {
      b.addEventListener('click', function () {
        current = b.getAttribute('data-color');
        $$('.color-btn', pdp).forEach(function (x) { x.setAttribute('aria-pressed', x === b); });
        $('[data-color-name]').textContent = SA.colors[current].name;
        ['front', 'back', 'detail', 'fabric'].forEach(function (v) { var el = $('[data-view="' + v + '"]'); if (el) el.src = imgFull(P, current, v); });
      });
    });
    var addBtn = $('[data-add-detail]');
    addBtn.addEventListener('click', function () {
      var sizes = {}, bad = false;
      $$('[data-size]', pdp).forEach(function (i) {
        var v = i.value.trim(); if (!v) return;
        if (!/^\d+$/.test(v)) { bad = true; i.setAttribute('aria-invalid', 'true'); return; }
        i.setAttribute('aria-invalid', 'false');
        if (+v > 0) sizes[i.getAttribute('data-size')] = +v;
      });
      if (bad) { toast('Quantities must be whole numbers.'); return; }
      addToQuote(P.id, current, sizes);
      $$('[data-size]', pdp).forEach(function (i) { i.value = ''; });
      setTimeout(function () { location.href = '/quote/'; }, 450);
    });
  }

  /* ---------- catalog filters ---------- */
  var cat = $('[data-catalog]'), filters = $('#filters');
  function setFilters(open) { if (filters) { filters.setAttribute('data-open', open); document.body.style.overflow = open ? 'hidden' : ''; document.body.classList.toggle('float-off', open); } }
  if (cat && filters) {
    var cards = $$('.card', cat);
    var order = cards.slice();
    cat.addEventListener('catalog:updated', function () { cards = $$('.card', cat); order = cards.slice(); apply(); });
    var params = new URLSearchParams(location.search);
    ['cat', 'fabric', 'gsm', 'fit', 'color'].forEach(function (k) {
      params.getAll(k).forEach(function (v) { var i = $('input[name="' + k + '"][value="' + v + '"]', filters); if (i) i.checked = true; });
    });
    var apply = function () {
      var sel = {};
      ['cat', 'fabric', 'gsm', 'fit', 'color'].forEach(function (k) { sel[k] = $$('input[name="' + k + '"]:checked', filters).map(function (i) { return i.value; }); });
      var n = 0;
      cards.forEach(function (c) {
        var ok = (!sel.cat.length || sel.cat.indexOf(c.dataset.cat) > -1) && (!sel.fabric.length || sel.fabric.indexOf(c.dataset.fabric) > -1) &&
          (!sel.gsm.length || sel.gsm.indexOf(c.dataset.gsm) > -1) && (!sel.fit.length || sel.fit.indexOf(c.dataset.fit) > -1) &&
          (!sel.color.length || c.dataset.colors.split(' ').some(function (x) { return sel.color.indexOf(x) > -1; }));
        c.hidden = !ok; if (ok) n++;
      });
      $('[data-result-count]').textContent = n + (n === 1 ? ' style' : ' styles');
      $('[data-empty]').hidden = n > 0;
      var q = new URLSearchParams();
      Object.keys(sel).forEach(function (k) { sel[k].forEach(function (v) { q.append(k, v); }); });
      history.replaceState(null, '', location.pathname + (q.toString() ? '?' + q : ''));
    };
    filters.addEventListener('change', apply);
    $$('[data-filters-reset]').forEach(function (b) { b.addEventListener('click', function () { $$('input', filters).forEach(function (i) { i.checked = false; }); apply(); }); });
    $$('[data-filters-open]').forEach(function (b) { b.addEventListener('click', function () { setFilters(true); }); });
    $$('[data-filters-close]').forEach(function (b) { b.addEventListener('click', function () { setFilters(false); }); });
    $('[data-sort]').addEventListener('change', function (e) {
      var v = e.target.value, list = order.slice();
      if (v === 'gsm-asc') list.sort(function (a, b) { return a.dataset.gsm - b.dataset.gsm; });
      if (v === 'gsm-desc') list.sort(function (a, b) { return b.dataset.gsm - a.dataset.gsm; });
      if (v === 'name') list.sort(function (a, b) { return a.dataset.name.localeCompare(b.dataset.name); });
      list.forEach(function (c) { cat.appendChild(c); });
    });
    apply();
  }

  /* ---------- quote list page ---------- */
  var ql = $('[data-quote-list]');
  var fabBy = {};
  SA.fabrics.forEach(function (f) { fabBy[f.slug] = f; });
  function itemDefaults(it) {
    var p = byId[it.id];
    if (!it.fabric || !fabBy[it.fabric]) it.fabric = p.fabric;
    if (!it.gsm || fabBy[it.fabric].gsm.indexOf(+it.gsm) === -1) it.gsm = fabBy[it.fabric].gsm.indexOf(p.gsm) > -1 ? p.gsm : fabBy[it.fabric].gsm[0];
    if (p.colors.indexOf(it.color) === -1) it.color = p.colors[0];
    it.sizes = it.sizes || {};
    return it;
  }
  function opt(v, t, sel) { return '<option value="' + esc(v) + '"' + (sel ? ' selected' : '') + '>' + esc(t) + '</option>'; }
  function renderQuote() {
    if (!ql) return;
    var all = load(QUOTE);
    all.forEach(function (it) { if (byId[it.id]) itemDefaults(it); });
    save(QUOTE, all);
    var list = all;
    $('[data-quote-empty]').hidden = list.length > 0;
    ['Product', 'Quantity'].forEach(function (n) { var el = document.querySelector('.quote-wizard [name="' + n + '"]'); if (el) el.required = !list.length; });
    ql.innerHTML = list.map(function (it, idx) {
      var p = byId[it.id];
      if (!p) return '<div class="q-item q-pending"><div></div><div class="q-body"><span class="card-title">' + esc(it.id) + '</span><p class="hint">Loading product details…</p></div><button class="q-remove" data-q-remove="' + idx + '">Remove</button></div>';
      var f = fabBy[it.fabric];
      var total = Object.keys(it.sizes).reduce(function (n, k) { return n + (+it.sizes[k] || 0); }, 0);
      return '<div class="q-item"><a class="thumb" href="' + pHref(p) + '"><img src="' + img(p, it.color) + '" alt="' + esc(p.name) + '" width="400" height="440" loading="lazy" data-q-img="' + idx + '"></a><div class="q-body"><a class="card-title" href="' + pHref(p) + '">' + esc(p.name) + '</a><div class="card-spec">' + p.id + ' · ' + esc(p.fit) + ' fit</div>' +
        '<div class="q-specs">' +
        '<label>Colour<select class="input" data-q="' + idx + '" data-qf="color">' + p.colors.map(function (c) { return opt(c, SA.colors[c].name, c === it.color); }).join('') + '</select></label>' +
        '<label>Fabric<select class="input" data-q="' + idx + '" data-qf="fabric">' + SA.fabrics.map(function (x) { return opt(x.slug, x.name, x.slug === it.fabric); }).join('') + '</select></label>' +
        '<label>GSM<select class="input" data-q="' + idx + '" data-qf="gsm">' + f.gsm.map(function (g) { return opt(g, g + ' GSM', +g === +it.gsm); }).join('') + '</select></label></div>' +
        '<div class="size-grid">' + p.sizes.map(function (s) { return '<label>' + s + '<input class="input" type="number" min="0" step="1" inputmode="numeric" placeholder="0" data-q="' + idx + '" data-s="' + s + '" value="' + (it.sizes[s] || '') + '"></label>'; }).join('') + '</div>' +
        '<label class="q-note">Note for this item<input class="input" maxlength="300" data-q="' + idx + '" data-qf="note" value="' + esc(it.note || '') + '" placeholder="Print, label or packaging details"></label>' +
        '<p class="hint" data-q-total="' + idx + '">' + (total ? total.toLocaleString() + ' pieces' : 'Quantities to discuss') + '</p></div>' +
        '<button class="q-remove" data-q-remove="' + idx + '">Remove</button></div>';
    }).join('');
  }
  function quoteItems() {
    return load(QUOTE).filter(function (it) { return byId[it.id]; }).map(function (it) {
      var sizes = {};
      Object.keys(it.sizes || {}).forEach(function (k) { if (+it.sizes[k] > 0) sizes[k] = +it.sizes[k]; });
      return { product_id: it.id, color: it.color, fabric: it.fabric || byId[it.id].fabric, gsm: +(it.gsm || byId[it.id].gsm), sizes: sizes, note: it.note || '' };
    });
  }
  function quoteLines() {
    return quoteItems().map(function (it, i) {
      var p = byId[it.product_id];
      var sz = Object.keys(it.sizes).map(function (s) { return s + ' ' + it.sizes[s]; }).join(', ');
      return (i + 1) + '. ' + p.name + ' [' + p.id + '] — ' + SA.colors[it.color].name + ', ' + (fabBy[it.fabric] ? fabBy[it.fabric].name : it.fabric) + ' ' + it.gsm + ' GSM' + (sz ? ' — sizes: ' + sz : ' — quantities to discuss') + (it.note ? ' — ' + it.note : '');
    });
  }
  if (ql) {
    renderQuote();
    ql.addEventListener('input', function (e) {
      var i = e.target.getAttribute('data-q'); if (i === null) return;
      var list = load(QUOTE), it = list[i];
      if (!it) return;
      var s = e.target.getAttribute('data-s'), f = e.target.getAttribute('data-qf');
      if (s) {
        var v = e.target.value.trim();
        if (v && !/^\d+$/.test(v)) { e.target.setAttribute('aria-invalid', 'true'); return; }
        e.target.setAttribute('aria-invalid', 'false');
        it.sizes[s] = v ? +v : 0;
        var total = Object.keys(it.sizes).reduce(function (n, k) { return n + (+it.sizes[k] || 0); }, 0);
        $('[data-q-total="' + i + '"]').textContent = total ? total.toLocaleString() + ' pieces' : 'Quantities to discuss';
      } else if (f === 'note') { it.note = e.target.value.slice(0, 300); }
      save(QUOTE, list);
    });
    ql.addEventListener('change', function (e) {
      var i = e.target.getAttribute('data-q'), f = e.target.getAttribute('data-qf');
      if (i === null || !f || f === 'note') return;
      var list = load(QUOTE), it = list[i];
      it[f] = f === 'gsm' ? +e.target.value : e.target.value;
      if (f === 'fabric') it.gsm = 0;
      save(QUOTE, list);
      renderQuote();
    });
    ql.addEventListener('click', function (e) {
      var i = e.target.getAttribute('data-q-remove'); if (i === null) return;
      var list = load(QUOTE); list.splice(+i, 1); save(QUOTE, list); renderQuote(); updateCounts();
    });

    var qform = $('form[data-include-quote]');
    var authBox = $('[data-quote-auth]');
    var me = null, step = 1, picked = [];
    var get = function (n) { var el = qform.querySelector('[name="' + n + '"]'); return el ? fieldValue(el) : ''; };
    var signedBuyer = function () { return !!(window.SB && SB.user() && me && me.buyer); };
    var fileHint = $('[data-file-hint]'), fileInput = $('[data-files]'), fileList = $('[data-file-list]');
    function fileState() {
      if (!fileInput) return;
      fileInput.disabled = !signedBuyer();
      fileHint.innerHTML = signedBuyer() ? 'Files are stored privately and shared only with our sales team.' :
        'File upload needs a buyer account so your artwork stays private. <a class="link" href="/account/login/?next=/quote/">Sign in</a> or <a class="link" href="/account/register/">register</a> — or send files on WhatsApp after submitting.';
    }
    if (window.SB && SB.user()) {
      authBox.innerHTML = '<p>Signed in as <b>' + esc(SB.user().email) + '</b>. This request will appear in your <a href="/account/">buyer account</a> with its status.</p>';
      SB.rpc('apparel_me').then(function (m) {
        me = m;
        var b = m && m.buyer;
        fileState();
        if (!b) { authBox.innerHTML += '<p><a class="link" href="/account/?tab=profile">Complete your buyer profile</a> before sending a tracked request.</p>'; return; }
        var set = function (n, v) { var el = qform.querySelector('[name="' + n + '"]'); if (el && v && !el.value) { if (el.tagName === 'SELECT') { [].forEach.call(el.options, function (o) { if (o.text === v) el.value = o.value || o.text; }); } else el.value = v; } };
        set('Contact person', b.contact_person); set('Company', b.company_name); set('Email', m.email); set('Phone', b.phone); set('WhatsApp', b.phone); set('Country', b.country); set('Business type', b.business_type); set('Website', b.website);
      }).catch(function () { fileState(); });
    } else if (authBox) {
      authBox.innerHTML = '<p><a href="/account/login/?next=/quote/">Sign in</a> or <a href="/account/register/">create a buyer account</a> to track this request and attach files, or send it as a guest.</p>';
    }
    fileState();
    function renderFiles() {
      fileList.innerHTML = picked.map(function (f, i) { return '<li><span>' + esc(f.file.name) + '</span><span class="muted">' + (f.error ? '<span class="err">' + esc(f.error) + '</span>' : window.SAFiles.size(f.file.size)) + '</span><button type="button" class="q-remove" data-rm-file="' + i + '">Remove</button></li>'; }).join('');
    }
    if (fileInput) {
      fileInput.addEventListener('change', async function () {
        var add = Array.prototype.slice.call(fileInput.files); fileInput.value = '';
        for (var i = 0; i < add.length; i++) {
          if (picked.length >= 10) { toast('Attach up to 10 files per request.'); break; }
          var entry = { file: add[i] };
          try { await window.SAFiles.inspect(add[i]); } catch (e) { entry.error = e.message; }
          picked.push(entry);
        }
        renderFiles();
      });
      fileList.addEventListener('click', function (e) { var i = e.target.getAttribute('data-rm-file'); if (i !== null) { picked.splice(+i, 1); renderFiles(); } });
    }
    function review() {
      var lines = quoteLines();
      var rows = [['Contact', [get('Contact person'), get('Company'), get('Email')].filter(Boolean).join(' · ')], ['Country', get('Country')], ['Product', get('Product')], ['Quantity', get('Quantity')], ['GSM', get('Preferred GSM')], ['Fabric', get('Fabric type')], ['Sizes', get('Sizes')], ['Colours', get('Colours')], ['Order type', get('Order type')], ['Destination', get('Destination')], ['Target date', get('Target date')], ['Printing', get('Printing')], ['Embroidery', get('Embroidery')]];
      $('[data-review]').innerHTML = '<h3 class="caps">Review</h3><dl class="specs">' + rows.filter(function (r) { return r[1]; }).map(function (r) { return '<div><dt>' + r[0] + '</dt><dd>' + esc(r[1]) + '</dd></div>'; }).join('') +
        '<div><dt>Products</dt><dd>' + (lines.length ? lines.map(esc).join('<br>') : 'No styles selected — general inquiry') + '</dd></div></dl>';
    }
    function showStep(n) {
      step = n;
      $$('[data-step]', qform).forEach(function (f) { f.hidden = +f.getAttribute('data-step') !== n; });
      $$('[data-step-tab]', qform).forEach(function (t) { var k = +t.getAttribute('data-step-tab'); t.classList.toggle('done', k < n); if (k === n) t.setAttribute('aria-current', 'step'); else t.removeAttribute('aria-current'); });
      $('[data-prev]', qform).hidden = n === 1;
      $('[data-next]', qform).hidden = n === 4;
      qform.querySelector('[type="submit"]').hidden = n !== 4;
      if (n === 4) review();
      var top = qform.getBoundingClientRect().top + window.scrollY - 100;
      if (window.scrollY > top) window.scrollTo({ top: top, behavior: 'smooth' });
    }
    $('[data-next]', qform).addEventListener('click', function () {
      if (!validate($('[data-step="' + step + '"]', qform))) return;
      if (step === 3) { var d = get('Target date'); if (d && d < new Date().toISOString().slice(0, 10)) { var el = qform.querySelector('[name="Target date"]'); el.setAttribute('aria-invalid', 'true'); el.parentNode.querySelector('.err').textContent = 'Choose a future date.'; el.focus(); return; } }
      showStep(step + 1);
    });
    $('[data-prev]', qform).addEventListener('click', function () { showStep(step - 1); });
    $$('[data-step-tab]', qform).forEach(function (t) { t.addEventListener('click', function () { var k = +t.getAttribute('data-step-tab'); if (k < step) showStep(k); }); });

    qform.addEventListener('submit', async function (e) {
      e.preventDefault();
      if (step !== 4) return;
      for (var s = 1; s <= 3; s++) { if (!validate($('[data-step="' + s + '"]', qform))) { showStep(s); validate($('[data-step="' + s + '"]', qform)); return; } }
      if (picked.some(function (f) { return f.error; })) { toast('Remove the files marked with an error first.'); return; }
      var old = qform.querySelector('.form-error'); if (old) old.remove();
      var items = quoteItems();
      var lines = quoteLines();
      var waText = ['*Request for quotation* — via app.hsdmj.com', ''].concat(collect(qform), ['', '*Quote list*'], lines.length ? lines : ['(No styles added — general inquiry)']).join('\n');
      busy(qform, true);
      try {
        var res;
        if (signedBuyer() && items.length) {
          var uploaded = [];
          for (var i = 0; i < picked.length; i++) {
            qform.querySelector('[type="submit"]').textContent = 'Uploading ' + (i + 1) + ' of ' + picked.length + '…';
            if (!picked[i].up) picked[i].up = await window.SAFiles.uploadRfq(picked[i].file);
            uploaded.push(picked[i].up);
          }
          qform.querySelector('[type="submit"]').textContent = 'Sending…';
          var r = await SB.rpc('apparel_submit_rfq', rpcArg({
            order_type: get('Order type'), destination: get('Destination'), target_date: qform.querySelector('[name="Target date"]').value || null,
            requirements: [['Product', get('Product')], ['Quantity', get('Quantity')], ['Preferred GSM', get('Preferred GSM')], ['Fabric type', get('Fabric type')], ['Sizes', get('Sizes')], ['Colours', get('Colours')]].filter(function (x) { return x[1]; }).map(function (x) { return x[0] + ': ' + x[1]; }).concat(get('Requirements') ? [get('Requirements')] : []).join('\n'), contact_name: get('Contact person'), whatsapp: get('WhatsApp') || get('Phone'), website: get('Website'), country: get('Country'),
            budget: get('Budget'), printing: get('Printing'), embroidery: get('Embroidery'), customization: get('Customization'), items: items, files: uploaded,
          }));
          res = { code: r.code, tracked: true };
        } else {
          var extra = { Items: lines.length ? lines.join('\n') : 'General inquiry — no styles selected' };
          if (picked.length) extra.Files = picked.length + ' file(s) selected — buyer will send them on WhatsApp';
          var r2 = await SB.rpc('apparel_submit_inquiry', rpcArg(inquiryPayload(qform, 'rfq', extra)));
          res = { code: r2.code, tracked: false };
        }
        save(QUOTE, []); renderQuote(); updateCounts(); picked = []; renderFiles();
        showDone(qform, res, waText); showStep(1);
      } catch (err) {
        showError(qform, err, waText);
      } finally { busy(qform, false); }
    });
  }

  /* ---------- wishlist page ---------- */
  var wg = $('[data-wish-grid]');
  function renderWishlist() {
    if (!wg) return;
    var ids = load(WISH).filter(function (id) { return byId[id]; });
    wg.innerHTML = ids.map(function (id) { return cardHTML(byId[id]); }).join('');
    $('[data-wish-empty]').hidden = ids.length > 0;
    updateCounts();
  }
  renderWishlist();

  /* ---------- search page ---------- */
  var sg = $('[data-search-grid]');
  if (sg) {
    var q = (new URLSearchParams(location.search).get('q') || '').trim();
    $('#q').value = q;
    var terms = q.toLowerCase().split(/\s+/).filter(Boolean);
    var hit = function (s) { s = s.toLowerCase(); return terms.every(function (t) { return s.indexOf(t) > -1; }); };
    var ps = terms.length ? SA.products.filter(function (p) { return hit([p.name, p.id, p.sku || '', p.catName, p.fabricName, p.gsm + ' gsm', p.fit, p.desc, p.colors.map(function (c) { return SA.colors[c].name; }).join(' ')].join(' ')); }) : [];
    var fs = terms.length ? SA.fabrics.filter(function (f) { return hit([f.name, f.composition, f.gsm.join(' gsm ') + ' gsm'].join(' ')); }) : [];
    $('[data-search-summary]').textContent = terms.length ? (ps.length + ' products and ' + fs.length + ' fabrics for “' + q + '”') : 'Type a style, SKU, fabric, colour or weight — for example “oversized 240”.';
    sg.innerHTML = ps.map(cardHTML).join('');
    $('[data-search-fabrics]').innerHTML = fs.length ? '<h2 class="h3" style="margin-bottom:18px">Fabrics</h2><div class="fab-grid">' + fs.map(function (f) { return '<a class="fab" href="/fabrics/' + f.slug + '/"><div class="fab-img"><img src="/assets/img/fabrics/' + f.slug + '-' + f.color + '-sm.webp" alt="" loading="lazy" decoding="async"></div><div class="fab-body"><h3 class="h3">' + esc(f.name) + '</h3><p>' + esc(f.composition) + '</p></div></a>'; }).join('') + '</div>' : '';
  }

  document.addEventListener('sa:live', function () {
    SA.products.forEach(function (p) { byId[p.id] = p; });
    if (ql) renderQuote();
    if (wg) renderWishlist();
    updateCounts();
  });
  updateCounts();
  window.SAStore = { load: load, save: save, toast: toast, openWhatsApp: openWhatsApp, validate: validate, collect: collect, waUrl: waUrl, showDone: showDone, showError: showError, busy: busy, inquiryPayload: inquiryPayload, esc: esc, byId: byId, updateCounts: updateCounts };
})();
