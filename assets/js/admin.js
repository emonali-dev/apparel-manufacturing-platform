/* SIDDIQIYA Apparel — admin dashboard. Every action is authorised again in the database. */
(function () {
  'use strict';
  var SA = window.SA, SB = window.SB;
  var root = document.querySelector('[data-admin]');
  if (!root) return;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var toast = function (m) { window.SAStore.toast(m); };
  var fmt = function (d) { try { return new Date(d).toLocaleString(undefined, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }); } catch (e) { return d; } };
  var colorName = function (k) { return SA.colors[k] ? SA.colors[k].name : (k || ''); };
  var CATS = SA.categories;
  var COLOR_KEYS = Object.keys(SA.colors);
  var SIZES = ['XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL', '4XL', '5XL'];
  var SHAPES = ['crew', 'oversized', 'drop', 'polo', 'raglan', 'heavy'];
  var TEXTURES = ['jersey', 'jersey-fine', 'jersey-slub', 'jersey-heather', 'jersey-heavy', 'terry', 'pique', 'mesh'];
  var ST = {
    rfq: ['submitted', 'reviewing', 'quoted', 'accepted', 'ordered', 'declined', 'closed'],
    sample: ['requested', 'approved', 'preparing', 'shipped', 'delivered', 'declined'],
    inquiry: ['new', 'in_progress', 'closed'],
    buyer: ['pending', 'verified', 'rejected', 'suspended'],
  };
  var LABEL = { submitted: 'Submitted', reviewing: 'Reviewing', quoted: 'Quoted', accepted: 'Accepted', ordered: 'Ordered', declined: 'Declined', closed: 'Closed', requested: 'Requested', approved: 'Approved', preparing: 'Preparing', shipped: 'Shipped', delivered: 'Delivered', new: 'New', in_progress: 'In progress', pending: 'Pending', verified: 'Verified', rejected: 'Rejected', suspended: 'Suspended' };
  var badge = function (s) { return '<span class="status status--' + esc(s) + '">' + esc(LABEL[s] || s) + '</span>'; };
  var NAV = [['overview', 'Overview'], ['rfqs', 'Quotations'], ['orders', 'Orders'], ['samples', 'Samples'], ['inquiries', 'Inquiries'], ['buyers', 'Buyers'], ['products', 'Products'], ['fabrics', 'Fabrics'], ['collections', 'Collections']];
  var view = (location.hash.slice(1) || 'overview').split('/')[0];
  var cache = {};
  var overviewData = null;

  function shell(inner) {
    root.innerHTML = '<div class="admin"><aside class="admin-nav"><a class="logo" href="/"><b>SIDDIQIYA</b><small>ADMIN</small></a><nav aria-label="Admin">' +
      NAV.map(function (n) { return '<a href="#' + n[0] + '" data-view="' + n[0] + '"' + (n[0] === view ? ' aria-current="page"' : '') + '>' + n[1] + '<span class="count" data-nav-count="' + n[0] + '"></span></a>'; }).join('') +
      '</nav><div class="admin-nav-foot"><span class="muted" data-admin-email></span><button type="button" class="link" data-signout>Sign out</button></div></aside><main class="admin-main" data-main>' + inner + '</main></div>';
    $('[data-admin-email]', root).textContent = (SB.user() || {}).email || '';
    $('[data-signout]', root).onclick = async function () { await SB.signOut(); location.reload(); };
    updateBadges();
  }
  function updateBadges() {
    if (!overviewData) return;
    var set = function (k, n) { var el = $('[data-nav-count="' + k + '"]', root); if (el) { el.textContent = n || ''; el.setAttribute('data-n', n || 0); } };
    set('rfqs', overviewData.new_rfqs); set('samples', overviewData.new_samples); set('inquiries', overviewData.new_inquiries); set('buyers', overviewData.pending_buyers);
  }
  function main() { return $('[data-main]', root); }
  function loading() { main().innerHTML = '<div class="portal-loading">Loading…</div>'; }
  function failBox(err) { main().innerHTML = '<div class="form-error" role="alert"><p>' + esc(SB.message(err)) + '</p><button class="btn btn--ghost btn--sm" type="button" onclick="location.reload()">Reload</button></div>'; }
  async function call(fn, args) { return SB.rpc(fn, args || {}); }

  /* ---------- boot / login ---------- */
  async function boot() {
    if (!SB.user()) return loginForm();
    var me;
    try { me = await call('apparel_me'); } catch (err) {
      if (err.status === 401 || err.code === 'NOT_AUTHENTICATED') { await SB.signOut(); return loginForm(); }
      root.innerHTML = '<div class="wrap section--tight"><div class="form-error"><p>' + esc(SB.message(err)) + '</p></div></div>'; return;
    }
    if (!me.is_admin) {
      root.innerHTML = '<div class="wrap section--tight auth-wrap"><div class="panel-form"><h1 class="h3">No admin access</h1><p>' + esc(me.email) + ' is not an administrator of SIDDIQIYA Apparel.</p><div class="actions"><a class="btn" href="/account/">Go to buyer account</a><button class="btn btn--ghost" type="button" data-out>Sign out</button></div></div></div>';
      $('[data-out]', root).onclick = async function () { await SB.signOut(); location.reload(); };
      return;
    }
    shell('');
    route();
  }
  function loginForm() {
    root.innerHTML = '<div class="wrap section--tight auth-wrap"><form class="panel-form form" data-admin-login novalidate><p class="eyebrow">SIDDIQIYA Apparel</p><h1 class="h3">Admin sign in</h1>' +
      '<div class="field"><label for="a-email">Email</label><input class="input" id="a-email" name="Email" type="email" autocomplete="email" required><span class="err"></span></div>' +
      '<div class="field"><label for="a-pass">Password</label><input class="input" id="a-pass" name="Password" type="password" autocomplete="current-password" required><span class="err"></span></div>' +
      '<button class="btn btn--block" type="submit">Sign in</button><div class="auth-links"><a class="link" href="/account/reset/">Forgot password?</a></div></form></div>';
    var f = $('[data-admin-login]', root);
    f.addEventListener('submit', async function (e) {
      e.preventDefault();
      if (!window.SAStore.validate(f)) return;
      var b = f.querySelector('[type=submit]'); b.disabled = true; b.textContent = 'Signing in…';
      try { await SB.signIn(f.Email.value.trim(), f.Password.value); boot(); }
      catch (err) { var box = f.querySelector('.form-error') || f.appendChild(Object.assign(document.createElement('div'), { className: 'form-error' })); box.textContent = SB.message(err); b.disabled = false; b.textContent = 'Sign in'; }
    });
  }

  window.addEventListener('hashchange', function () { view = (location.hash.slice(1) || 'overview').split('/')[0]; $$('[data-view]', root).forEach(function (a) { a.toggleAttribute('aria-current', a.dataset.view === view); if (a.dataset.view === view) a.setAttribute('aria-current', 'page'); }); route(); });

  async function refreshOverview() { try { overviewData = await call('apparel_admin_overview'); updateBadges(); } catch (e) { /* badges are optional */ } }

  async function route() {
    loading();
    try {
      await refreshOverview();
      if (view === 'overview') return renderOverview();
      if (view === 'rfqs' || view === 'orders') return renderList('rfq');
      if (view === 'samples') return renderList('sample');
      if (view === 'inquiries') return renderList('inquiry');
      if (view === 'buyers') return renderList('buyer');
      if (['products', 'fabrics', 'collections'].indexOf(view) > -1) return renderCatalog(view);
      view = 'overview'; renderOverview();
    } catch (err) { failBox(err); }
  }

  /* ---------- overview ---------- */
  function renderOverview() {
    var o = overviewData || {};
    var card = function (label, n, hint, href) { return '<a class="portal-card stat" href="' + href + '"><span class="caps">' + label + '</span><b class="portal-num">' + (n || 0) + '</b><p>' + hint + '</p></a>'; };
    var rs = o.rfq_status || {};
    main().innerHTML = '<header class="admin-head"><div><p class="eyebrow">Dashboard</p><h1 class="h2">Overview</h1></div><button class="btn btn--ghost btn--sm" type="button" data-refresh>Refresh</button></header>' +
      '<div class="portal-grid admin-stats">' +
      card('New quotations', o.new_rfqs, (o.open_rfqs || 0) + ' open in total', '#rfqs') +
      card('Orders', o.orders, 'accepted or ordered', '#orders') +
      card('New samples', o.new_samples, (o.open_samples || 0) + ' in progress', '#samples') +
      card('New inquiries', o.new_inquiries, (o.open_inquiries || 0) + ' not closed', '#inquiries') +
      card('Pending buyers', o.pending_buyers, (o.buyers || 0) + ' buyers in total', '#buyers') +
      card('Live products', o.products, (o.hidden_products || 0) + ' hidden', '#products') +
      '</div><h2 class="h3" style="margin:36px 0 14px">Quotations by status</h2><div class="status-row">' +
      ST.rfq.map(function (s) { return '<div>' + badge(s) + '<b>' + (rs[s] || 0) + '</b></div>'; }).join('') + '</div>' +
      '<p class="hint" style="margin-top:28px">New requests also arrive on WhatsApp when buyers choose to message you. This dashboard is the record of every request submitted on the website.</p>';
    $('[data-refresh]', root).onclick = route;
  }

  /* ---------- lists ---------- */
  var LIST = {
    rfq: { fn: 'apparel_admin_rfqs', title: 'Quotation requests', key: 'rfq' },
    sample: { fn: 'apparel_admin_samples', title: 'Sample requests', key: 'sample' },
    inquiry: { fn: 'apparel_admin_inquiries', title: 'Inquiries', key: 'inquiry' },
    buyer: { fn: 'apparel_admin_buyers', title: 'Buyers', key: 'buyer' },
  };
  var filters = {};
  function buyerName(b) { return b ? (b.company_name || b.contact_person || b.email) : '—'; }
  function totalPcs(r) { return (r.items || []).reduce(function (n, i) { return n + (i.quantity || 0); }, 0); }

  async function renderList(type) {
    var cfg = LIST[type];
    var isOrders = view === 'orders';
    var status = isOrders ? null : (filters[type] || '');
    var rows = await call(cfg.fn, { p_status: status || null });
    if (isOrders) rows = rows.filter(function (r) { return r.status === 'accepted' || r.status === 'ordered'; });
    cache[type] = rows;
    var title = isOrders ? 'Orders' : cfg.title;
    var head = '<header class="admin-head"><div><p class="eyebrow">' + (isOrders ? 'Accepted and ordered quotations' : 'Manage') + '</p><h1 class="h2">' + title + '</h1></div>' +
      (isOrders ? '' : '<label class="admin-filter">Status <select class="input" data-filter>' + '<option value="">All</option>' + ST[type].map(function (s) { return '<option value="' + s + '"' + (s === status ? ' selected' : '') + '>' + LABEL[s] + '</option>'; }).join('') + '</select></label>') + '</header>';
    var body;
    if (!rows.length) body = '<div class="empty-state"><p>Nothing here yet.</p></div>';
    else if (type === 'rfq') body = table(['Ref', 'Buyer', 'Items', 'Pieces', 'Received', 'Status'], rows.map(function (r, i) { return [code(r, i), esc(buyerName(r.buyer)), r.items.length, totalPcs(r).toLocaleString(), fmt(r.created_at), badge(r.status)]; }));
    else if (type === 'sample') body = table(['Ref', 'Buyer', 'Item', 'Received', 'Status'], rows.map(function (r, i) { return [code(r, i), esc(buyerName(r.buyer)), esc(r.product_name), fmt(r.created_at), badge(r.status)]; }));
    else if (type === 'inquiry') body = table(['Ref', 'Type', 'Subject', 'From', 'Received', 'Status'], rows.map(function (r, i) { return [code(r, i), esc(r.kind), esc(r.subject), esc(r.contact_name || r.email), fmt(r.created_at), badge(r.status)]; }));
    else body = table(['Company', 'Contact', 'Country', 'Type', 'Requests', 'Status'], rows.map(function (r, i) { return ['<button class="row-link" data-open="' + i + '">' + esc(r.company_name || '—') + '</button>', esc(r.contact_person) + '<br><span class="muted">' + esc(r.email) + '</span>', esc(r.country || '—'), esc(r.business_type || '—') + (r.wholesale_requested ? '<br><span class="muted">Wholesale</span>' : ''), (r.rfq_count || 0) + ' RFQ · ' + (r.sample_count || 0) + ' samples', badge(r.status)]; }));
    main().innerHTML = head + body + '<div class="admin-drawer" data-drawer hidden></div>';
    var fs = $('[data-filter]', root);
    if (fs) fs.onchange = function () { filters[type] = fs.value; route(); };
    $$('[data-open]', root).forEach(function (b) { b.onclick = function () { openDetail(type, rows[+b.dataset.open]); }; });
  }
  function code(r, i) { return '<button class="row-link" data-open="' + i + '">' + esc(r.code) + (r.seen_by_admin === false ? ' <i class="new-dot" title="New"></i>' : '') + '</button>'; }
  function table(cols, rows) {
    return '<div class="table-scroll"><table class="data-table admin-table"><thead><tr>' + cols.map(function (c) { return '<th>' + c + '</th>'; }).join('') + '</tr></thead><tbody>' +
      rows.map(function (r) { return '<tr>' + r.map(function (c) { return '<td>' + c + '</td>'; }).join('') + '</tr>'; }).join('') + '</tbody></table></div>';
  }
  function history(h) {
    if (!h || !h.length) return '';
    return '<h3 class="caps drawer-h">History</h3><ol class="timeline">' + h.map(function (x) { return '<li><span class="t-date">' + esc(fmt(x.at)) + '</span><b>' + (x.from === x.to ? 'Message to buyer' : esc((LABEL[x.from] || x.from || 'Created') + ' → ' + (LABEL[x.to] || x.to))) + '</b>' + (x.note ? '<p>' + esc(x.note) + '</p>' : '') + '</li>'; }).join('') + '</ol>';
  }
  function dl(pairs) { return '<dl class="specs">' + pairs.filter(function (p) { return p[1]; }).map(function (p) { return '<div><dt>' + p[0] + '</dt><dd>' + p[1] + '</dd></div>'; }).join('') + '</dl>'; }
  function buyerBlock(b) { return b ? dl([['Company', esc(b.company_name)], ['Contact', esc(b.contact_person)], ['Email', '<a href="mailto:' + esc(b.email) + '">' + esc(b.email) + '</a>'], ['Phone', b.phone ? '<a href="https://wa.me/' + esc(String(b.phone).replace(/\D/g, '')) + '" target="_blank" rel="noopener">' + esc(b.phone) + '</a>' : ''], ['Country', esc(b.country)], ['Buyer status', badge(b.status)]]) : ''; }
  function statusSelect(type, cur) { return '<div class="field"><label for="d-status">Status</label><select class="input" id="d-status" name="status">' + ST[type].map(function (s) { return '<option value="' + s + '"' + (s === cur ? ' selected' : '') + '>' + LABEL[s] + '</option>'; }).join('') + '</select></div>'; }
  function noteField(v) { return '<div class="field"><label for="d-note">Internal note <span class="muted">(admins only)</span></label><textarea class="input" id="d-note" name="note" maxlength="2000">' + esc(v || '') + '</textarea></div>'; }
  function msgField() { return '<div class="field"><label for="d-msg">Message to buyer <span class="muted">(shown in their account)</span></label><textarea class="input" id="d-msg" name="message" maxlength="2000" placeholder="e.g. Quotation: USD 4.80/pc FOB Phnom Penh, 30 days after sample approval"></textarea></div>'; }

  function openDetail(type, r) {
    var d = $('[data-drawer]', root);
    var body = '';
    if (type === 'rfq') {
      body = '<h2 class="h3">' + esc(r.code) + ' ' + badge(r.status) + '</h2><p class="muted">' + fmt(r.created_at) + (r.order_type ? ' · ' + esc(r.order_type) : '') + (r.destination ? ' · ' + esc(r.destination) : '') + '</p>' + buyerBlock(r.buyer) +
        '<div class="table-scroll"><table class="data-table"><thead><tr><th>Product</th><th>Colour</th><th>Fabric</th><th>Sizes</th><th class="num">Pcs</th></tr></thead><tbody>' +
        r.items.map(function (i) { return '<tr><td><b>' + esc(i.product_name) + '</b><br><span class="muted">' + esc(i.product_id) + '</span>' + (i.note ? '<br><span class="muted">' + esc(i.note) + '</span>' : '') + '</td><td>' + esc(colorName(i.color)) + '</td><td>' + esc(i.fabric) + (i.gsm ? ' · ' + i.gsm : '') + '</td><td>' + esc(Object.keys(i.sizes || {}).map(function (k) { return k + ' ' + i.sizes[k]; }).join(', ') || '—') + '</td><td class="num">' + (i.quantity || 0).toLocaleString() + '</td></tr>'; }).join('') +
        '<tr class="total"><td colspan="4">Total</td><td class="num">' + totalPcs(r).toLocaleString() + '</td></tr></tbody></table></div>' +
        (r.requirements ? '<h3 class="caps drawer-h">Requirements</h3><p class="pre">' + esc(r.requirements) + '</p>' : '') +
        '<form class="form" data-detail>' + statusSelect('rfq', r.status) + msgField() + noteField(r.admin_note) + '<button class="btn" type="submit">Save</button></form>' + history(r.history);
    } else if (type === 'sample') {
      body = '<h2 class="h3">' + esc(r.code) + ' ' + badge(r.status) + '</h2><p class="muted">' + fmt(r.created_at) + '</p>' + buyerBlock(r.buyer) +
        dl([['Item', esc(r.product_name) + (r.product_id ? ' · ' + esc(r.product_id) : '')], ['Colour / size', esc([colorName(r.color), r.size].filter(Boolean).join(' · '))], ['Fabric', esc([r.fabric, r.gsm ? r.gsm + ' GSM' : ''].filter(Boolean).join(' · '))], ['Deliver to', esc(r.delivery_address)], ['Buyer notes', esc(r.notes)]]) +
        '<form class="form" data-detail>' + statusSelect('sample', r.status) + '<div class="form-row"><div class="field"><label for="d-courier">Courier</label><input class="input" id="d-courier" name="courier" maxlength="80" value="' + esc(r.courier || '') + '"></div><div class="field"><label for="d-track">Tracking number</label><input class="input" id="d-track" name="tracking" maxlength="80" value="' + esc(r.tracking_number || '') + '"></div></div>' + msgField() + noteField(r.admin_note) + '<button class="btn" type="submit">Save</button></form>' + history(r.history);
    } else if (type === 'inquiry') {
      var det = r.details || {};
      body = '<h2 class="h3">' + esc(r.code) + ' ' + badge(r.status) + '</h2><p class="muted">' + fmt(r.created_at) + ' · ' + esc(r.kind) + '</p>' +
        dl([['Subject', esc(r.subject)], ['Name', esc(r.contact_name)], ['Email', '<a href="mailto:' + esc(r.email) + '">' + esc(r.email) + '</a>'], ['Phone', r.phone ? '<a href="https://wa.me/' + esc(String(r.phone).replace(/\D/g, '')) + '" target="_blank" rel="noopener">' + esc(r.phone) + '</a>' : ''], ['Company', esc(r.company)], ['Country', esc(r.country)], ['Signed-in buyer', r.user_id ? 'Yes' : '']]) +
        (Object.keys(det).length ? '<h3 class="caps drawer-h">Submitted details</h3>' + dl(Object.keys(det).map(function (k) { return [esc(k), '<span class="pre">' + esc(det[k]) + '</span>']; })) : '') +
        '<form class="form" data-detail>' + statusSelect('inquiry', r.status) + noteField(r.admin_note) + '<button class="btn" type="submit">Save</button></form>';
    } else {
      body = '<h2 class="h3">' + esc(r.company_name || r.contact_person) + ' ' + badge(r.status) + '</h2><p class="muted">Registered ' + fmt(r.created_at) + '</p>' +
        dl([['Contact', esc(r.contact_person)], ['Email', '<a href="mailto:' + esc(r.email) + '">' + esc(r.email) + '</a>'], ['Phone', esc(r.phone)], ['Country', esc(r.country)], ['Website', r.website ? '<a href="' + esc(r.website) + '" target="_blank" rel="noopener nofollow">' + esc(r.website) + '</a>' : ''], ['Business type', esc(r.business_type)], ['Est. volume', esc(r.est_volume)], ['Wholesale', r.wholesale_requested ? 'Requested' : 'Not requested'], ['Requests', (r.rfq_count || 0) + ' RFQ · ' + (r.sample_count || 0) + ' samples']]) +
        '<form class="form" data-detail>' + statusSelect('buyer', r.status) + noteField(r.admin_note) + '<button class="btn" type="submit">Save</button></form>';
    }
    d.innerHTML = '<div class="drawer-card" role="dialog" aria-modal="true" aria-label="Details"><button class="icon-btn drawer-close" type="button" data-close aria-label="Close"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button>' + body + '</div>';
    d.hidden = false;
    document.body.style.overflow = 'hidden';
    var close = function () { d.hidden = true; document.body.style.overflow = ''; };
    $('[data-close]', d).onclick = close;
    d.onclick = function (e) { if (e.target === d) close(); };
    document.addEventListener('keydown', function esc_(e) { if (e.key === 'Escape') { close(); document.removeEventListener('keydown', esc_); } });
    if (r.seen_by_admin === false) call('apparel_admin_mark_seen', { p_kind: type, p_id: r.id }).then(refreshOverview).catch(function () {});
    var f = $('[data-detail]', d);
    f.addEventListener('submit', async function (e) {
      e.preventDefault();
      var b = f.querySelector('[type=submit]'); b.disabled = true; b.textContent = 'Saving…';
      try {
        var st = f.status.value, note = f.note.value.trim();
        if (type === 'rfq') await call('apparel_admin_update_rfq', { p_id: r.id, p_status: st, p_note: note || null });
        else if (type === 'sample') await call('apparel_admin_update_sample', { p_id: r.id, p_status: st, p_courier: f.courier.value.trim() || null, p_tracking: f.tracking.value.trim() || null, p_note: note || null });
        else if (type === 'inquiry') await call('apparel_admin_update_inquiry', { p_id: r.id, p_status: st, p_note: note || null });
        else await call('apparel_admin_update_buyer', { p_user: r.user_id, p_status: st, p_note: note || null });
        if (f.message && f.message.value.trim()) await call('apparel_admin_message', { p_entity: type, p_id: r.id, p_note: f.message.value.trim() });
        toast('Saved');
        close();
        route();
      } catch (err) { toast(SB.message(err)); b.disabled = false; b.textContent = 'Save'; }
    });
  }

  /* ---------- catalog ---------- */
  async function renderCatalog(kind) {
    var data = await call('apparel_admin_catalog');
    cache.catalog = data;
    var rows = data[kind];
    var head = '<header class="admin-head"><div><p class="eyebrow">Catalog</p><h1 class="h2">' + kind.charAt(0).toUpperCase() + kind.slice(1) + '</h1></div><button class="btn btn--sm" type="button" data-new>New ' + kind.slice(0, -1) + '</button></header>' +
      '<p class="hint" style="margin:-8px 0 20px">Changes go live on the website immediately: hidden items disappear from the public catalog, and new products get a product page.</p>';
    var body;
    if (kind === 'products') body = table(['ID', 'Name', 'Category', 'Fabric', 'GSM', 'Status'], rows.map(function (p, i) { return [esc(p.id), '<button class="row-link" data-edit="' + i + '">' + esc(p.name) + '</button>', esc(catName(p.category)), esc(p.fabric), p.gsm, (p.published ? badge('verified').replace('Verified', 'Live') : badge('closed').replace('Closed', 'Hidden')) + (p.featured ? ' <span class="muted">Featured</span>' : '')]; }));
    else if (kind === 'fabrics') body = table(['Slug', 'Name', 'Composition', 'GSM', 'Status'], rows.map(function (f, i) { return [esc(f.slug), '<button class="row-link" data-edit="' + i + '">' + esc(f.name) + '</button>', esc(f.composition), esc(f.gsm.join(', ')), f.published ? badge('verified').replace('Verified', 'Live') : badge('closed').replace('Closed', 'Hidden')]; }));
    else body = table(['Slug', 'Name', 'Categories', 'Status'], rows.map(function (c, i) { return [esc(c.slug), '<button class="row-link" data-edit="' + i + '">' + esc(c.name) + '</button>', esc(c.categories.map(catName).join(', ')), c.published ? badge('verified').replace('Verified', 'Live') : badge('closed').replace('Closed', 'Hidden')]; }));
    main().innerHTML = head + body + '<div class="admin-drawer" data-drawer hidden></div>';
    $('[data-new]', root).onclick = function () { editItem(kind, null); };
    $$('[data-edit]', root).forEach(function (b) { b.onclick = function () { editItem(kind, rows[+b.dataset.edit]); }; });
  }
  function catName(s) { var c = CATS.filter(function (x) { return x.slug === s; })[0]; return c ? c.name : s; }
  function chips(name, all, sel, labelFn) {
    return '<div class="opts">' + all.map(function (v) { return '<label class="opt"><input type="checkbox" name="' + name + '" value="' + esc(v) + '"' + (sel.indexOf(v) > -1 ? ' checked' : '') + '><span>' + (name === 'colors' ? '<i class="dot" style="background:' + SA.colors[v].hex + '"></i>' : '') + esc(labelFn ? labelFn(v) : v) + '</span></label>'; }).join('') + '</div>';
  }
  function inp(name, label, v, attrs) { return '<div class="field"><label for="e-' + name + '">' + label + '</label><input class="input" id="e-' + name + '" name="' + name + '" value="' + esc(v == null ? '' : v) + '" ' + (attrs || '') + '></div>'; }
  function area(name, label, v) { return '<div class="field"><label for="e-' + name + '">' + label + '</label><textarea class="input" id="e-' + name + '" name="' + name + '">' + esc(v || '') + '</textarea></div>'; }
  function sel(name, label, list, v, labelFn) { return '<div class="field"><label for="e-' + name + '">' + label + '</label><select class="input" id="e-' + name + '" name="' + name + '">' + list.map(function (x) { return '<option value="' + esc(x) + '"' + (x === v ? ' selected' : '') + '>' + esc(labelFn ? labelFn(x) : x) + '</option>'; }).join('') + '</select></div>'; }
  function check(name, label, on) { return '<label class="filter-check"><input type="checkbox" name="' + name + '"' + (on ? ' checked' : '') + '> ' + label + '</label>'; }

  function editItem(kind, it) {
    var d = $('[data-drawer]', root);
    var fabrics = cache.catalog.fabrics.map(function (f) { return f.slug; });
    var body;
    if (kind === 'products') {
      it = it || { colors: [], sizes: ['S', 'M', 'L', 'XL'], published: true, fit: 'Regular', shape: 'crew', gsm: 180, category: CATS[0].slug, fabric: fabrics[0] };
      body = '<h2 class="h3">' + (it.id ? 'Edit ' + esc(it.id) : 'New product') + '</h2><form class="form" data-edit-form>' + inp('name', 'Name *', it.name, 'required maxlength="120"') +
        '<div class="form-row">' + sel('category', 'Category', CATS.map(function (c) { return c.slug; }), it.category, catName) + sel('shape', 'Silhouette (illustration)', SHAPES, it.shape) + '</div>' +
        '<div class="form-row">' + sel('fabric', 'Fabric', fabrics, it.fabric) + inp('gsm', 'GSM *', it.gsm, 'type="number" min="80" max="500" required') + '</div>' +
        inp('fit', 'Fit', it.fit, 'maxlength="40"') + '<div class="field"><span class="field-label">Colours *</span>' + chips('colors', COLOR_KEYS, it.colors, colorName) + '</div>' +
        '<div class="field"><span class="field-label">Sizes *</span>' + chips('sizes', SIZES, it.sizes) + '</div>' + area('description', 'Description', it.description) +
        '<div class="form-row">' + inp('moq', 'MOQ (shown on site)', it.moq, 'maxlength="120" placeholder="Confirmed with your quotation"') + inp('lead_time', 'Lead time (shown on site)', it.lead_time, 'maxlength="120"') + '</div>' +
        check('published', 'Published on website', it.published) + check('featured', 'Featured on homepage', it.featured) + '<button class="btn" type="submit">Save product</button></form>';
    } else if (kind === 'fabrics') {
      it = it || { gsm: [], applications: [], care: [], colors: [], published: true, texture: 'jersey' };
      body = '<h2 class="h3">' + (it.slug ? 'Edit ' + esc(it.name) : 'New fabric') + '</h2><form class="form" data-edit-form>' + inp('name', 'Name *', it.name, 'required maxlength="80"') + inp('composition', 'Composition *', it.composition, 'required maxlength="160"') +
        '<div class="form-row">' + inp('gsm', 'GSM options * (comma separated)', (it.gsm || []).join(', '), 'required') + sel('texture', 'Texture (illustration)', TEXTURES, it.texture) + '</div>' +
        area('description', 'Description', it.description) + area('applications', 'Applications (one per line)', (it.applications || []).join('\n')) + area('care', 'Care instructions (one per line)', (it.care || []).join('\n')) +
        '<div class="field"><span class="field-label">Colours</span>' + chips('colors', COLOR_KEYS, it.colors, colorName) + '</div>' + check('published', 'Published on website', it.published) + '<button class="btn" type="submit">Save fabric</button></form>';
    } else {
      it = it || { categories: [], published: true };
      body = '<h2 class="h3">' + (it.slug ? 'Edit ' + esc(it.name) : 'New collection') + '</h2><form class="form" data-edit-form>' + inp('name', 'Name *', it.name, 'required maxlength="80"') + inp('kicker', 'Kicker', it.kicker, 'maxlength="80"') + area('lead', 'Introduction', it.lead) +
        '<div class="field"><span class="field-label">Categories</span>' + chips('categories', CATS.map(function (c) { return c.slug; }), it.categories, catName) + '</div>' + check('published', 'Published on website', it.published) + '<button class="btn" type="submit">Save collection</button></form>';
    }
    d.innerHTML = '<div class="drawer-card" role="dialog" aria-modal="true" aria-label="Edit"><button class="icon-btn drawer-close" type="button" data-close aria-label="Close"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button>' + body + '</div>';
    d.hidden = false;
    document.body.style.overflow = 'hidden';
    var close = function () { d.hidden = true; document.body.style.overflow = ''; };
    $('[data-close]', d).onclick = close;
    d.onclick = function (e) { if (e.target === d) close(); };
    var f = $('[data-edit-form]', d);
    var checked = function (n) { return $$('input[name="' + n + '"]:checked', f).map(function (x) { return x.value; }); };
    var lines = function (n) { return f[n].value.split('\n').map(function (x) { return x.trim(); }).filter(Boolean); };
    f.addEventListener('submit', async function (e) {
      e.preventDefault();
      var b = f.querySelector('[type=submit]'); b.disabled = true; b.textContent = 'Saving…';
      try {
        if (kind === 'products') {
          await call('apparel_admin_save_product', { p: { id: it.id || null, name: f.name.value.trim(), category: f.category.value, shape: f.shape.value, fabric: f.fabric.value, gsm: +f.gsm.value, fit: f.fit.value.trim(), colors: checked('colors'), sizes: checked('sizes'), description: f.description.value.trim(), moq: f.moq.value.trim() || null, lead_time: f.lead_time.value.trim() || null, published: f.published.checked, featured: f.featured.checked, print: it.print || '', finish: it.finish || '' } });
        } else if (kind === 'fabrics') {
          await call('apparel_admin_save_fabric', { p: { slug: it.slug || null, name: f.name.value.trim(), composition: f.composition.value.trim(), gsm: f.gsm.value.split(/[\s,]+/).filter(Boolean), texture: f.texture.value, description: f.description.value.trim(), applications: lines('applications'), care: lines('care'), colors: checked('colors'), published: f.published.checked } });
        } else {
          await call('apparel_admin_save_collection', { p: { slug: it.slug || null, name: f.name.value.trim(), kicker: f.kicker.value.trim(), lead: f.lead.value.trim(), categories: checked('categories'), published: f.published.checked } });
        }
        try { sessionStorage.removeItem('sa_catalog'); } catch (x) { /* ignore */ }
        toast('Saved');
        close();
        route();
      } catch (err) { toast(SB.message(err)); b.disabled = false; b.textContent = 'Save'; }
    });
  }

  boot();
})();
