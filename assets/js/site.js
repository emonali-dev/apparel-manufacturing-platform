/* SIDDIQIYA Apparel — site behaviour (no dependencies) */
(function () {
  'use strict';
  var SA = window.SA || { products: [], colors: {}, fabrics: [], categories: [] };
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var byId = {};
  SA.products.forEach(function (p) { byId[p.id] = p; });
  var esc = function (s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var img = function (p, c, v) { return '/assets/img/p/' + p.slug + '-' + c + '-' + (v || 'front') + '.svg'; };

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
  function quoteLines() {
    return load(QUOTE).map(function (it, i) {
      var p = byId[it.id]; if (!p) return '';
      var sz = Object.keys(it.sizes || {}).filter(function (s) { return it.sizes[s] > 0; }).map(function (s) { return s + ' ' + it.sizes[s]; }).join(', ');
      return (i + 1) + '. ' + p.name + ' [' + p.id + '] — ' + SA.colors[it.color].name + ', ' + p.fabricName + ' ' + p.gsm + ' GSM' + (sz ? ' — sizes: ' + sz : ' — quantities to discuss');
    }).filter(Boolean);
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
  function collect(form) {
    var lines = [];
    $$('input, select, textarea', form).forEach(function (el) {
      if (!el.name || el.type === 'file' || el.type === 'checkbox' || el.type === 'radio') return;
      var v = el.value.trim(); if (!v) return;
      lines.push(labelFor(el) + ': ' + v);
    });
    return lines;
  }
  $$('form[data-wa]').forEach(function (form) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (!validate(form)) return;
      var lines = ['*' + form.getAttribute('data-wa') + '* — via app.hsdmj.com', ''].concat(collect(form));
      if (form.hasAttribute('data-include-quote')) {
        var q = quoteLines();
        lines.push('', '*Quote list*');
        lines = lines.concat(q.length ? q : ['(No styles added — general inquiry)']);
      }
      openWhatsApp(lines.join('\n'));
      toast('WhatsApp opened with your message — press send to deliver it.');
    });
  });

  /* ---------- header, menu, search ---------- */
  var drawer = $('#drawer');
  function setDrawer(open) {
    if (!drawer) return;
    drawer.setAttribute('data-open', open); drawer.setAttribute('aria-hidden', !open);
    var b = $('[data-menu-open]'); if (b) b.setAttribute('aria-expanded', open);
    document.body.style.overflow = open ? 'hidden' : '';
  }
  $$('[data-menu-open]').forEach(function (b) { b.addEventListener('click', function () { setDrawer(true); }); });
  $$('[data-menu-close]').forEach(function (b) { b.addEventListener('click', function () { setDrawer(false); }); });
  var so = $('.search-ov');
  function setSearch(open) { if (!so) return; so.setAttribute('data-open', open); if (open) setTimeout(function () { $('#q-top').focus(); }, 30); }
  $$('[data-search-open]').forEach(function (b) { b.addEventListener('click', function () { setSearch(true); }); });
  $$('[data-search-close]').forEach(function (b) { b.addEventListener('click', function () { setSearch(false); }); });
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
    return '<article class="card in" data-id="' + p.id + '"><a class="card-media" href="/products/' + p.slug + '/" aria-label="' + esc(p.name) + '"><img class="main" src="' + img(p, c0) + '" alt="' + esc(p.name) + '" width="400" height="440" loading="lazy"><img class="alt" src="' + img(p, c0, 'back') + '" alt="" width="400" height="440" loading="lazy"><span class="card-badge">' + p.gsm + ' GSM</span></a>' +
      '<button class="icon-btn card-wish" data-wish="' + p.id + '" aria-pressed="false" aria-label="Save ' + esc(p.name) + ' to wishlist"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/></svg></button>' +
      '<div class="card-quick"><button class="btn btn--sm" data-quick="' + p.id + '">Quick view</button></div>' +
      '<div class="card-body"><a class="card-title" href="/products/' + p.slug + '/">' + esc(p.name) + '</a><span class="card-spec">' + esc(p.fabricName) + ' · ' + p.gsm + ' GSM · ' + p.fit + '</span><div class="swatches">' + p.colors.map(function (c) { return '<span class="sw" style="background:' + SA.colors[c].hex + '" title="' + SA.colors[c].name + '"></span>'; }).join('') + '</div><span class="sizes">' + p.sizes[0] + '–' + p.sizes[p.sizes.length - 1] + '</span>' +
      '<div class="card-foot"><span class="price">Price on request</span><button data-add="' + p.id + '">Add to quote +</button></div></div></article>';
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
      '<div class="actions" style="margin-top:8px"><button class="btn" data-add="' + p.id + '" data-color="' + c + '">Add to quote</button><a class="btn btn--ghost" href="/products/' + p.slug + '/">Full details</a></div>';
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
    $('[data-modal-close]', modal).focus();
  }
  function closeModal() {
    if (!modal || modal.getAttribute('data-open') !== 'true') return;
    modal.setAttribute('data-open', 'false'); document.body.style.overflow = '';
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
        ['front', 'back', 'neck'].forEach(function (v) { $('[data-view="' + v + '"]').src = img(P, current, v); });
        $('[data-view="fabric"]').src = '/assets/img/f/' + P.fabric + '-' + current + '.svg';
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
    });
  }

  /* ---------- catalog filters ---------- */
  var cat = $('[data-catalog]'), filters = $('#filters');
  function setFilters(open) { if (filters) { filters.setAttribute('data-open', open); document.body.style.overflow = open ? 'hidden' : ''; } }
  if (cat && filters) {
    var cards = $$('.card', cat);
    var order = cards.slice();
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
  function renderQuote() {
    if (!ql) return;
    var list = load(QUOTE);
    $('[data-quote-empty]').hidden = list.length > 0;
    ql.innerHTML = list.map(function (it, idx) {
      var p = byId[it.id]; if (!p) return '';
      return '<div class="q-item"><a class="thumb" href="/products/' + p.slug + '/"><img src="' + img(p, it.color) + '" alt="' + esc(p.name) + '" width="400" height="440" loading="lazy"></a><div><a class="card-title" href="/products/' + p.slug + '/">' + esc(p.name) + '</a><div class="card-spec">' + p.id + ' · ' + SA.colors[it.color].name + ' · ' + esc(p.fabricName) + ' ' + p.gsm + ' GSM</div>' +
        '<div class="size-grid">' + p.sizes.map(function (s) { return '<label>' + s + '<input class="input" type="number" min="0" step="1" inputmode="numeric" placeholder="0" data-q="' + idx + '" data-s="' + s + '" value="' + (it.sizes[s] || '') + '"></label>'; }).join('') + '</div></div>' +
        '<button class="q-remove" data-q-remove="' + idx + '">Remove</button></div>';
    }).join('');
  }
  if (ql) {
    renderQuote();
    ql.addEventListener('input', function (e) {
      var i = e.target.getAttribute('data-q'); if (i === null) return;
      var list = load(QUOTE), v = e.target.value.trim();
      if (v && !/^\d+$/.test(v)) { e.target.setAttribute('aria-invalid', 'true'); return; }
      e.target.setAttribute('aria-invalid', 'false');
      list[i].sizes[e.target.getAttribute('data-s')] = v ? +v : 0;
      save(QUOTE, list);
    });
    ql.addEventListener('click', function (e) {
      var i = e.target.getAttribute('data-q-remove'); if (i === null) return;
      var list = load(QUOTE); list.splice(+i, 1); save(QUOTE, list); renderQuote(); updateCounts();
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
    var ps = terms.length ? SA.products.filter(function (p) { return hit([p.name, p.catName, p.fabricName, p.gsm + ' gsm', p.fit, p.desc, p.colors.map(function (c) { return SA.colors[c].name; }).join(' ')].join(' ')); }) : [];
    var fs = terms.length ? SA.fabrics.filter(function (f) { return hit([f.name, f.composition, f.gsm.join(' gsm ') + ' gsm'].join(' ')); }) : [];
    $('[data-search-summary]').textContent = terms.length ? (ps.length + ' products and ' + fs.length + ' fabrics for “' + q + '”') : 'Type a style, fabric, colour or weight — for example “oversized 240”.';
    sg.innerHTML = ps.map(cardHTML).join('');
    $('[data-search-fabrics]').innerHTML = fs.length ? '<h2 class="h3" style="margin-bottom:18px">Fabrics</h2><div class="fab-grid">' + fs.map(function (f) { return '<a class="fab" href="/fabrics/' + f.slug + '/"><div class="fab-img"><img src="/assets/img/f/' + f.slug + '-' + f.color + '.svg" alt="" loading="lazy"></div><div class="fab-body"><h3 class="h3">' + esc(f.name) + '</h3><p>' + esc(f.composition) + '</p></div></a>'; }).join('') + '</div>' : '';
  }

  updateCounts();
  window.SAStore = { load: load, save: save, toast: toast, openWhatsApp: openWhatsApp, validate: validate, collect: collect };
})();
